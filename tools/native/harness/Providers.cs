using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class ProviderCapabilities {
        [JsonProperty("tools")] public bool Tools { get; set; } = true;
        [JsonProperty("vision")] public bool Vision { get; set; }
        [JsonProperty("thinking")] public bool Thinking { get; set; } = true;
        [JsonProperty("structuredOutput")] public bool StructuredOutput { get; set; } = true;
        [JsonProperty("contextLength")] public int ContextLength { get; set; } = 32768;
    }

    public sealed class ProviderToolCall {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("name")] public string Name { get; set; } = "";
        [JsonProperty("arguments")] public JObject Arguments { get; set; } = new JObject();
    }

    public sealed class ProviderTurnResult {
        public string Content { get; set; } = "";
        public string Reasoning { get; set; } = "";
        public List<ProviderToolCall> ToolCalls { get; set; } = new List<ProviderToolCall>();
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
    }

    public interface IModelProvider {
        string Name { get; }
        ProviderCapabilities GetCapabilities(string model);
        ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct);
    }

    /// <summary>
    /// Deterministic scripted model provider for Phase 1a golden-transcript, cancellation,
    /// budget, loop-detection, and crash-recovery tests.
    /// </summary>
    public sealed class MockModelProvider : IModelProvider {
        private readonly JObject _script;

        public MockModelProvider(string scriptPath = null) {
            if (!string.IsNullOrEmpty(scriptPath) && File.Exists(scriptPath)) {
                _script = JObject.Parse(File.ReadAllText(scriptPath));
            } else {
                _script = new JObject();
            }
        }

        public string Name => "mock";

        public ProviderCapabilities GetCapabilities(string model) => new ProviderCapabilities {
            Tools = true,
            Vision = false,
            Thinking = true,
            StructuredOutput = true,
            ContextLength = 32768
        };

        public ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct) {
            ct.ThrowIfCancellationRequested();

            string lastUser = "";
            int toolResultsCount = 0;
            foreach (var m in messages) {
                string role = m["role"]?.Value<string>() ?? "";
                if (role == "user") lastUser = m["content"]?.Value<string>() ?? "";
                if (role == "tool") toolResultsCount++;
            }

            // Custom script override by scenario key or turn array
            if (_script["turns"] is JArray scriptTurns && toolResultsCount < scriptTurns.Count) {
                return ReplayTurn((JObject)scriptTurns[toolResultsCount], onReasoningDelta, onContentDelta, ct);
            }

            // Built-in deterministic scenarios keyed by prompt directive for golden & stress tests
            if (lastUser.IndexOf("[MOCK:SLOW]", StringComparison.OrdinalIgnoreCase) >= 0) {
                var result = new ProviderTurnResult { PromptTokens = 20 };
                for (int i = 0; i < 40; i++) {
                    ct.ThrowIfCancellationRequested();
                    string chunk = $"tok{i} ";
                    onContentDelta(chunk);
                    result.Content += chunk;
                    result.CompletionTokens++;
                    Thread.Sleep(50);
                }
                return result;
            }

            if (lastUser.IndexOf("[MOCK:LOOP]", StringComparison.OrdinalIgnoreCase) >= 0) {
                onContentDelta("Checking again...");
                return new ProviderTurnResult {
                    Content = "Checking again...",
                    PromptTokens = 16,
                    CompletionTokens = 4,
                    ToolCalls = new List<ProviderToolCall> {
                        new ProviderToolCall {
                            Id = "call_loop_" + toolResultsCount,
                            Name = "echo",
                            Arguments = new JObject { ["text"] = "same-arg" }
                        }
                    }
                };
            }

            if (lastUser.IndexOf("[MOCK:MAX_STEPS]", StringComparison.OrdinalIgnoreCase) >= 0) {
                onContentDelta($"Step {toolResultsCount + 1}.");
                return new ProviderTurnResult {
                    Content = $"Step {toolResultsCount + 1}.",
                    PromptTokens = 16,
                    CompletionTokens = 4,
                    ToolCalls = new List<ProviderToolCall> {
                        new ProviderToolCall {
                            Id = "call_step_" + toolResultsCount,
                            Name = "echo",
                            Arguments = new JObject { ["text"] = "unique-" + toolResultsCount }
                        }
                    }
                };
            }

            if (lastUser.IndexOf("[MOCK:BIG_BLOB]", StringComparison.OrdinalIgnoreCase) >= 0) {
                if (toolResultsCount == 0) {
                    return new ProviderTurnResult {
                        PromptTokens = 18,
                        CompletionTokens = 6,
                        ToolCalls = new List<ProviderToolCall> {
                            new ProviderToolCall {
                                Id = "call_blob_1",
                                Name = "big_output",
                                Arguments = new JObject { ["sizeBytes"] = 24576 }
                            }
                        }
                    };
                }
                string finalMsg = "Large output stored in blob.";
                onContentDelta(finalMsg);
                return new ProviderTurnResult { Content = finalMsg, PromptTokens = 30, CompletionTokens = 6 };
            }

            if (lastUser.IndexOf("[MOCK:TOOL]", StringComparison.OrdinalIgnoreCase) >= 0) {
                if (toolResultsCount == 0) {
                    onReasoningDelta("Need to call echo tool first.");
                    return new ProviderTurnResult {
                        Reasoning = "Need to call echo tool first.",
                        PromptTokens = 24,
                        CompletionTokens = 10,
                        ToolCalls = new List<ProviderToolCall> {
                            new ProviderToolCall {
                                Id = "call_echo_1",
                                Name = "echo",
                                Arguments = new JObject { ["text"] = "hello-harness" }
                            }
                        }
                    };
                }
                string doneText = "Tool returned: hello-harness.";
                foreach (string part in new[] { "Tool ", "returned: ", "hello-harness." }) {
                    ct.ThrowIfCancellationRequested();
                    onContentDelta(part);
                }
                return new ProviderTurnResult {
                    Content = doneText,
                    PromptTokens = 40,
                    CompletionTokens = 8
                };
            }

            // Default deterministic response
            string reply = "Mock reply to: " + lastUser;
            string[] pieces = reply.Split(' ');
            for (int i = 0; i < pieces.Length; i++) {
                ct.ThrowIfCancellationRequested();
                string piece = (i == 0 ? "" : " ") + pieces[i];
                onContentDelta(piece);
            }
            return new ProviderTurnResult {
                Content = reply,
                PromptTokens = Math.Max(8, lastUser.Length / 4),
                CompletionTokens = pieces.Length
            };
        }

        private static ProviderTurnResult ReplayTurn(
            JObject turn,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct) {
            var res = new ProviderTurnResult {
                PromptTokens = turn["promptTokens"]?.Value<int>() ?? 16,
                CompletionTokens = turn["completionTokens"]?.Value<int>() ?? 8
            };
            int delayMs = turn["delayMs"]?.Value<int>() ?? 0;

            if (turn["reasoningDeltas"] is JArray rDeltas) {
                foreach (var d in rDeltas) {
                    ct.ThrowIfCancellationRequested();
                    string s = d.Value<string>() ?? "";
                    onReasoningDelta(s);
                    res.Reasoning += s;
                    if (delayMs > 0) Thread.Sleep(delayMs);
                }
            }
            if (turn["contentDeltas"] is JArray cDeltas) {
                foreach (var d in cDeltas) {
                    ct.ThrowIfCancellationRequested();
                    string s = d.Value<string>() ?? "";
                    onContentDelta(s);
                    res.Content += s;
                    if (delayMs > 0) Thread.Sleep(delayMs);
                }
            }
            if (turn["toolCalls"] is JArray calls) {
                foreach (JObject c in calls) {
                    res.ToolCalls.Add(new ProviderToolCall {
                        Id = c["id"]?.Value<string>() ?? ("call_" + Guid.NewGuid().ToString("N").Substring(0, 8)),
                        Name = c["name"]?.Value<string>() ?? "",
                        Arguments = c["arguments"] as JObject ?? new JObject()
                    });
                }
            }
            return res;
        }
    }

    /// <summary>
    /// Loopback-only OpenAI-compatible local model provider (llama.cpp server, LM Studio, vLLM local).
    /// Rejects any base URL that is not loopback (127.0.0.1, localhost, ::1).
    /// </summary>
    public sealed class LocalOpenAiCompatibleProvider : IModelProvider {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _baseUrl;

        public LocalOpenAiCompatibleProvider(string baseUrl = "http://127.0.0.1:1234/v1") {
            _baseUrl = ValidateLoopbackBaseUrl(baseUrl);
        }

        public string Name => "openai-local";
        public string BaseUrl => _baseUrl;

        public static string ValidateLoopbackBaseUrl(string rawUrl) {
            string trimmed = (rawUrl ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrEmpty(trimmed)) {
                throw new InvalidOperationException("LocalOpenAiCompatibleProvider requires a loopback base URL.");
            }
            if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)) {
                throw new InvalidOperationException("Invalid local OpenAI-compatible base URL: " + trimmed);
            }
            if (!string.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("LocalOpenAiCompatibleProvider only permits http:// or https:// loopback URLs.");
            }
            if (!string.IsNullOrEmpty(uri.UserInfo)) {
                throw new InvalidOperationException("Userinfo in base URL is not allowed.");
            }
            string host = (uri.Host ?? "").ToLowerInvariant();
            bool isLoopback = uri.IsLoopback && (host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]");
            if (!isLoopback) {
                throw new InvalidOperationException("LocalOpenAiCompatibleProvider strictly rejects non-loopback base URL: " + uri.Host);
            }
            return trimmed;
        }

        public ProviderCapabilities GetCapabilities(string model) => new ProviderCapabilities {
            Tools = true,
            Vision = false,
            Thinking = false,
            StructuredOutput = true,
            ContextLength = 8192
        };

        public ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct) {
            ct.ThrowIfCancellationRequested();

            var oaiMessages = new JArray();
            foreach (var m in messages) {
                string role = (m["role"]?.Value<string>() ?? "user").ToLowerInvariant();
                if (role == "tool") {
                    oaiMessages.Add(new JObject {
                        ["role"] = "tool",
                        ["tool_call_id"] = m["tool_call_id"]?.Value<string>() ?? ("call_" + oaiMessages.Count),
                        ["content"] = m["content"]?.Value<string>() ?? ""
                    });
                } else {
                    var msgObj = new JObject {
                        ["role"] = role,
                        ["content"] = m["content"]?.Value<string>() ?? ""
                    };
                    if (m["tool_calls"] is JArray tc && tc.Count > 0) msgObj["tool_calls"] = tc;
                    oaiMessages.Add(msgObj);
                }
            }

            var payload = new JObject {
                ["model"] = model,
                ["messages"] = oaiMessages,
                ["stream"] = true
            };
            if (tools != null && tools.Count > 0) {
                var oaiTools = new JArray();
                foreach (JObject t in tools) {
                    oaiTools.Add(new JObject {
                        ["type"] = "function",
                        ["function"] = new JObject {
                            ["name"] = t["name"],
                            ["description"] = t["description"],
                            ["parameters"] = t["inputSchema"] ?? new JObject { ["type"] = "object", ["properties"] = new JObject() }
                        }
                    });
                }
                payload["tools"] = oaiTools;
            }

            byte[] bodyBytes = Utf8NoBom.GetBytes(payload.ToString(Formatting.None));
            var req = EgressHttpFactory.CreateRequest(_baseUrl + "/chat/completions", EgressFeature.Loopback);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Timeout = 60000;
            req.ReadWriteTimeout = 60000;
            req.ContentLength = bodyBytes.Length;

            using (ct.Register(() => { try { req.Abort(); } catch { } })) {
                using (var rs = req.GetRequestStream()) rs.Write(bodyBytes, 0, bodyBytes.Length);
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream(), Utf8NoBom)) {
                    var contentSb = new StringBuilder();
                    var reasoningSb = new StringBuilder();
                    var tcByIndex = new Dictionary<int, (string id, string name, StringBuilder args)>();
                    int promptTokens = 0;
                    int completionTokens = 0;

                    string line;
                    while ((line = sr.ReadLine()) != null) {
                        ct.ThrowIfCancellationRequested();
                        if (!line.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) continue;
                        string data = line.Substring(5).Trim();
                        if (string.IsNullOrEmpty(data) || data == "[DONE]") continue;

                        JObject chunk;
                        try { chunk = CanonicalJson.ParseObject(data); } catch { continue; }
                        if (chunk["usage"] is JObject usage) {
                            promptTokens = usage["prompt_tokens"]?.Value<int>() ?? promptTokens;
                            completionTokens = usage["completion_tokens"]?.Value<int>() ?? completionTokens;
                        }
                        var choices = chunk["choices"] as JArray;
                        if (choices == null || choices.Count == 0) continue;
                        var delta = choices[0]?["delta"] as JObject;
                        if (delta == null) continue;

                        string reasoning = delta["reasoning_content"]?.Value<string>() ?? delta["reasoning"]?.Value<string>();
                        if (!string.IsNullOrEmpty(reasoning)) {
                            reasoningSb.Append(reasoning);
                            onReasoningDelta(reasoning);
                        }
                        string content = delta["content"]?.Value<string>();
                        if (!string.IsNullOrEmpty(content)) {
                            contentSb.Append(content);
                            onContentDelta(content);
                        }
                        if (delta["tool_calls"] is JArray tcs) {
                            foreach (JObject tc in tcs) {
                                int idx = tc["index"]?.Value<int>() ?? 0;
                                if (!tcByIndex.TryGetValue(idx, out var acc)) {
                                    acc = ("call_" + idx, "", new StringBuilder());
                                }
                                string id = tc["id"]?.Value<string>();
                                if (!string.IsNullOrEmpty(id)) acc.id = id;
                                var fn = tc["function"] as JObject;
                                if (fn != null) {
                                    string fnName = fn["name"]?.Value<string>();
                                    if (!string.IsNullOrEmpty(fnName)) acc.name = fnName;
                                    string argChunk = fn["arguments"]?.Value<string>();
                                    if (!string.IsNullOrEmpty(argChunk)) acc.args.Append(argChunk);
                                }
                                tcByIndex[idx] = acc;
                            }
                        }
                    }

                    var parsedCalls = new List<ProviderToolCall>();
                    foreach (var kv in tcByIndex) {
                        if (string.IsNullOrWhiteSpace(kv.Value.name)) continue;
                        JObject argsObj;
                        try {
                            argsObj = string.IsNullOrWhiteSpace(kv.Value.args.ToString())
                                ? new JObject()
                                : CanonicalJson.ParseObject(kv.Value.args.ToString());
                        } catch {
                            argsObj = new JObject { ["raw"] = kv.Value.args.ToString() };
                        }
                        parsedCalls.Add(new ProviderToolCall {
                            Id = kv.Value.id,
                            Name = kv.Value.name,
                            Arguments = argsObj
                        });
                    }

                    string finalContent = contentSb.ToString();
                    if (parsedCalls.Count == 0 && !string.IsNullOrWhiteSpace(finalContent)) {
                        var fallback = ToolCallParser.Parse(finalContent, new JArray());
                        foreach (var c in fallback) {
                            parsedCalls.Add(c);
                        }
                    }

                    return new ProviderTurnResult {
                        Content = finalContent,
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
