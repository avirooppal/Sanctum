using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Sanctum {
    public partial class DesktopHost {
        private static readonly object _mcpLock = new object();
        private static readonly Dictionary<string, McpCacheEntry> _mcpToolsCache = new Dictionary<string, McpCacheEntry>(StringComparer.OrdinalIgnoreCase);

        private class McpCacheEntry {
            public DateTime FetchedAt;
            public List<Dictionary<string, object>> Tools;
        }

        private static string SanitizeMcpSegment(string raw) {
            if (string.IsNullOrEmpty(raw)) return "tool";
            string s = Regex.Replace(raw.Trim(), @"[^a-zA-Z0-9_-]+", "_").Trim('_');
            if (s.Length > 40) s = s.Substring(0, 40);
            return string.IsNullOrEmpty(s) ? "tool" : s;
        }

        private static string BuildQualifiedMcpName(string serverId, string toolName) {
            return "mcp__" + SanitizeMcpSegment(serverId) + "__" + SanitizeMcpSegment(toolName);
        }

        private static List<Dictionary<string, object>> GetMcpConnectorPresets() {
            var list = new List<Dictionary<string, object>>();

            list.Add(new Dictionary<string, object> {
                { "id", "google-calendar" },
                { "name", "Google Calendar" },
                { "category", "Google Workspace" },
                { "description", "List, search, create, update, and delete Google Calendar events and check availability." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @cocal/google-calendar-mcp" },
                { "envHints", new object[] {
                    new Dictionary<string, object> {
                        { "key", "GOOGLE_OAUTH_CREDENTIALS" },
                        { "label", "Google OAuth Credentials JSON Path" },
                        { "placeholder", @"C:\Users\you\gcp-oauth.keys.json" }
                    }
                }},
                { "docsHint", "Requires a Google Cloud Desktop OAuth JSON file. First run opens browser OAuth consent." }
            });

            list.Add(new Dictionary<string, object> {
                { "id", "gmail" },
                { "name", "Gmail" },
                { "category", "Google Workspace" },
                { "description", "Search, read, draft, label, and send emails directly from Sanctum." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @gongrzhe/server-gmail-autoauth-mcp" },
                { "docsHint", "Place gcp-oauth.keys.json in ~/.gmail-mcp/ and run once to authorize." }
            });

            list.Add(new Dictionary<string, object> {
                { "id", "google-drive" },
                { "name", "Google Drive" },
                { "category", "Google Workspace" },
                { "description", "Search and read files and docs from your Google Drive." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @modelcontextprotocol/server-gdrive" },
                { "envHints", new object[] {
                    new Dictionary<string, object> {
                        { "key", "GDRIVE_CREDENTIALS_PATH" },
                        { "label", "Drive Credentials Path" },
                        { "placeholder", @"C:\Users\you\.gdrive-server-credentials.json" }
                    }
                }}
            });

            list.Add(new Dictionary<string, object> {
                { "id", "github" },
                { "name", "GitHub" },
                { "category", "Developer" },
                { "description", "Manage repositories, issues, pull requests, branches, and code search." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @modelcontextprotocol/server-github" },
                { "envHints", new object[] {
                    new Dictionary<string, object> {
                        { "key", "GITHUB_PERSONAL_ACCESS_TOKEN" },
                        { "label", "GitHub Personal Access Token" },
                        { "placeholder", "ghp_xxxxxxxxxxxxxxxxxxxx" },
                        { "secret", true }
                    }
                }}
            });

            list.Add(new Dictionary<string, object> {
                { "id", "notion" },
                { "name", "Notion" },
                { "category", "Productivity" },
                { "description", "Search, read, create, and update Notion pages and databases." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @notionhq/notion-mcp-server" },
                { "envHints", new object[] {
                    new Dictionary<string, object> {
                        { "key", "NOTION_TOKEN" },
                        { "label", "Notion Integration Token" },
                        { "placeholder", "ntn_xxxxxxxxxxxxxxxxxxxx" },
                        { "secret", true }
                    }
                }}
            });

            list.Add(new Dictionary<string, object> {
                { "id", "slack" },
                { "name", "Slack" },
                { "category", "Productivity" },
                { "description", "List channels, read threads, search messages, and post updates to Slack." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @modelcontextprotocol/server-slack" },
                { "envHints", new object[] {
                    new Dictionary<string, object> { { "key", "SLACK_BOT_TOKEN" }, { "label", "Slack Bot Token" }, { "placeholder", "xoxb-..." }, { "secret", true } },
                    new Dictionary<string, object> { { "key", "SLACK_TEAM_ID" }, { "label", "Slack Team ID" }, { "placeholder", "T01234567" } }
                }}
            });

            list.Add(new Dictionary<string, object> {
                { "id", "filesystem" },
                { "name", "Filesystem (MCP)" },
                { "category", "Developer" },
                { "description", "Expose a directory via the standard MCP Filesystem server." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @modelcontextprotocol/server-filesystem <workspace>" }
            });

            list.Add(new Dictionary<string, object> {
                { "id", "postgres" },
                { "name", "PostgreSQL" },
                { "category", "Data & Web" },
                { "description", "Inspect database schemas and execute read-only SQL queries." },
                { "type", "stdio" },
                { "command", "npx" },
                { "args", "-y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/mydb" }
            });

            list.Add(new Dictionary<string, object> {
                { "id", "remote-http" },
                { "name", "Remote MCP Server (HTTP / SSE)" },
                { "category", "Custom" },
                { "description", "Connect any hosted MCP URL (Zapier MCP, Composio, Linear, Cloudflare, custom API)." },
                { "type", "http" },
                { "url", "https://mcp.example.com/mcp" },
                { "headerHints", new object[] {
                    new Dictionary<string, object> {
                        { "key", "Authorization" },
                        { "label", "Authorization Header (optional)" },
                        { "placeholder", "Bearer your-api-token" },
                        { "secret", true }
                    }
                }}
            });

            return list;
        }

        private List<Dictionary<string, object>> ReadMcpServersList() {
            var result = new List<Dictionary<string, object>>();
            string mcpFile = Path.Combine(_appDataDir, "mcp_servers.json");
            lock (_dataLock) {
                if (!File.Exists(mcpFile)) return result;
                try {
                    string raw = File.ReadAllText(mcpFile, Encoding.UTF8);
                    var serializer = new JavaScriptSerializer();
                    object parsed = serializer.DeserializeObject(raw);
                    object[] arr = parsed as object[];
                    if (arr == null && parsed is Dictionary<string, object>) {
                        var dict = (Dictionary<string, object>)parsed;
                        if (dict.ContainsKey("servers") && dict["servers"] is object[]) {
                            arr = (object[])dict["servers"];
                        }
                    }
                    if (arr != null) {
                        foreach (object item in arr) {
                            var d = item as Dictionary<string, object>;
                            if (d != null) result.Add(d);
                        }
                    }
                } catch { }
            }
            return result;
        }

        private static string GetStr(Dictionary<string, object> d, string key, string fallback) {
            if (d == null || !d.ContainsKey(key) || d[key] == null) return fallback;
            return Convert.ToString(d[key]);
        }

        private static bool GetBool(Dictionary<string, object> d, string key, bool fallback) {
            if (d == null || !d.ContainsKey(key) || d[key] == null) return fallback;
            try { return Convert.ToBoolean(d[key]); } catch { return fallback; }
        }

        private static Dictionary<string, string> GetStringMap(Dictionary<string, object> d, string key) {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (d == null || !d.ContainsKey(key)) return map;
            var sub = d[key] as Dictionary<string, object>;
            if (sub == null) return map;
            foreach (var kv in sub) {
                if (!string.IsNullOrEmpty(kv.Key) && kv.Value != null) {
                    map[kv.Key] = Convert.ToString(kv.Value);
                }
            }
            return map;
        }

        private static Dictionary<string, object> ExecuteStdioMcpSequence(
            Dictionary<string, object> server,
            string workspaceRoot,
            string secondMethod,
            Dictionary<string, object> secondParams,
            int timeoutMs
        ) {
            string command = GetStr(server, "command", "").Trim();
            if (string.IsNullOrEmpty(command)) throw new Exception("MCP server has no command configured.");
            string argsRaw = GetStr(server, "args", "").Replace("<workspace>", string.IsNullOrEmpty(workspaceRoot) ? _toolWorkspace : workspaceRoot);

            string baseCmd = Path.GetFileName(command).ToLowerInvariant();
            bool needsCmdShim = (baseCmd == "npx" || baseCmd == "npm" || baseCmd == "pnpm" || baseCmd == "yarn" || baseCmd == "uvx" || baseCmd == "uv" || baseCmd == "bunx");

            var psi = new ProcessStartInfo {
                FileName = needsCmdShim ? "cmd.exe" : command,
                Arguments = needsCmdShim ? ("/c " + command + " " + argsRaw) : argsRaw,
                UseShellExecute = false,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            var customEnv = GetStringMap(server, "env");
            foreach (var kv in customEnv) {
                psi.EnvironmentVariables[kv.Key] = kv.Value;
            }

            var serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = 16 * 1024 * 1024;
            var stderrSb = new StringBuilder();

            using (var proc = Process.Start(psi)) {
                if (proc == null) throw new Exception("Failed to start MCP command: " + command);
                if (_jobHandle != IntPtr.Zero) {
                    try { AssignProcessToJobObject(_jobHandle, proc.Handle); } catch { }
                }

                proc.ErrorDataReceived += (s, e) => {
                    if (e.Data != null && stderrSb.Length < 1000) stderrSb.AppendLine(e.Data);
                };
                proc.BeginErrorReadLine();

                Action<object> writeJsonLine = (payload) => {
                    string line = serializer.Serialize(payload);
                    proc.StandardInput.WriteLine(line);
                    proc.StandardInput.Flush();
                };

                Func<int, Dictionary<string, object>> readRpcResponse = (expectedId) => {
                    DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
                    while (DateTime.UtcNow < deadline) {
                        var readTask = proc.StandardOutput.ReadLineAsync();
                        int remaining = (int)Math.Max(100, (deadline - DateTime.UtcNow).TotalMilliseconds);
                        if (!readTask.Wait(remaining)) {
                            throw new Exception("MCP server timed out waiting for JSON-RPC response.");
                        }
                        string line = readTask.Result;
                        if (line == null) {
                            string errDetail = stderrSb.ToString().Trim();
                            throw new Exception("MCP server closed stdout unexpectedly." + (string.IsNullOrEmpty(errDetail) ? "" : " " + errDetail));
                        }
                        string trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || !trimmed.StartsWith("{")) continue;
                        try {
                            var msg = serializer.Deserialize<Dictionary<string, object>>(trimmed);
                            if (msg != null && msg.ContainsKey("id") && msg["id"] != null && Convert.ToInt32(msg["id"]) == expectedId) {
                                if (msg.ContainsKey("error") && msg["error"] != null) {
                                    var errObj = msg["error"] as Dictionary<string, object>;
                                    string errMsg = errObj != null && errObj.ContainsKey("message") ? Convert.ToString(errObj["message"]) : serializer.Serialize(msg["error"]);
                                    throw new Exception(errMsg);
                                }
                                return msg.ContainsKey("result") ? (msg["result"] as Dictionary<string, object>) : new Dictionary<string, object>();
                            }
                        } catch (ArgumentException) {
                            // Non-JSON log output on stdout, skip
                        }
                    }
                    throw new Exception("MCP server timed out.");
                };

                try {
                    writeJsonLine(new Dictionary<string, object> {
                        { "jsonrpc", "2.0" },
                        { "id", 1 },
                        { "method", "initialize" },
                        { "params", new Dictionary<string, object> {
                            { "protocolVersion", "2024-11-05" },
                            { "capabilities", new Dictionary<string, object>() },
                            { "clientInfo", new Dictionary<string, object> { { "name", "Sanctum" }, { "version", "1.0.0" } } }
                        }}
                    });
                    readRpcResponse(1);

                    writeJsonLine(new Dictionary<string, object> {
                        { "jsonrpc", "2.0" },
                        { "method", "notifications/initialized" },
                        { "params", new Dictionary<string, object>() }
                    });

                    writeJsonLine(new Dictionary<string, object> {
                        { "jsonrpc", "2.0" },
                        { "id", 2 },
                        { "method", secondMethod },
                        { "params", secondParams ?? new Dictionary<string, object>() }
                    });
                    return readRpcResponse(2);
                } finally {
                    try { proc.StandardInput.Close(); } catch { }
                    try { if (!proc.HasExited) proc.Kill(); } catch { }
                }
            }
        }

        private static Dictionary<string, object> ExecuteHttpMcpRpc(
            Dictionary<string, object> server,
            string method,
            Dictionary<string, object> rpcParams,
            ref string sessionId,
            int timeoutMs
        ) {
            string url = GetStr(server, "url", "").Trim();
            if (string.IsNullOrEmpty(url)) throw new Exception("Remote MCP server has no URL configured.");
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;

            var serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = 16 * 1024 * 1024;

            bool isNotification = method.StartsWith("notifications/");
            var payload = new Dictionary<string, object> {
                { "jsonrpc", "2.0" },
                { "method", method },
                { "params", rpcParams ?? new Dictionary<string, object>() }
            };
            if (!isNotification) payload["id"] = Environment.TickCount;

            byte[] bodyBytes = Encoding.UTF8.GetBytes(serializer.Serialize(payload));
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Accept = "application/json, text/event-stream";
            req.Timeout = timeoutMs;
            req.ReadWriteTimeout = timeoutMs;
            req.ContentLength = bodyBytes.Length;

            var headers = GetStringMap(server, "headers");
            foreach (var kv in headers) {
                if (string.Equals(kv.Key, "Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                if (string.Equals(kv.Key, "Accept", StringComparison.OrdinalIgnoreCase)) continue;
                req.Headers[kv.Key] = kv.Value;
            }
            if (!string.IsNullOrEmpty(sessionId)) {
                req.Headers["Mcp-Session-Id"] = sessionId;
            }

            using (var rs = req.GetRequestStream()) {
                rs.Write(bodyBytes, 0, bodyBytes.Length);
            }

            using (var resp = (HttpWebResponse)req.GetResponse()) {
                string nextSid = resp.Headers["Mcp-Session-Id"];
                if (!string.IsNullOrEmpty(nextSid)) sessionId = nextSid;
                if (isNotification || resp.StatusCode == HttpStatusCode.Accepted || resp.StatusCode == HttpStatusCode.NoContent) {
                    return new Dictionary<string, object>();
                }
                string rawText;
                using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                    rawText = sr.ReadToEnd();
                }

                string ct = resp.ContentType ?? "";
                if (ct.IndexOf("text/event-stream", StringComparison.OrdinalIgnoreCase) >= 0 || rawText.TrimStart().StartsWith("data:") || rawText.TrimStart().StartsWith("event:")) {
                    string[] lines = rawText.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
                    for (int i = lines.Length - 1; i >= 0; i--) {
                        if (!lines[i].StartsWith("data:")) continue;
                        string jsonStr = lines[i].Substring(5).Trim();
                        if (string.IsNullOrEmpty(jsonStr)) continue;
                        var msg = serializer.Deserialize<Dictionary<string, object>>(jsonStr);
                        if (msg != null && msg.ContainsKey("error") && msg["error"] != null) {
                            throw new Exception(serializer.Serialize(msg["error"]));
                        }
                        if (msg != null && msg.ContainsKey("result")) {
                            return msg["result"] as Dictionary<string, object> ?? new Dictionary<string, object>();
                        }
                    }
                    throw new Exception("Remote MCP SSE stream returned no JSON-RPC result.");
                }

                var parsed = serializer.Deserialize<Dictionary<string, object>>(string.IsNullOrEmpty(rawText) ? "{}" : rawText);
                if (parsed != null && parsed.ContainsKey("error") && parsed["error"] != null) {
                    var errObj = parsed["error"] as Dictionary<string, object>;
                    string errMsg = errObj != null && errObj.ContainsKey("message") ? Convert.ToString(errObj["message"]) : serializer.Serialize(parsed["error"]);
                    throw new Exception(errMsg);
                }
                return parsed != null && parsed.ContainsKey("result")
                    ? (parsed["result"] as Dictionary<string, object> ?? new Dictionary<string, object>())
                    : new Dictionary<string, object>();
            }
        }

        private List<Dictionary<string, object>> DiscoverToolsForMcpServer(Dictionary<string, object> server, string workspaceRoot, bool forceRefresh) {
            string serverId = GetStr(server, "id", "mcp");
            string serverName = GetStr(server, "name", serverId);
            string type = GetStr(server, "type", "stdio").ToLowerInvariant();

            if (!forceRefresh) {
                lock (_mcpLock) {
                    McpCacheEntry entry;
                    if (_mcpToolsCache.TryGetValue(serverId, out entry) && (DateTime.UtcNow - entry.FetchedAt).TotalSeconds < 60) {
                        return entry.Tools;
                    }
                }
            }

            Dictionary<string, object> rpcRes;
            if (type == "stdio") {
                rpcRes = ExecuteStdioMcpSequence(server, workspaceRoot, "tools/list", new Dictionary<string, object>(), 20000);
            } else {
                string sid = null;
                ExecuteHttpMcpRpc(server, "initialize", new Dictionary<string, object> {
                    { "protocolVersion", "2024-11-05" },
                    { "capabilities", new Dictionary<string, object>() },
                    { "clientInfo", new Dictionary<string, object> { { "name", "Sanctum" }, { "version", "1.0.0" } } }
                }, ref sid, 15000);
                try { ExecuteHttpMcpRpc(server, "notifications/initialized", new Dictionary<string, object>(), ref sid, 5000); } catch { }
                rpcRes = ExecuteHttpMcpRpc(server, "tools/list", new Dictionary<string, object>(), ref sid, 15000);
            }

            var outTools = new List<Dictionary<string, object>>();
            if (rpcRes != null && rpcRes.ContainsKey("tools") && rpcRes["tools"] is object[]) {
                foreach (object item in (object[])rpcRes["tools"]) {
                    var t = item as Dictionary<string, object>;
                    if (t == null) continue;
                    string tName = GetStr(t, "name", "");
                    if (string.IsNullOrEmpty(tName)) continue;
                    string desc = GetStr(t, "description", "External MCP tool \"" + tName + "\" from " + serverName);
                    object schema = t.ContainsKey("inputSchema") && t["inputSchema"] != null
                        ? t["inputSchema"]
                        : new Dictionary<string, object> { { "type", "object" }, { "properties", new Dictionary<string, object>() } };
                    outTools.Add(new Dictionary<string, object> {
                        { "serverId", serverId },
                        { "serverName", serverName },
                        { "toolName", tName },
                        { "qualifiedName", BuildQualifiedMcpName(serverId, tName) },
                        { "description", desc },
                        { "inputSchema", schema }
                    });
                }
            }

            lock (_mcpLock) {
                _mcpToolsCache[serverId] = new McpCacheEntry { FetchedAt = DateTime.UtcNow, Tools = outTools };
            }
            return outTools;
        }

        private void HandleMcpTools(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                bool refresh = req.QueryString["refresh"] == "1";
                string wsRoot = req.QueryString["workspaceRoot"];
                var servers = ReadMcpServersList();
                var allTools = new List<Dictionary<string, object>>();
                var errors = new List<Dictionary<string, object>>();

                foreach (var s in servers) {
                    if (!GetBool(s, "enabled", false)) continue;
                    try {
                        var found = DiscoverToolsForMcpServer(s, wsRoot, refresh);
                        allTools.AddRange(found);
                    } catch (Exception ex) {
                        errors.Add(new Dictionary<string, object> {
                            { "serverId", GetStr(s, "id", "") },
                            { "serverName", GetStr(s, "name", "") },
                            { "error", ex.Message }
                        });
                    }
                }
                WriteJson(res, 200, new { tools = allTools, errors = errors });
            } catch (Exception ex) {
                WriteJson(res, 500, new { tools = new object[0], errors = new object[] { new { serverId = "mcp", serverName = "MCP", error = ex.Message } } });
            }
        }

        private void HandleMcpTest(HttpListenerRequest req, HttpListenerResponse res) {
            var sw = Stopwatch.StartNew();
            try {
                string body = ReadRequestBodyUtf8(req);
                var serializer = new JavaScriptSerializer();
                var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                var server = payload != null && payload.ContainsKey("server") ? (payload["server"] as Dictionary<string, object>) : null;
                string wsRoot = payload != null && payload.ContainsKey("workspaceRoot") ? Convert.ToString(payload["workspaceRoot"]) : _toolWorkspace;
                if (server == null) {
                    WriteJson(res, 400, new { ok = false, latencyMs = 0, tools = new object[0], error = "Invalid MCP server config" });
                    return;
                }
                var tools = DiscoverToolsForMcpServer(server, wsRoot, true);
                sw.Stop();
                WriteJson(res, 200, new { ok = true, latencyMs = sw.ElapsedMilliseconds, tools = tools });
            } catch (Exception ex) {
                sw.Stop();
                WriteJson(res, 502, new { ok = false, latencyMs = sw.ElapsedMilliseconds, tools = new object[0], error = ex.Message });
            }
        }

        private void HandleMcpCall(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "mcp_call")) {
                    RecordAuditLog("mcp_call", "mcp", "call", "host", "denied", "Missing or invalid single-use approval token.");
                    WriteJson(res, 403, new { ok = false, error = "User approval token required to execute MCP tool." });
                    return;
                }
                string body = ReadRequestBodyUtf8(req);
                var serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = 16 * 1024 * 1024;
                var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                string serverId = GetStr(payload, "serverId", "").Trim();
                string toolName = GetStr(payload, "toolName", "").Trim();
                string wsRoot = GetStr(payload, "workspaceRoot", _toolWorkspace);
                var toolArgs = payload != null && payload.ContainsKey("arguments") && payload["arguments"] is Dictionary<string, object>
                    ? (Dictionary<string, object>)payload["arguments"]
                    : new Dictionary<string, object>();

                if (string.IsNullOrEmpty(serverId) || string.IsNullOrEmpty(toolName)) {
                    WriteJson(res, 400, new { ok = false, error = "serverId and toolName are required" });
                    return;
                }

                var servers = ReadMcpServersList();
                Dictionary<string, object> target = null;
                foreach (var s in servers) {
                    if (string.Equals(GetStr(s, "id", ""), serverId, StringComparison.OrdinalIgnoreCase)) {
                        target = s;
                        break;
                    }
                }
                if (target == null) {
                    WriteJson(res, 404, new { ok = false, error = "MCP server not found: " + serverId });
                    return;
                }
                if (!GetBool(target, "enabled", false)) {
                    WriteJson(res, 403, new { ok = false, error = "MCP server is disabled: " + GetStr(target, "name", serverId) });
                    return;
                }

                var callParams = new Dictionary<string, object> {
                    { "name", toolName },
                    { "arguments", toolArgs }
                };

                string type = GetStr(target, "type", "stdio").ToLowerInvariant();
                Dictionary<string, object> rawResult;
                if (type == "stdio") {
                    rawResult = ExecuteStdioMcpSequence(target, wsRoot, "tools/call", callParams, 30000);
                } else {
                    string sid = null;
                    ExecuteHttpMcpRpc(target, "initialize", new Dictionary<string, object> {
                        { "protocolVersion", "2024-11-05" },
                        { "capabilities", new Dictionary<string, object>() },
                        { "clientInfo", new Dictionary<string, object> { { "name", "Sanctum" }, { "version", "1.0.0" } } }
                    }, ref sid, 15000);
                    try { ExecuteHttpMcpRpc(target, "notifications/initialized", new Dictionary<string, object>(), ref sid, 5000); } catch { }
                    rawResult = ExecuteHttpMcpRpc(target, "tools/call", callParams, ref sid, 30000);
                }

                var sb = new StringBuilder();
                if (rawResult != null && rawResult.ContainsKey("content") && rawResult["content"] is object[]) {
                    foreach (object blk in (object[])rawResult["content"]) {
                        var b = blk as Dictionary<string, object>;
                        if (b != null && GetStr(b, "type", "") == "text" && b.ContainsKey("text")) {
                            if (sb.Length > 0) sb.AppendLine();
                            sb.Append(Convert.ToString(b["text"]));
                        } else {
                            if (sb.Length > 0) sb.AppendLine();
                            sb.Append(serializer.Serialize(blk));
                        }
                    }
                }
                string text = sb.Length > 0 ? sb.ToString() : serializer.Serialize(rawResult ?? new Dictionary<string, object>());
                bool isError = GetBool(rawResult, "isError", false);
                WriteJson(res, isError ? 500 : 200, new { ok = !isError, text = text, raw = rawResult, isError = isError });
            } catch (Exception ex) {
                WriteJson(res, 500, new { ok = false, error = ex.Message });
            }
        }
    }
}
