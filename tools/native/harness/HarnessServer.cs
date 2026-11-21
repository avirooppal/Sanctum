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
            Directory.CreateDirectory(_appDataDir);
            _httpListener.Start();
            WriteRuntimeFile();

            var httpThread = new Thread(HttpAcceptLoop) { IsBackground = true, Name = "HarnessHttpLoop" };
            httpThread.Start();

            var pipeThread = new Thread(PipeAcceptLoop) { IsBackground = true, Name = "HarnessPipeLoop" };
            pipeThread.Start();
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
                    HandleHttpSse(res, sessionId, afterSeq);
                    return;
                }

                string rawBody = "";
                if (method == "POST" || method == "PUT") {
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

                var (status, json) = DispatchProtocolCommand(method, path, bodyObj ?? new JObject(), viaTrustedChannel: false);
                WriteHttpJson(res, status, json);
            } catch (Exception ex) {
                try { WriteHttpJson(res, 500, new JObject { ["error"] = ex.Message }); } catch { }
            }
        }

        private void HandleHttpSse(HttpListenerResponse res, string sessionId, long afterSeq) {
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
                        ["capabilities"] = new JArray("sessions", "sse", "fork", "idempotency", "blobs", "mock_provider"),
                        ["transports"] = new JArray("pipe", "http"),
                        ["authMode"] = viaTrustedChannel ? "pipe_acl" : "bearer"
                    });
                }

                if (method == "GET" && path == "/v1/tools") {
                    return (200, new JObject { ["tools"] = _engine.ListToolsJson() });
                }

                if (method == "GET" && path == "/v1/sessions") {
                    return (200, new JObject { ["sessions"] = JArray.FromObject(_engine.ListSessions()) });
                }

                if (method == "POST" && path == "/v1/sessions") {
                    var s = _engine.CreateSession(
                        body["title"]?.Value<string>(),
                        body["workspace"]?.Value<string>(),
                        body["mode"]?.Value<string>(),
                        body["autonomy"]?.Value<string>(),
                        body["model"]?.Value<string>());
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

                    if (parts.Length == 1 && method == "GET") {
                        var sum = _engine.GetSessionSummary(sessionId);
                        if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
                        var evts = _engine.Store.ReadEvents(sessionId, 0);
                        return (200, new JObject {
                            ["session"] = JObject.FromObject(sum),
                            ["events"] = JArray.FromObject(evts)
                        });
                    }

                    if (parts.Length == 2 && method == "POST") {
                        string action = parts[1];
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
            _engine.InterruptAllRuns();
            try { _httpListener.Stop(); _httpListener.Close(); } catch { }
            try { if (File.Exists(_runtimeFile)) File.Delete(_runtimeFile); } catch { }
            _shutdownCts.Dispose();
        }
    }
}
