using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Net.Sockets;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class HarnessServer : IDisposable {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);

        private readonly string _appDataDir;
        private readonly HarnessEngine _engine;
        private readonly string _token;
        private readonly string _pipeName;
        private readonly int _httpPort;
        private readonly HttpListener _httpListener;
        private readonly CancellationTokenSource _shutdownCts = new CancellationTokenSource();
        private readonly string _runtimeFile;
        private volatile bool _disposed;

        public HarnessServer(string appDataDir, HarnessEngine engine, int preferredPort = 0, string customPipeName = null) {
            _appDataDir = appDataDir;
            _engine = engine;
            _token = GenerateToken();
            _httpPort = preferredPort > 0 ? preferredPort : AllocateFreeLoopbackPort();
            string sidSuffix = GetUserSidSuffix();
            _pipeName = !string.IsNullOrWhiteSpace(customPipeName)
                ? customPipeName
                : ("SanctumHarness-" + sidSuffix + "-" + CanonicalJson.Sha256Hex(appDataDir).Substring(0, 8));
            _runtimeFile = Path.Combine(_appDataDir, "runtime.json");

            _httpListener = new HttpListener();
            _httpListener.Prefixes.Add($"http://127.0.0.1:{_httpPort}/");
        }

        public int HttpPort => _httpPort;
        public string PipeName => _pipeName;
        public string Token => _token;
        public string RuntimeFilePath => _runtimeFile;
        public HarnessEngine Engine => _engine;

        private static string GenerateToken() {
            byte[] buf = new byte[32];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(buf);
            var sb = new StringBuilder(64);
            for (int i = 0; i < buf.Length; i++) sb.Append(buf[i].ToString("x2"));
            return sb.ToString();
        }

        private static int AllocateFreeLoopbackPort() {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static string GetUserSidSuffix() {
            try {
                string sid = WindowsIdentity.GetCurrent()?.User?.Value ?? "local";
                return CanonicalJson.Sha256Hex(sid).Substring(0, 10);
            } catch {
                return "local";
            }
        }

        public void Start() {
            ThreadPool.SetMinThreads(64, 64);
            Directory.CreateDirectory(_appDataDir);
            _httpListener.Start();
            WriteRuntimeFile();

            var httpThread = new Thread(HttpAcceptLoop) { IsBackground = true, Name = "HarnessHttpLoop" };
            httpThread.Start();

            for (int i = 0; i < 2; i++) {
                var pipeThread = new Thread(PipeAcceptLoop) { IsBackground = true, Name = "HarnessPipeLoop-" + i };
                pipeThread.Start();
            }
        }

        private void WriteRuntimeFile() {
            var info = new RuntimeInfo {
                Pid = Process.GetCurrentProcess().Id,
                PipeName = _pipeName,
                HttpPort = _httpPort,
                Token = _token,
                StartedAt = DateTime.UtcNow.ToString("o"),
                ProtocolVersion = ProtocolConstants.Version
            };
            string tmp = _runtimeFile + ".tmp." + Guid.NewGuid().ToString("N");
            File.WriteAllText(tmp, JsonConvert.SerializeObject(info, Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
            if (File.Exists(_runtimeFile)) File.Delete(_runtimeFile);
            File.Move(tmp, _runtimeFile);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_runtimeFile);
        }

        private void HttpAcceptLoop() {
            while (!_shutdownCts.IsCancellationRequested) {
                try {
                    var ctx = _httpListener.GetContext();
                    ThreadPool.QueueUserWorkItem(_ => HandleHttpContext(ctx));
                } catch {
                    if (_shutdownCts.IsCancellationRequested) break;
                }
            }
        }

        private static bool ConstantTimeEquals(string a, string b) {
            if (a == null || b == null || a.Length != b.Length) return false;
            int diff = 0;
            for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
            return diff == 0;
        }

        private bool IsAllowedHost(string hostHeader) {
            if (string.IsNullOrWhiteSpace(hostHeader)) return false;
            string h = hostHeader.Trim().ToLowerInvariant();
            return h == $"127.0.0.1:{_httpPort}" || h == $"localhost:{_httpPort}";
        }

        private bool IsAllowedOrigin(string originHeader) {
            if (string.IsNullOrWhiteSpace(originHeader)) return true; // non-browser local API clients
            string o = originHeader.Trim().ToLowerInvariant();
            return o == "https://sanctum.app" || o == $"http://127.0.0.1:{_httpPort}" || o == $"http://localhost:{_httpPort}";
        }

        private void HandleHttpContext(HttpListenerContext ctx) {
            var req = ctx.Request;
            var res = ctx.Response;
            try {
                // DNS rebinding & cross-origin defense
                if (!IsAllowedHost(req.Headers["Host"])) {
                    WriteHttpJson(res, 403, new JObject { ["error"] = "Forbidden Host header (DNS rebinding guard)." });
                    return;
                }
                if (!IsAllowedOrigin(req.Headers["Origin"])) {
                    WriteHttpJson(res, 403, new JObject { ["error"] = "Forbidden Origin header." });
                    return;
                }

                string origin = req.Headers["Origin"];
                if (!string.IsNullOrEmpty(origin)) {
                    res.Headers["Access-Control-Allow-Origin"] = origin;
                    res.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
                    res.Headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
                }
                if (req.HttpMethod == "OPTIONS") {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                // Bearer auth (required on all /v1/* endpoints)
                string auth = req.Headers["Authorization"] ?? "";
                string provided = auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                    ? auth.Substring(7).Trim()
                    : "";
                if (!ConstantTimeEquals(provided, _token)) {
                    WriteHttpJson(res, 401, new JObject { ["error"] = "Unauthorized: valid Bearer token required." });
                    return;
                }

                string path = req.Url.AbsolutePath.TrimEnd('/');
                string method = req.HttpMethod.ToUpperInvariant();

                // SSE endpoint: GET /v1/sessions/:id/events?after=<seq>
                if (method == "GET" && path.StartsWith("/v1/sessions/") && path.EndsWith("/events")) {
                    string sessionId = path.Substring("/v1/sessions/".Length, path.Length - "/v1/sessions/".Length - "/events".Length).Trim('/');
                    long afterSeq = 0;
                    long.TryParse(req.QueryString["after"] ?? "0", out afterSeq);
                    var sseThread = new Thread(() => HandleHttpSse(res, sessionId, afterSeq)) { IsBackground = true };
                    sseThread.Start();
                    return;
                }

                string rawBody = "";
                if (method == "POST" || method == "PUT" || method == "PATCH") {
                    using (var sr = new StreamReader(req.InputStream, Utf8NoBom)) {
                        rawBody = sr.ReadToEnd();
                    }
                    if (rawBody.Length > 2 * 1024 * 1024) {
                        WriteHttpJson(res, 413, new JObject { ["error"] = "Payload exceeds 2 MiB limit." });
                        return;
                    }
                }

                JObject bodyObj = null;
                if (!string.IsNullOrWhiteSpace(rawBody)) {
                    try {
                        bodyObj = JObject.Parse(rawBody);
                    } catch {
                        WriteHttpJson(res, 400, new JObject { ["error"] = "Malformed JSON body." });
                        return;
                    }
                }
                if (bodyObj == null) bodyObj = new JObject();
                foreach (string qk in req.QueryString.AllKeys) {
                    if (!string.IsNullOrEmpty(qk) && bodyObj[qk] == null) {
                        bodyObj[qk] = req.QueryString[qk];
                    }
                }
                string hdrWs = req.Headers["X-Sanctum-Workspace"];
                if (!string.IsNullOrWhiteSpace(hdrWs) && bodyObj["workspaceId"] == null) {
                    bodyObj["workspaceId"] = hdrWs.Trim();
                }

                var (status, json) = DispatchProtocolCommand(method, path, bodyObj, viaTrustedChannel: false);
                WriteHttpJson(res, status, json);
            } catch (Exception ex) {
                try { WriteHttpJson(res, 500, new JObject { ["error"] = ex.Message }); } catch { }
            }
        }

        public void HandleHttpSse(HttpListenerResponse res, string sessionId, long afterSeq) {
            if (!_engine.Store.SessionExists(sessionId)) {
                WriteHttpJson(res, 404, new JObject { ["error"] = "Session not found." });
                return;
            }

            res.StatusCode = 200;
            res.ContentType = "text/event-stream; charset=utf-8";
            res.Headers["Cache-Control"] = "no-cache";
            res.SendChunked = true;

            var sub = _engine.Subscribe(sessionId);
            try {
                // 1. Replay missed durable events
                var history = _engine.Store.ReadEvents(sessionId, afterSeq);
                long lastSentSeq = afterSeq;
                foreach (var evt in history) {
                    string frame = $"id: {evt.Seq}\nevent: {evt.Type}\ndata: {CanonicalJson.SerializeObject(evt)}\n\n";
                    byte[] b = Utf8NoBom.GetBytes(frame);
                    res.OutputStream.Write(b, 0, b.Length);
                    if (evt.Seq > lastSentSeq) lastSentSeq = evt.Seq;
                }
                res.OutputStream.Flush();

                // 2. Stream live events
                while (!_shutdownCts.IsCancellationRequested) {
                    string frame = sub.DequeueNext(15000, _shutdownCts.Token);
                    if (frame == null) {
                        if (sub.SlowConsumerDisconnected) {
                            byte[] sc = Utf8NoBom.GetBytes("event: slow_consumer\ndata: {\"reason\":\"buffer_overflow\",\"reconnectAfterSeq\":" + lastSentSeq + "}\n\n");
                            res.OutputStream.Write(sc, 0, sc.Length);
                            res.OutputStream.Flush();
                        }
                        break;
                    }
                    if (frame.Length == 0) {
                        byte[] hb = Utf8NoBom.GetBytes(": heartbeat\n\n");
                        res.OutputStream.Write(hb, 0, hb.Length);
                        res.OutputStream.Flush();
                        continue;
                    }
                    byte[] data = Utf8NoBom.GetBytes(frame);
                    res.OutputStream.Write(data, 0, data.Length);
                    res.OutputStream.Flush();
                }
            } catch {
                // Client disconnected
            } finally {
                _engine.Unsubscribe(sub);
                try { res.Close(); } catch { }
            }
        }

        private void PipeAcceptLoop() {
            while (!_shutdownCts.IsCancellationRequested) {
                NamedPipeServerStream pipe = null;
                try {
                    var pipeSec = new PipeSecurity();
                    var user = WindowsIdentity.GetCurrent()?.User;
                    if (user != null) {
                        pipeSec.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.FullControl, AccessControlType.Allow));
                    }
                    pipe = new NamedPipeServerStream(
                        _pipeName,
                        PipeDirection.InOut,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous,
                        4096,
                        4096,
                        pipeSec);

                    var ar = pipe.BeginWaitForConnection(null, null);
                    int idx = WaitHandle.WaitAny(new[] { ar.AsyncWaitHandle, _shutdownCts.Token.WaitHandle });
                    if (idx == 1) {
                        pipe.Dispose();
                        break;
                    }
                    pipe.EndWaitForConnection(ar);
                    var accepted = pipe;
                    pipe = null;
                    ThreadPool.QueueUserWorkItem(_ => HandlePipeClient(accepted));
                } catch {
                    try { pipe?.Dispose(); } catch { }
                    if (_shutdownCts.IsCancellationRequested) break;
                    Thread.Sleep(50);
                }
            }
        }

        private void HandlePipeClient(NamedPipeServerStream pipe) {
            using (pipe)
            using (var reader = new StreamReader(pipe, Utf8NoBom, false, 4096, true))
            using (var writer = new StreamWriter(pipe, Utf8NoBom, 4096, true) { AutoFlush = true }) {
                try {
                    string line;
                    while ((line = reader.ReadLine()) != null) {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        JObject req;
                        try { req = JObject.Parse(line); } catch {
                            writer.WriteLine(JsonConvert.SerializeObject(new { status = 400, body = new { error = "Malformed JSON frame." } }));
                            continue;
                        }
                        string method = (req["method"]?.Value<string>() ?? "GET").ToUpperInvariant();
                        string path = (req["path"]?.Value<string>() ?? "/v1/hello").TrimEnd('/');
                        var body = req["body"] as JObject ?? new JObject();
                        var (status, respJson) = DispatchProtocolCommand(method, path, body, viaTrustedChannel: true);
                        writer.WriteLine(JsonConvert.SerializeObject(new { status, body = respJson }, Formatting.None));
                    }
                } catch { }
            }
        }

        public (int status, JObject body) DispatchProtocolCommand(string method, string path, JObject body, bool viaTrustedChannel) {
            try {
                if (method == "GET" && path == "/v1/hello") {
                    return (200, new JObject {
                        ["protocolVersion"] = ProtocolConstants.Version,
                        ["harnessVersion"] = ProtocolConstants.HarnessVersion,
                        ["pid"] = Process.GetCurrentProcess().Id,
                        ["capabilities"] = new JArray("sessions", "sse", "fork", "idempotency", "blobs", "mock_provider", "local_only"),
                        ["transports"] = new JArray("pipe", "http"),
                        ["authMode"] = viaTrustedChannel ? "pipe_acl" : "bearer"
                    });
                }

                if (method == "GET" && path == "/v1/tools") {
                    return (200, new JObject { ["tools"] = _engine.ListToolsJson() });
                }

                if (method == "GET" && path == "/v1/routes") {
                    return (200, new JObject { ["mutatingRoutes"] = GetDeclaredMutatingRoutes() });
                }

                if (method == "GET" && path == "/v1/migration/notices") {
                    return (200, new JObject { ["notices"] = CloudRemovalMigration.GetActiveNotices(_appDataDir) });
                }
                if (method == "POST" && path == "/v1/migration/notices/dismiss") {
                    string nid = body["id"]?.Value<string>() ?? "";
                    bool dismissed = CloudRemovalMigration.DismissNotice(_appDataDir, nid);
                    return (200, new JObject { ["ok"] = true, ["dismissed"] = dismissed });
                }

                // Network Policy, Offline Mode, and Append-Only Egress Ledger
                if (method == "GET" && path == "/v1/network/policy") {
                    return (200, EgressHttpFactory.GetPolicy());
                }
                if (method == "POST" && path == "/v1/network/offline") {
                    bool offline = body["offline"]?.Value<bool>() ?? true;
                    return EgressHttpFactory.SetOfflineMode(offline, viaTrustedChannel);
                }
                if (method == "POST" && path == "/v1/network/features") {
                    string feat = body["feature"]?.Value<string>() ?? "";
                    bool enabled = body["enabled"]?.Value<bool>() ?? false;
                    return EgressHttpFactory.SetFeatureEnabled(feat, enabled, viaTrustedChannel);
                }
                if (method == "GET" && path == "/v1/network/ledger") {
                    int limit = body["limit"]?.Value<int>() ?? 200;
                    return (200, new JObject {
                        ["entries"] = EgressHttpFactory.ReadLedger(limit),
                        ["offlineMode"] = EgressHttpFactory.IsOfflineMode
                    });
                }
                if (method == "GET" && path == "/v1/network/ledger/export") {
                    return (200, new JObject {
                        ["format"] = "jsonl",
                        ["content"] = EgressHttpFactory.ExportLedgerJsonl()
                    });
                }

                // Workspace Trust (content-hashed, trusted-channel gated)
                if (method == "GET" && path == "/v1/workspace/trust") {
                    string ws = body["workspace"]?.Value<string>() ?? "";
                    return (200, _engine.WorkspaceTrust.GetTrustStatus(ws));
                }
                if (method == "POST" && path == "/v1/workspace/trust") {
                    string ws = body["workspace"]?.Value<string>() ?? "";
                    string hash = body["contentHash"]?.Value<string>() ?? "";
                    return _engine.WorkspaceTrust.TrustWorkspace(ws, hash, viaTrustedChannel);
                }
                if (method == "DELETE" && path == "/v1/workspace/trust") {
                    string ws = body["workspace"]?.Value<string>() ?? "";
                    return (200, _engine.WorkspaceTrust.RevokeTrust(ws));
                }

                // Part A1/A3: Workspaces Registry, Root Validation, Attention Inbox, Transfer, Export/Import & UI State API
                if (method == "GET" && path == "/v1/attention") {
                    return (200, _engine.GetAttentionInbox());
                }

                // Part B2: Feed Pane Host Policy, Consent, Presets & Profile API
                if (method == "GET" && path == "/v1/feed/status") {
                    return (200, _engine.Feed.GetStatus());
                }
                if (method == "POST" && path == "/v1/feed/enable") {
                    bool consent = body["consentAccepted"]?.Value<bool>() ?? false;
                    bool? inPriv = body["inPrivateMode"] != null ? (bool?)body["inPrivateMode"].Value<bool>() : null;
                    string presetId = body["presetId"]?.Value<string>();
                    return _engine.Feed.EnableFeed(consent, viaTrustedChannel, inPriv, presetId);
                }
                if (method == "POST" && path == "/v1/feed/disable") {
                    return _engine.Feed.DisableFeed();
                }
                if (method == "POST" && path == "/v1/feed/settings") {
                    string presetId = body["activePresetId"]?.Value<string>();
                    bool? inPriv = body["inPrivateMode"] != null ? (bool?)body["inPrivateMode"].Value<bool>() : null;
                    int? idleMin = body["idleDestroyMinutes"] != null ? (int?)body["idleDestroyMinutes"].Value<int>() : null;
                    bool? dbg = body["debugLogBlocked"] != null ? (bool?)body["debugLogBlocked"].Value<bool>() : null;
                    return _engine.Feed.SelectPreset(presetId, inPriv, idleMin, dbg);
                }
                if (method == "POST" && path == "/v1/feed/presets/custom") {
                    return _engine.Feed.AddCustomPresetOrDomain(body, viaTrustedChannel);
                }
                if (method == "POST" && path == "/v1/feed/profile/clear") {
                    return _engine.Feed.ClearFeedProfile();
                }
                if (method == "POST" && path == "/v1/feed/policy/check") {
                    string url = body["url"]?.Value<string>() ?? "";
                    string presetId = body["presetId"]?.Value<string>();
                    bool skipDns = body["skipDnsLookup"]?.Value<bool>() ?? false;
                    var dec = _engine.Feed.EvaluateRequest(url, presetId, skipDns);
                    if (dec.Allowed && body["recordSummary"]?.Value<bool>() == true) {
                        _engine.Feed.RecordHostTransfer(dec.Host, body["approxBytes"]?.Value<long>() ?? 256);
                    }
                    return (200, dec.ToJson());
                }
                if (method == "GET" && path == "/v1/workspaces") {
                    bool includeArchived = body["includeArchived"]?.Value<bool>() ?? false;
                    return (200, _engine.Workspaces.ListWorkspaces(includeArchived));
                }
                if (method == "POST" && path == "/v1/workspaces/validate-root") {
                    string rootPath = body["rootPath"]?.Value<string>() ?? "";
                    string excludeId = body["excludeWorkspaceId"]?.Value<string>();
                    var vres = _engine.Workspaces.ValidateRootPath(rootPath, excludeId);
                    return (vres.Ok ? 200 : (vres.Code == "workspace_root_overlap" ? 409 : 400), vres.ToJson());
                }
                if (method == "POST" && path == "/v1/workspaces/transfer") {
                    return _engine.TransferBetweenWorkspaces(body, viaTrustedChannel);
                }
                if (method == "POST" && path == "/v1/workspaces/import") {
                    var bundle = body["bundle"] as JObject ?? body;
                    return _engine.ImportWorkspaceData(
                        bundle,
                        body["name"]?.Value<string>(),
                        body["rootPath"]?.Value<string>());
                }
                if (method == "POST" && path == "/v1/workspaces/resolve") {
                    string sel = (body["selector"]?.Value<string>() ?? "").Trim();
                    bool autoCreate = body["create"]?.Value<bool>() ?? false;
                    var existing = _engine.Workspaces.ResolveSelector(sel);
                    if (existing != null) return (200, existing.ToPublicJson());
                    if (!autoCreate) {
                        return (404, new JObject {
                            ["error"] = $"Unknown workspace '{sel}'. Pass --create to register a new workspace.",
                            ["code"] = "workspace_not_found"
                        });
                    }
                    string derivedName = Path.GetFileName(sel.TrimEnd('\\', '/'));
                    if (string.IsNullOrWhiteSpace(derivedName)) derivedName = "Workspace";
                    return _engine.Workspaces.CreateWorkspace(derivedName, sel);
                }
                if (method == "POST" && path == "/v1/workspaces") {
                    string name = body["name"]?.Value<string>() ?? "";
                    string rootPath = body["rootPath"]?.Value<string>();
                    string color = body["color"]?.Value<string>() ?? "#6366f1";
                    string icon = body["icon"]?.Value<string>() ?? "folder";
                    string copyFrom = body["copySettingsFromId"]?.Value<string>();
                    var overrides = body["settingsOverrides"]?.ToObject<WorkspaceSettingsOverrides>();
                    return _engine.Workspaces.CreateWorkspace(name, rootPath, color, icon, copyFrom, overrides);
                }
                if (path.StartsWith("/v1/workspaces/")) {
                    string rest = path.Substring("/v1/workspaces/".Length);
                    string[] parts = rest.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 1) {
                        string wsId = parts[0];
                        if (method == "GET") {
                            var rec = _engine.Workspaces.GetById(wsId);
                            if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                            return (200, rec.ToPublicJson());
                        }
                        if (method == "PUT" || method == "PATCH") {
                            return _engine.Workspaces.UpdateWorkspace(wsId, body);
                        }
                    } else if (parts.Length == 2) {
                        string wsId = parts[0];
                        string action = parts[1];
                        if (method == "POST" && action == "rename") {
                            return _engine.Workspaces.RenameWorkspace(wsId, body["name"]?.Value<string>() ?? "");
                        }
                        if (method == "POST" && action == "relocate") {
                            return _engine.Workspaces.RelocateWorkspace(wsId, body["rootPath"]?.Value<string>() ?? "");
                        }
                        if (method == "POST" && action == "archive") {
                            bool arch = body["archived"]?.Value<bool>() ?? true;
                            return _engine.Workspaces.UpdateWorkspace(wsId, new JObject { ["archived"] = arch });
                        }
                        if (method == "POST" && action == "delete") {
                            string confirmName = body["confirmName"]?.Value<string>() ?? "";
                            return _engine.Workspaces.DeleteWorkspace(wsId, confirmName, viaTrustedChannel);
                        }
                        if (method == "GET" && action == "ui-state") {
                            var st = _engine.Workspaces.LoadUiState(wsId);
                            if (st == null) return (404, new JObject { ["error"] = "Workspace not found." });
                            return (200, st);
                        }
                        if ((method == "POST" || method == "PUT") && action == "ui-state") {
                            return _engine.Workspaces.SaveUiState(wsId, body);
                        }
                        if (method == "GET" && action == "vault") {
                            if (_engine.Workspaces.GetById(wsId) == null) return (404, new JObject { ["error"] = "Workspace not found." });
                            return (200, _engine.Vault.List(wsId));
                        }
                        if (method == "GET" && action == "export") {
                            return _engine.ExportWorkspaceData(wsId);
                        }
                    } else if (parts.Length == 3 && parts[1] == "vault") {
                        string wsId = parts[0];
                        string sub = parts[2];
                        if (method == "POST" && sub == "documents") {
                            return _engine.Vault.AddDocument(
                                wsId,
                                body["title"]?.Value<string>() ?? "",
                                body["collection"]?.Value<string>() ?? "General",
                                body["content"]?.Value<string>() ?? "");
                        }
                        if (method == "POST" && sub == "search") {
                            if (_engine.Workspaces.GetById(wsId) == null) return (404, new JObject { ["error"] = "Workspace not found." });
                            return (200, new JObject {
                                ["workspaceId"] = wsId,
                                ["results"] = _engine.Vault.Search(wsId, body["query"]?.Value<string>() ?? "")
                            });
                        }
                    } else if (parts.Length == 4 && parts[1] == "vault" && parts[2] == "documents" && method == "DELETE") {
                        return _engine.Vault.DeleteDocument(parts[0], parts[3]);
                    }
                }

                // Memory Editor & Provenance API (workspace tier + opt-in global tier)
                if (method == "GET" && path == "/v1/memory") {
                    string wsId = body["workspaceId"]?.Value<string>();
                    bool includeGlobal = string.Equals(body["includeGlobal"]?.ToString(), "true", StringComparison.OrdinalIgnoreCase);
                    return (200, _engine.Memory.ListAll(wsId, includeGlobal));
                }
                if (method == "GET" && path == "/v1/memory/export") {
                    string wsId = body["workspaceId"]?.Value<string>();
                    return (200, new JObject { ["format"] = "json", ["content"] = _engine.Memory.ExportJson(wsId) });
                }
                if (method == "POST" && path == "/v1/memory") {
                    string content = body["content"]?.Value<string>() ?? "";
                    string category = body["category"]?.Value<string>() ?? "fact";
                    bool pinned = body["pinned"]?.Value<bool>() ?? false;
                    string wsId = body["workspaceId"]?.Value<string>();
                    string scope = body["scope"]?.Value<string>();
                    var entry = _engine.Memory.Save(content, category, "user", "", pinned, wsId, scope);
                    return (201, entry);
                }
                if (path.StartsWith("/v1/memory/")) {
                    string memId = path.Substring("/v1/memory/".Length).Trim('/');
                    string wsId = body["workspaceId"]?.Value<string>();
                    string scope = body["scope"]?.Value<string>();
                    if (!string.IsNullOrEmpty(memId) && !memId.Contains("/")) {
                        if (method == "PUT" || method == "POST") return _engine.Memory.Update(memId, body, wsId);
                        if (method == "DELETE") return _engine.Memory.Delete(memId, wsId, scope);
                    }
                }

                if (method == "GET" && path == "/v1/agents") {
                    return (200, new JObject { ["agents"] = _engine.ListAgents() });
                }

                if (method == "GET" && path == "/v1/worktrees") {
                    return (200, new JObject { ["worktrees"] = _engine.Worktrees.ListWorktrees() });
                }

                // MCP Server Management (Job-Object supervised, trusted-channel first-run approval)
                if (method == "GET" && path == "/v1/mcp/servers") {
                    return (200, new JObject { ["servers"] = _engine.Mcp.ListServers(body["workspaceId"]?.Value<string>()) });
                }
                if (method == "POST" && path == "/v1/mcp/servers") {
                    var cfg = body.ToObject<McpServerConfig>();
                    return _engine.Mcp.RegisterServer(cfg, viaTrustedChannel);
                }
                if (path.StartsWith("/v1/mcp/servers/")) {
                    string rest = path.Substring("/v1/mcp/servers/".Length);
                    string[] parts = rest.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 1 && method == "DELETE") {
                        return _engine.Mcp.DeleteServer(parts[0], viaTrustedChannel);
                    }
                    if (parts.Length == 2 && method == "POST") {
                        if (parts[1] == "discover") return _engine.Mcp.DiscoverAndRegisterTools(parts[0]);
                        if (parts[1] == "restart") return (200, _engine.Mcp.RestartServer(parts[0]));
                    }
                }

                // Extensions (.sanctum/ agents, skills, commands, hooks, packs)
                if (method == "GET" && path == "/v1/extensions") {
                    string ws = body["workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    return (200, _engine.Extensions.Discover(ws));
                }
                if (method == "POST" && path == "/v1/extensions/hooks/approve") {
                    string ws = body["workspace"]?.Value<string>() ?? "";
                    return _engine.Extensions.ApproveWorkspaceHooks(ws, viaTrustedChannel);
                }

                // Scheduler (unattended:true fail-closed runs)
                if (method == "GET" && path == "/v1/schedules") {
                    string wsId = body["workspaceId"]?.Value<string>();
                    bool allWs = string.Equals(body["allWorkspaces"]?.ToString(), "true", StringComparison.OrdinalIgnoreCase);
                    return (200, new JObject { ["jobs"] = _engine.Scheduler.ListJobs(wsId, allWs) });
                }
                if (method == "POST" && path == "/v1/schedules") {
                    var job = body.ToObject<ScheduledJob>();
                    return _engine.Scheduler.AddJob(job, viaTrustedChannel);
                }
                if (path.StartsWith("/v1/schedules/")) {
                    string rest = path.Substring("/v1/schedules/".Length);
                    string[] parts = rest.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 1 && method == "DELETE") {
                        return _engine.Scheduler.DeleteJob(parts[0], viaTrustedChannel);
                    }
                    if (parts.Length == 2 && method == "POST" && parts[1] == "run") {
                        return _engine.Scheduler.TriggerJobNow(parts[0]);
                    }
                }

                if (method == "GET" && path == "/v1/rules") {
                    return (200, new JObject { ["rules"] = _engine.Permissions.ListRules(body["workspaceId"]?.Value<string>()) });
                }

                if (method == "POST" && path == "/v1/rules") {
                    var rule = body.ToObject<PermissionRule>();
                    return _engine.Permissions.AddRule(rule, viaTrustedChannel);
                }

                if (method == "GET" && path == "/v1/audit") {
                    int limit = 100;
                    int.TryParse(body["limit"]?.ToString() ?? "100", out limit);
                    return (200, new JObject { ["entries"] = _engine.Audit.ReadRecent(limit) });
                }

                if (method == "GET" && path == "/v1/security/encryption") {
                    return (200, DataAtRestCrypto.GetStatus());
                }
                if (method == "POST" && path == "/v1/security/encryption") {
                    bool enabled = body["enabled"]?.Value<bool>() ?? false;
                    return DataAtRestCrypto.SetDpapiEnabled(enabled, viaTrustedChannel);
                }

                if (method == "GET" && path == "/v1/export") {
                    var bundle = _engine.Store.ExportBundle();
                    bundle["rules"] = _engine.Permissions.ListRules();
                    bundle["schedules"] = _engine.Scheduler.ListJobs();
                    bundle["memory"] = _engine.Memory.ListAll();
                    string passphrase = body["passphrase"]?.Value<string>();
                    if (!string.IsNullOrEmpty(passphrase)) {
                        string encrypted = DataAtRestCrypto.EncryptWithPassphrase(bundle.ToString(Formatting.None), passphrase);
                        return (200, new JObject { ["encrypted"] = true, ["format"] = "SANCTUM_PBKDF2_V1", ["archive"] = encrypted });
                    }
                    return (200, bundle);
                }

                if (method == "POST" && path == "/v1/import") {
                    if (body["archive"] != null) {
                        string archive = body["archive"].Value<string>() ?? "";
                        string passphrase = body["passphrase"]?.Value<string>() ?? "";
                        string decrypted = DataAtRestCrypto.DecryptWithPassphrase(archive, passphrase);
                        var parsed = CanonicalJson.ParseObject(decrypted);
                        return (200, _engine.Store.ImportBundle(parsed));
                    }
                    return (200, _engine.Store.ImportBundle(body));
                }

                if (method == "POST" && path == "/v1/erase-all") {
                    bool confirmed = string.Equals(body["confirm"]?.Value<string>(), "ERASE_ALL_DATA", StringComparison.Ordinal);
                    if (!viaTrustedChannel && !confirmed) {
                        return (403, new JObject {
                            ["error"] = "Erase all data requires trusted channel or confirm='ERASE_ALL_DATA'.",
                            ["code"] = "confirmation_required"
                        });
                    }
                    _engine.InterruptAllRuns();
                    var erased = _engine.Store.EraseAll();
                    var wipedTargets = new JArray("sessions", "blobs");
                    string[] filesToWipe = new[] {
                        "audit.jsonl", "egress_ledger.jsonl", "memory.json", "threads.json",
                        "settings.json", "workspace_trust.json", "network_policy.json",
                        "migration_notices.json", "approved_hooks.json", "permission_rules.json",
                        "schedules.json", "mcp_servers.json", "encryption_config.json",
                        "workspaces.json", "workspaces.json.bak", "migration_state.json",
                        "feed_config.json", "feed_presets.json"
                    };
                    foreach (string f in filesToWipe) {
                        try {
                            string p = Path.Combine(_appDataDir, f);
                            if (File.Exists(p)) { File.Delete(p); wipedTargets.Add(f); }
                        } catch { }
                    }
                    string[] dirsToWipe = new[] {
                        "checkpoints", "shadow-git", "vault", "logs", "tool-trash", "backups", "exports", "webview2", "browser-profile", "workspaces", "feed-profile"
                    };
                    foreach (string d in dirsToWipe) {
                        try {
                            string p = Path.Combine(_appDataDir, d);
                            if (Directory.Exists(p)) { Directory.Delete(p, true); wipedTargets.Add(d); }
                        } catch { }
                    }
                    // Also wipe LocalAppData WebView2 / browser-profile if caller didn't override to isolated temp dir
                    try {
                        string defaultAppData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sanctum");
                        if (string.Equals(Path.GetFullPath(_appDataDir).TrimEnd('\\'), Path.GetFullPath(defaultAppData).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) {
                            string localSanctum = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Sanctum");
                            foreach (string ld in new[] { "webview2", "EBWebView", "browser-profile" }) {
                                string lp = Path.Combine(localSanctum, ld);
                                if (Directory.Exists(lp)) { try { Directory.Delete(lp, true); wipedTargets.Add("local:" + ld); } catch { } }
                            }
                        }
                    } catch { }
                    erased["wipedTargets"] = wipedTargets;
                    erased["erased"] = true;
                    return (200, erased);
                }

                if (method == "POST" && path == "/v1/untrusted/wrap") {
                    string kind = body["kind"]?.Value<string>() ?? "file";
                    string label = body["label"]?.Value<string>() ?? "";
                    string raw = body["content"]?.Value<string>() ?? "";
                    return (200, new JObject { ["wrapped"] = UntrustedContent.Wrap(kind, label, raw) });
                }

                if (path.StartsWith("/v1/tasks/")) {
                    string rest = path.Substring("/v1/tasks/".Length);
                    string[] parts = rest.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 2) {
                        string taskId = parts[0];
                        string action = parts[1];
                        if (method == "GET" && action == "output") {
                            return (200, _engine.Tasks.ReadOutput(taskId));
                        }
                        if (method == "POST" && action == "kill") {
                            return (200, _engine.Tasks.KillTask(taskId));
                        }
                    }
                }

                if (method == "GET" && path.StartsWith("/v1/capabilities/")) {
                    string model = Uri.UnescapeDataString(path.Substring("/v1/capabilities/".Length).Trim('/'));
                    var caps = _engine.Provider.GetCapabilities(model);
                    var tier = _engine.TierManager.ResolveTier(model, caps, null);
                    return (200, new JObject {
                        ["provider"] = _engine.Provider.Name,
                        ["model"] = model,
                        ["capabilities"] = JObject.FromObject(caps),
                        ["tierProfile"] = JObject.FromObject(tier)
                    });
                }

                if (method == "GET" && path == "/v1/evals") {
                    return (200, new JObject { ["models"] = _engine.TierManager.LoadAllEvals() });
                }
                if (method == "POST" && path == "/v1/evals/record") {
                    string model = body["model"]?.Value<string>() ?? "";
                    if (string.IsNullOrWhiteSpace(model)) return (400, new JObject { ["error"] = "model is required" });
                    _engine.TierManager.SaveModelEval(model, body);
                    return (200, new JObject { ["ok"] = true, ["model"] = model });
                }

                if (method == "POST" && path.StartsWith("/v1/approvals/")) {
                    string approvalId = path.Substring("/v1/approvals/".Length).Trim('/');
                    bool approved = body["approved"]?.Value<bool>() ?? false;
                    string scope = body["scope"]?.Value<string>() ?? "once";
                    string callId = body["callId"]?.Value<string>();
                    string argsSha = body["argsSha256"]?.Value<string>();
                    return _engine.Permissions.ResolveApproval(approvalId, approved, scope, callId, argsSha, viaTrustedChannel);
                }

                if (method == "GET" && path == "/v1/sessions") {
                    bool allWs = string.Equals(body["allWorkspaces"]?.ToString(), "true", StringComparison.OrdinalIgnoreCase);
                    string reqWsId = body["workspaceId"]?.Value<string>();
                    string effectiveWsId = allWs ? null : (string.IsNullOrWhiteSpace(reqWsId) ? _engine.Workspaces.LastUsedWorkspaceId : reqWsId.Trim());
                    return (200, new JObject {
                        ["workspaceId"] = effectiveWsId ?? "",
                        ["allWorkspaces"] = allWs,
                        ["sessions"] = JArray.FromObject(_engine.ListSessions(effectiveWsId, allWs))
                    });
                }

                if (method == "POST" && path == "/v1/sessions") {
                    var s = _engine.CreateSession(
                        body["title"]?.Value<string>(),
                        body["workspace"]?.Value<string>(),
                        body["mode"]?.Value<string>(),
                        body["autonomy"]?.Value<string>(),
                        body["model"]?.Value<string>(),
                        body["unattended"]?.Value<bool>() ?? false,
                        workspaceId: body["workspaceId"]?.Value<string>());
                    int reqNumCtx = body["numCtx"]?.Value<int>() ?? 0;
                    if (reqNumCtx > 0) _engine.SetSessionNumCtx(s.SessionId, reqNumCtx);
                    if (body["think"] != null) _engine.SetSessionThink(s.SessionId, body["think"].Value<bool>());
                    return (201, JObject.FromObject(s));
                }

                if (method == "GET" && path.StartsWith("/v1/blobs/")) {
                    string sha = path.Substring("/v1/blobs/".Length).Trim('/');
                    string content = _engine.Store.ReadBlob(sha);
                    if (content == null) return (404, new JObject { ["error"] = "Blob not found." });
                    return (200, new JObject { ["blobRef"] = sha, ["content"] = content });
                }

                if (path.StartsWith("/v1/sessions/")) {
                    string rest = path.Substring("/v1/sessions/".Length);
                    string[] parts = rest.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 0) return (404, new JObject { ["error"] = "Not found." });
                    string sessionId = parts[0];

                    // Part A2: Verify session workspace ownership whenever workspaceId is supplied
                    string reqWsId = body["workspaceId"]?.Value<string>();
                    if (!string.IsNullOrWhiteSpace(reqWsId)) {
                        var ownerSum = _engine.GetSessionSummary(sessionId);
                        if (ownerSum != null && !string.IsNullOrEmpty(ownerSum.WorkspaceId) &&
                            !string.Equals(ownerSum.WorkspaceId, reqWsId.Trim(), StringComparison.OrdinalIgnoreCase)) {
                            return (403, new JObject {
                                ["error"] = "Session does not belong to the specified workspace.",
                                ["code"] = "workspace_mismatch"
                            });
                        }
                    }

                    if (parts.Length == 1 && method == "GET") {
                        var sum = _engine.GetSessionSummary(sessionId);
                        if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                        var evts = _engine.Store.ReadEvents(sessionId, 0);
                        return (200, new JObject {
                            ["session"] = JObject.FromObject(sum),
                            ["events"] = JArray.FromObject(evts)
                        });
                    }

                    if (parts.Length == 2 && method == "GET") {
                        string action = parts[1];
                        if (action == "diff") {
                            string cpId = body["checkpointId"]?.Value<string>() ?? "";
                            return (200, _engine.ComputeDiff(sessionId, cpId));
                        }
                        if (action == "tasks") {
                            return (200, new JObject { ["tasks"] = _engine.Tasks.ListTasks(sessionId) });
                        }
                        if (action == "todos") {
                            return (200, new JObject { ["sessionId"] = sessionId, ["items"] = _engine.GetTodos(sessionId) });
                        }
                        if (action == "context") {
                            var sum = _engine.GetSessionSummary(sessionId);
                            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                            bool wsTrusted = _engine.WorkspaceTrust.IsWorkspaceTrusted(sum.Workspace);
                            var budget = _engine.GetContextBudgetInfo(sessionId);
                            return (200, new JObject {
                                ["sessionId"] = sessionId,
                                ["workspaceTrusted"] = wsTrusted,
                                ["numCtx"] = budget["numCtx"],
                                ["modelMaxContext"] = budget["modelMaxContext"],
                                ["estimatedTokens"] = budget["estimatedTokens"],
                                ["utilizationPct"] = budget["utilizationPct"],
                                ["nearTruncation"] = budget["nearTruncation"],
                                ["instructions"] = wsTrusted ? ContextEngine.LoadInstructions(sum.Workspace) : new JObject { ["files"] = new JArray(), ["combined"] = "", ["blockedUntrusted"] = true },
                                ["repoMap"] = ContextEngine.BuildRepoMap(sum.Workspace, 120),
                                ["todos"] = _engine.GetTodos(sessionId)
                            });
                        }
                    }

                    if (parts.Length == 2 && method == "DELETE") {
                        if (parts[1] == "worktree") {
                            var sum = _engine.GetSessionSummary(sessionId);
                            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                            return (200, _engine.Worktrees.RemoveWorktree(sum.Workspace, sessionId));
                        }
                    }

                    if (parts.Length == 2 && method == "POST") {
                        string action = parts[1];
                        if (action == "compact") {
                            int keep = body["keepRecentMessages"]?.Value<int>() ?? 2;
                            return (200, _engine.CompactSession(sessionId, keep));
                        }
                        if (action == "todos") {
                            var items = body["items"] as JArray ?? new JArray();
                            _engine.UpdateTodos(sessionId, items);
                            return (200, new JObject { ["sessionId"] = sessionId, ["items"] = _engine.GetTodos(sessionId) });
                        }
                        if (action == "verify") {
                            string cmd = body["command"]?.Value<string>();
                            if (string.IsNullOrWhiteSpace(cmd)) {
                                var sumV = _engine.GetSessionSummary(sessionId);
                                if (sumV == null) return (404, new JObject { ["error"] = "Session not found." });
                                return (200, ProjectVerifier.DiscoverCommands(sumV.Workspace));
                            }
                            return _engine.VerifySession(sessionId, cmd, viaTrustedChannel);
                        }
                        if (action == "plan") {
                            var sumP = _engine.GetSessionSummary(sessionId);
                            if (sumP == null) return (404, new JObject { ["error"] = "Session not found." });
                            string planText = body["content"]?.Value<string>() ?? "";
                            if (string.IsNullOrWhiteSpace(planText)) return (400, new JObject { ["error"] = "Plan content is required." });
                            string planPath = PermissionEngine.ResolveToolPath(sumP.Workspace, "PLAN.md", allowRoot: false);
                            File.WriteAllText(planPath, planText, Utf8NoBom);
                            var check = ProjectVerifier.VerifyPlanAgainstChanges(planText, new string[0]);
                            return (200, new JObject {
                                ["saved"] = true,
                                ["path"] = "PLAN.md",
                                ["sha256"] = CanonicalJson.Sha256Hex(planText),
                                ["verification"] = check
                            });
                        }
                        if (action == "subagents") {
                            string role = body["role"]?.Value<string>() ?? "worker";
                            string prompt = body["prompt"]?.Value<string>() ?? "";
                            string model = body["model"]?.Value<string>();
                            string mode = body["mode"]?.Value<string>();
                            bool wt = body["worktree"]?.Value<bool>() ?? false;
                            return (201, _engine.SpawnSubagentAndWait(sessionId, role, prompt, model, mode, wt, _shutdownCts.Token));
                        }
                        if (action == "worktree") {
                            var sum = _engine.GetSessionSummary(sessionId);
                            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                            return (201, _engine.Worktrees.CreateWorktree(sum.Workspace, sessionId));
                        }
                        if (action == "mentions") {
                            var sum = _engine.GetSessionSummary(sessionId);
                            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                            return (200, ContextEngine.ResolveMentions(sum.Workspace, body["prompt"]?.Value<string>() ?? ""));
                        }
                        if (action == "checkpoints") {
                            var cp = _engine.CreateCheckpoint(sessionId, body["label"]?.Value<string>());
                            return (201, cp);
                        }
                        if (action == "rewind") {
                            string scope = body["scope"]?.Value<string>() ?? "files";
                            string cpId = body["checkpointId"]?.Value<string>();
                            long? forkAfter = body["forkAfterSeq"]?.Value<long?>();
                            return (200, _engine.Rewind(sessionId, scope, cpId, forkAfter));
                        }
                        if (action == "tasks") {
                            string cmd = body["command"]?.Value<string>() ?? "";
                            return _engine.StartBackgroundTask(sessionId, cmd, viaTrustedChannel);
                        }
                        if (action == "messages") {
                            string content = body["content"]?.Value<string>() ?? "";
                            string idem = body["idempotencyKey"]?.Value<string>();
                            var budgets = body["budgets"]?.ToObject<RunBudgets>() ?? new RunBudgets();
                            var (_, code, resp) = _engine.StartRun(sessionId, content, budgets, idem);
                            return (code, resp);
                        }
                        if (action == "interrupt") {
                            string idem = body["idempotencyKey"]?.Value<string>();
                            if (_engine.TryGetIdempotentResult(sessionId, idem, out var cached)) return (200, cached);
                            bool cancelled = _engine.InterruptRun(sessionId);
                            var resp = new JObject { ["sessionId"] = sessionId, ["interrupted"] = cancelled };
                            _engine.RecordIdempotentResult(sessionId, idem, resp);
                            return (200, resp);
                        }
                        if (action == "mode") {
                            _engine.SetMode(sessionId, body["mode"]?.Value<string>() ?? "");
                            return (200, new JObject { ["sessionId"] = sessionId, ["mode"] = body["mode"] });
                        }
                        if (action == "autonomy") {
                            _engine.SetAutonomy(sessionId, body["autonomy"]?.Value<string>() ?? "", viaTrustedChannel);
                            return (200, new JObject { ["sessionId"] = sessionId, ["autonomy"] = body["autonomy"] });
                        }
                        if (action == "model") {
                            _engine.SetModel(sessionId, body["model"]?.Value<string>() ?? "");
                            return (200, new JObject { ["sessionId"] = sessionId, ["model"] = body["model"] });
                        }
                        if (action == "tier") {
                            string tierVal = body["tier"]?.Value<string>() ?? "auto";
                            _engine.SetSessionTierOverride(sessionId, tierVal);
                            var sumT = _engine.GetSessionSummary(sessionId);
                            var prof = _engine.GetEffectiveTier(sessionId, sumT?.Model ?? "mock");
                            return (200, JObject.FromObject(prof));
                        }
                        if (action == "a2ui-action") {
                            return _engine.HandleA2uiUserAction(sessionId, body);
                        }
                        if (action == "fork") {
                            long afterSeq = body["forkAfterSeq"]?.Value<long>() ?? 1;
                            var forked = _engine.ForkSession(sessionId, afterSeq, body["title"]?.Value<string>());
                            return (201, JObject.FromObject(forked));
                        }
                    }
                }

                return (404, new JObject { ["error"] = "Unknown protocol route: " + method + " " + path });
            } catch (UnauthorizedAccessException uex) {
                return (403, new JObject { ["error"] = uex.Message, ["code"] = "trusted_channel_required" });
            } catch (KeyNotFoundException kex) {
                return (404, new JObject { ["error"] = kex.Message });
            } catch (ArgumentException aex) {
                return (400, new JObject { ["error"] = aex.Message });
            } catch (Exception ex) {
                return (500, new JObject { ["error"] = ex.Message });
            }
        }

        private static JArray GetDeclaredMutatingRoutes() {
            var routes = new (string method, string route, string approvalClass)[] {
                ("POST", "/v1/migration/notices/dismiss", "bearer_low_risk"),
                ("POST", "/v1/network/offline", "trusted_channel_on_disable"),
                ("POST", "/v1/network/features", "trusted_channel_on_enable"),
                ("POST", "/v1/workspace/trust", "trusted_channel_only"),
                ("DELETE", "/v1/workspace/trust", "fail_closed_revoke"),
                ("POST", "/v1/workspaces/validate-root", "bearer_low_risk"),
                ("POST", "/v1/workspaces/transfer", "trusted_channel_only"),
                ("POST", "/v1/workspaces/import", "bearer_low_risk"),
                ("POST", "/v1/workspaces/resolve", "bearer_low_risk"),
                ("POST", "/v1/feed/enable", "trusted_channel_only"),
                ("POST", "/v1/feed/disable", "bearer_low_risk"),
                ("POST", "/v1/feed/settings", "bearer_low_risk"),
                ("POST", "/v1/feed/presets/custom", "trusted_channel_only"),
                ("POST", "/v1/feed/profile/clear", "bearer_low_risk"),
                ("POST", "/v1/feed/policy/check", "bearer_low_risk"),
                ("POST", "/v1/workspaces", "bearer_low_risk"),
                ("PUT", "/v1/workspaces/:id", "bearer_low_risk"),
                ("PATCH", "/v1/workspaces/:id", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/rename", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/relocate", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/archive", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/delete", "trusted_channel_only"),
                ("POST", "/v1/workspaces/:id/ui-state", "bearer_low_risk"),
                ("PUT", "/v1/workspaces/:id/ui-state", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/vault/documents", "bearer_low_risk"),
                ("POST", "/v1/workspaces/:id/vault/search", "bearer_low_risk"),
                ("DELETE", "/v1/workspaces/:id/vault/documents/:docId", "bearer_low_risk"),
                ("POST", "/v1/memory", "bearer_user_crud"),
                ("PUT", "/v1/memory/:id", "bearer_user_crud"),
                ("DELETE", "/v1/memory/:id", "bearer_user_crud"),
                ("POST", "/v1/mcp/servers", "trusted_channel_only"),
                ("DELETE", "/v1/mcp/servers/:id", "trusted_channel_only"),
                ("POST", "/v1/mcp/servers/:id/discover", "bearer_low_risk"),
                ("POST", "/v1/mcp/servers/:id/restart", "bearer_low_risk"),
                ("POST", "/v1/extensions/hooks/approve", "trusted_channel_only"),
                ("POST", "/v1/schedules", "trusted_channel_only"),
                ("DELETE", "/v1/schedules/:id", "trusted_channel_only"),
                ("POST", "/v1/schedules/:id/run", "unattended_fail_closed"),
                ("POST", "/v1/rules", "trusted_channel_only"),
                ("POST", "/v1/security/encryption", "trusted_channel_only"),
                ("POST", "/v1/import", "bearer_low_risk"),
                ("POST", "/v1/erase-all", "trusted_or_explicit_confirm"),
                ("POST", "/v1/untrusted/wrap", "bearer_low_risk"),
                ("POST", "/v1/tasks/:id/kill", "bearer_low_risk"),
                ("POST", "/v1/approvals/:id", "call_bound_single_use"),
                ("POST", "/v1/sessions", "bearer_low_risk"),
                ("DELETE", "/v1/sessions/:id/worktree", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/messages", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/interrupt", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/mode", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/autonomy", "trusted_channel_on_full_auto"),
                ("POST", "/v1/sessions/:id/model", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/tier", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/a2ui-action", "untrusted_ui_event_only"),
                ("POST", "/v1/evals/record", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/fork", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/compact", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/checkpoints", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/rewind", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/tasks", "call_bound_command_rules"),
                ("POST", "/v1/sessions/:id/todos", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/verify", "call_bound_command_rules"),
                ("POST", "/v1/sessions/:id/plan", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/subagents", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/worktree", "bearer_low_risk"),
                ("POST", "/v1/sessions/:id/mentions", "bearer_low_risk"),
            };
            var arr = new JArray();
            foreach (var r in routes) {
                arr.Add(new JObject {
                    ["method"] = r.method,
                    ["route"] = r.route,
                    ["approvalClass"] = r.approvalClass
                });
            }
            return arr;
        }

        private static void WriteHttpJson(HttpListenerResponse res, int status, JObject payload) {
            byte[] bytes = Utf8NoBom.GetBytes(CanonicalJson.Serialize(payload));
            res.StatusCode = status;
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        public void Dispose() {
            if (_disposed) return;
            _disposed = true;
            _shutdownCts.Cancel();
            _engine.Dispose();
            try { _httpListener.Stop(); _httpListener.Close(); } catch { }
            try { if (File.Exists(_runtimeFile)) File.Delete(_runtimeFile); } catch { }
            _shutdownCts.Dispose();
        }
    }
}
