using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 4.6: Isolated, opt-in web_fetch and web_search tools.
    /// Off by default (enforced by EgressHttpFactory EgressFeature.WebFetch),
    /// blocked in Offline mode, recorded in egress ledger, size-capped, and wrapped as untrusted.
    /// Kept strictly isolated in this single file so it can be removed cleanly if desired.
    /// </summary>
    public static class WebTools {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private const int MaxResponseBytes = 65536;
        private static readonly Regex HtmlTagRegex = new Regex(@"<[^>]+>", RegexOptions.Compiled);
        private static readonly Regex ScriptStyleRegex = new Regex(@"<(script|style)[^>]*>[\s\S]*?</\1>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex WhitespaceRegex = new Regex(@"\s{2,}", RegexOptions.Compiled);

        public static string ExtractReadableText(string html) {
            if (string.IsNullOrEmpty(html)) return "";
            string stripped = ScriptStyleRegex.Replace(html, " ");
            stripped = HtmlTagRegex.Replace(stripped, " ");
            stripped = WebUtility.HtmlDecode(stripped);
            return WhitespaceRegex.Replace(stripped, " ").Trim();
        }

        public static void RegisterAll(HarnessEngine engine) {
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "web_fetch",
                Description = "Opt-in: fetch readable text from an approved URL (off by default, blocked in Offline mode, results marked untrusted).",
                Category = "web",
                Safety = "write",
                TimeoutMs = 15000,
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["url"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("url")
                },
                Execute = (args, ct) => {
                    string url = (args["url"]?.Value<string>() ?? "").Trim();
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    var req = EgressHttpFactory.CreateRequest(url, EgressFeature.WebFetch, sid);
                    req.Method = "GET";
                    req.Timeout = 12000;
                    req.ReadWriteTimeout = 12000;
                    req.UserAgent = "Sanctum-WebFetch/1.0 (Local-First Opt-In)";

                    using (ct.Register(() => { try { req.Abort(); } catch { } }))
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    using (var stream = resp.GetResponseStream()) {
                        byte[] buf = new byte[MaxResponseBytes];
                        int total = 0;
                        int read;
                        while (total < MaxResponseBytes && (read = stream.Read(buf, total, MaxResponseBytes - total)) > 0) {
                            total += read;
                        }
                        EgressHttpFactory.RecordBytesReceived(url, EgressFeature.WebFetch, 0, total, sid);
                        string raw = Utf8NoBom.GetString(buf, 0, total);
                        string readable = ExtractReadableText(raw);
                        if (readable.Length > 16384) readable = readable.Substring(0, 16384) + "\n...[truncated]";
                        return UntrustedContent.Wrap("web_content", EgressHttpFactory.RedactUrl(new Uri(url)), readable);
                    }
                }
            });

            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "web_search",
                Description = "Opt-in: query a user-configured local SearXNG or custom search endpoint (off by default, blocked in Offline mode).",
                Category = "web",
                Safety = "write",
                TimeoutMs = 15000,
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["query"] = new JObject { ["type"] = "string" },
                        ["endpoint"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("query")
                },
                Execute = (args, ct) => {
                    string query = (args["query"]?.Value<string>() ?? "").Trim();
                    string endpoint = (args["endpoint"]?.Value<string>() ?? "http://127.0.0.1:8888/search").Trim();
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    string targetUrl = endpoint + (endpoint.Contains("?") ? "&" : "?") + "q=" + Uri.EscapeDataString(query) + "&format=json";
                    var req = EgressHttpFactory.CreateRequest(targetUrl, EgressFeature.WebFetch, sid);
                    req.Method = "GET";
                    req.Timeout = 10000;
                    using (ct.Register(() => { try { req.Abort(); } catch { } }))
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    using (var sr = new StreamReader(resp.GetResponseStream(), Utf8NoBom)) {
                        string body = sr.ReadToEnd();
                        if (body.Length > 16384) body = body.Substring(0, 16384);
                        return UntrustedContent.Wrap("web_search", EgressHttpFactory.RedactUrl(new Uri(targetUrl)), body);
                    }
                }
            });
        }
    }
}
