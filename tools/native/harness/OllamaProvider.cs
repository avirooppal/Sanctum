using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Local Ollama model provider over loopback HTTP.
    /// Queries live capabilities from POST /api/show (never hardcoded model lists),
    /// streams NDJSON from POST /api/chat, supports cancellation via HttpWebRequest.Abort(),
    /// and parses structured + XML/Llama tool calls through ToolCallParser.
    /// </summary>
    public sealed class OllamaModelProvider : IModelProvider {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _endpoint;
        private readonly Dictionary<string, ProviderCapabilities> _capCache = new Dictionary<string, ProviderCapabilities>(StringComparer.OrdinalIgnoreCase);
        private readonly object _capLock = new object();

        public OllamaModelProvider(string endpoint = "http://127.0.0.1:11434") {
            string ep = (endpoint ?? "http://127.0.0.1:11434").Trim().TrimEnd('/');
            var uri = new Uri(ep);
            if (!uri.IsLoopback) {
                throw new InvalidOperationException("OllamaModelProvider only permits loopback endpoints (offline-first policy).");
            }
            _endpoint = ep;
        }

        public string Name => "ollama";

        public ProviderCapabilities GetCapabilities(string model) {
            if (string.IsNullOrWhiteSpace(model)) return new ProviderCapabilities();
            lock (_capLock) {
                if (_capCache.TryGetValue(model, out var cached)) return cached;
            }

            var caps = new ProviderCapabilities {
                Tools = false,
                Vision = false,
                Thinking = false,
                StructuredOutput = true,
                ContextLength = 8192
            };

            try {
                byte[] body = Utf8NoBom.GetBytes(JsonConvert.SerializeObject(new { name = model }));
                var req = EgressHttpFactory.CreateRequest(_endpoint + "/api/show", EgressFeature.Loopback);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.Timeout = 5000;
                req.ReadWriteTimeout = 5000;
                req.ContentLength = body.Length;
                using (var rs = req.GetRequestStream()) rs.Write(body, 0, body.Length);
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream(), Utf8NoBom)) {
                    var obj = CanonicalJson.ParseObject(sr.ReadToEnd());
                    if (obj["capabilities"] is JArray capArr) {
                        foreach (var c in capArr) {
                            string val = (c.Value<string>() ?? "").ToLowerInvariant();
                            if (val == "tools") caps.Tools = true;
                            else if (val == "vision") caps.Vision = true;
                            else if (val == "thinking") caps.Thinking = true;
                        }
                    }
                    if (obj["model_info"] is JObject modelInfo) {
                        foreach (var prop in modelInfo.Properties()) {
                            if (prop.Name.EndsWith(".context_length", StringComparison.OrdinalIgnoreCase)) {
                                int ctx = prop.Value.Value<int>();
                                if (ctx > 0) caps.ContextLength = ctx;
                            }
                        }
                    }
                }
            } catch {
                // If /api/show is unreachable, return conservative defaults
            }

            lock (_capLock) _capCache[model] = caps;
            return caps;
        }

        public ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct,
            ProviderRequestOptions options = null) {
            ct.ThrowIfCancellationRequested();

            var caps = GetCapabilities(model);
            int effectiveNumCtx = options != null && options.NumCtx > 0
                ? options.NumCtx
                : ContextEngine.ComputeEffectiveNumCtx(caps.ContextLength, 0);

            var ollamaTools = new JArray();
            if (tools != null) {
                foreach (JObject t in tools) {
                    ollamaTools.Add(new JObject {
                        ["type"] = "function",
                        ["function"] = new JObject {
                            ["name"] = t["name"],
                            ["description"] = t["description"],
                            ["parameters"] = t["inputSchema"] ?? new JObject { ["type"] = "object", ["properties"] = new JObject() }
                        }
                    });
                }
            }

            // Normalize messages for Ollama /api/chat:
            // Ollama requires assistant tool_calls[].function.arguments to be a JSON object (not a string).
            var ollamaMessages = new JArray();
            if (messages != null) {
                foreach (var msg in messages) {
                    if (msg == null) continue;
                    var clone = (JObject)msg.DeepClone();
                    if (clone["tool_calls"] is JArray tcs) {
                        foreach (var tcTok in tcs) {
                            if (tcTok is JObject tc && tc["function"] is JObject fn) {
                                var argsTok = fn["arguments"];
                                if (argsTok == null || argsTok.Type == JTokenType.Null) {
                                    fn["arguments"] = new JObject();
                                } else if (argsTok.Type == JTokenType.String) {
                                    string rawArgs = argsTok.Value<string>() ?? "";
                                    try {
                                        var parsed = JToken.Parse(rawArgs);
                                        fn["arguments"] = parsed is JObject parsedObj ? parsedObj : new JObject();
                                    } catch {
                                        fn["arguments"] = new JObject();
                                    }
                                }
                            }
                        }
                    }
                    ollamaMessages.Add(clone);
                }
            }

            var payload = new JObject {
                ["model"] = model,
                ["messages"] = ollamaMessages,
                ["stream"] = true,
                ["options"] = new JObject {
                    ["num_ctx"] = effectiveNumCtx
                }
            };
            if (caps.Thinking && options?.Think != null) {
                payload["think"] = options.Think.Value;
            }
            if (options?.FormatSchema != null && caps.StructuredOutput) {
                payload["format"] = options.FormatSchema;
            }
            if (ollamaTools.Count > 0) {
                payload["tools"] = ollamaTools;
            }

            byte[] bodyBytes = Utf8NoBom.GetBytes(payload.ToString(Formatting.None));
            var req = EgressHttpFactory.CreateRequest(_endpoint + "/api/chat", EgressFeature.Loopback);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Timeout = 60000;
            req.ReadWriteTimeout = 60000;
            req.ContentLength = bodyBytes.Length;

            using (ct.Register(() => { try { req.Abort(); } catch { } })) {
                using (var rs = req.GetRequestStream()) rs.Write(bodyBytes, 0, bodyBytes.Length);
                HttpWebResponse resp;
                try {
                    resp = (HttpWebResponse)req.GetResponse();
                } catch (WebException wex) when (wex.Response is HttpWebResponse errResp) {
                    string errBody = "";
                    try {
                        using (var esr = new StreamReader(errResp.GetResponseStream(), Utf8NoBom)) {
                            errBody = esr.ReadToEnd();
                        }
                    } catch { }
                    string detail = errBody;
                    try {
                        var errObj = CanonicalJson.ParseObject(errBody);
                        if (errObj["error"] != null) detail = errObj["error"].Value<string>();
                    } catch { }
                    throw new InvalidOperationException($"Ollama HTTP {(int)errResp.StatusCode}: {(string.IsNullOrWhiteSpace(detail) ? wex.Message : detail)}", wex);
                }
                using (resp)
                using (var sr = new StreamReader(resp.GetResponseStream(), Utf8NoBom)) {
                    var contentSb = new StringBuilder();
                    var reasoningSb = new StringBuilder();
                    var rawToolCalls = new JArray();
                    int promptTokens = 0;
                    int completionTokens = 0;

                    string line;
                    while ((line = sr.ReadLine()) != null) {
                        ct.ThrowIfCancellationRequested();
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        var chunk = CanonicalJson.ParseObject(line);
                        if (chunk["error"] != null) {
                            throw new Exception("Ollama error: " + chunk["error"].Value<string>());
                        }
                        if (chunk["message"] is JObject msg) {
                            string thinking = msg["thinking"]?.Value<string>();
                            if (!string.IsNullOrEmpty(thinking)) {
                                reasoningSb.Append(thinking);
                                onReasoningDelta(thinking);
                            }
                            string content = msg["content"]?.Value<string>();
                            if (!string.IsNullOrEmpty(content)) {
                                contentSb.Append(content);
                                onContentDelta(content);
                            }
                            if (msg["tool_calls"] is JArray tc) {
                                foreach (var call in tc) rawToolCalls.Add(call);
                            }
                        }
                        if (chunk["done"]?.Value<bool>() == true) {
                            promptTokens = chunk["prompt_eval_count"]?.Value<int>() ?? 0;
                            completionTokens = chunk["eval_count"]?.Value<int>() ?? 0;
                            break;
                        }
                    }

                    string fullContent = contentSb.ToString();
                    var parsedCalls = ToolCallParser.Parse(fullContent, rawToolCalls);

                    return new ProviderTurnResult {
                        Content = fullContent,
                        Reasoning = reasoningSb.ToString(),
                        ToolCalls = parsedCalls,
                        PromptTokens = promptTokens,
                        CompletionTokens = completionTokens
                    };
                }
            }
        }
    }
}
