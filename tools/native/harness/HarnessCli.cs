using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Headless daemon & CLI client entrypoint for Sanctum Harness.
    /// Commands: --headless | run "<task>" | sessions | resume <id> | attach <id>
    /// </summary>
    public static class HarnessCli {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);

        [DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int dwProcessId);

        public static bool TryHandleEntrypoint(string[] args, out int exitCode) {
            exitCode = 0;
            if (args == null || args.Length == 0) return false;

            string cmd = args[0].Trim().ToLowerInvariant();
            if (cmd == "--parse-fixture") {
                try { AttachConsole(-1); } catch { }
                exitCode = RunParseFixture(args.Length > 1 ? args[1] : "");
                return true;
            }
            if (cmd == "--eval-permission-fixture") {
                try { AttachConsole(-1); } catch { }
                exitCode = RunEvalPermissionFixture(args.Length > 1 ? args[1] : "");
                return true;
            }
            if (cmd == "--bench-crypto") {
                try { AttachConsole(-1); } catch { }
                string payload = new string('A', 100 * 1024);
                var sw1 = Stopwatch.StartNew();
                string dpapi = DataAtRestCrypto.ProtectDpapi(payload);
                string dpapiBack = DataAtRestCrypto.UnprotectDpapi(dpapi);
                sw1.Stop();
                var sw2 = Stopwatch.StartNew();
                string enc = DataAtRestCrypto.EncryptWithPassphrase(payload, "correct-horse-battery-staple");
                string dec = DataAtRestCrypto.DecryptWithPassphrase(enc, "correct-horse-battery-staple");
                sw2.Stop();
                Console.WriteLine(JsonConvert.SerializeObject(new {
                    payloadBytes = payload.Length,
                    dpapiRoundtripMs = Math.Round(sw1.Elapsed.TotalMilliseconds, 2),
                    pbkdf2AesHmacRoundtripMs = Math.Round(sw2.Elapsed.TotalMilliseconds, 2),
                    dpapiOk = dpapiBack == payload,
                    pbkdf2Ok = dec == payload
                }));
                exitCode = (dpapiBack == payload && dec == payload) ? 0 : 1;
                return true;
            }
            if (cmd == "--eval-egress") {
                try { AttachConsole(-1); } catch { }
                string evalDataDir = GetArg(args, "--data-dir") ?? Path.Combine(Path.GetTempPath(), "sanctum-egress-eval");
                EgressHttpFactory.Initialize(evalDataDir);
                string url = args.Length > 1 ? args[1] : "";
                string featStr = args.Length > 2 ? args[2] : "Loopback";
                EgressFeature feat = EgressFeature.Loopback;
                Enum.TryParse(featStr, true, out feat);
                try {
                    EgressHttpFactory.CheckAllowed(url, feat, "eval");
                    Console.WriteLine(JsonConvert.SerializeObject(new { allowed = true, url = EgressHttpFactory.RedactUrl(new Uri(url)), feature = feat.ToString() }));
                    exitCode = 0;
                } catch (Exception ex) {
                    Console.WriteLine(JsonConvert.SerializeObject(new { allowed = false, error = ex.Message, feature = feat.ToString() }));
                    exitCode = 1;
                }
                return true;
            }
            if (cmd != "--harness" && cmd != "run" && cmd != "sessions" && cmd != "resume" && cmd != "attach") {
                return false;
            }

            try { AttachConsole(-1); } catch { }

            string dataDir = GetArg(args, "--data-dir")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sanctum");

            if (cmd == "--harness") {
                exitCode = RunHeadlessDaemon(args, dataDir);
                return true;
            }

            try {
                var runtime = EnsureDaemonRunning(dataDir, args);
                if (cmd == "sessions") {
                    var (st, body) = SendPipeCommand(runtime.PipeName, "GET", "/v1/sessions", new JObject());
                    Console.WriteLine(JsonConvert.SerializeObject(body, Formatting.None));
                    exitCode = st >= 200 && st < 300 ? 0 : 1;
                    return true;
                }
                if (cmd == "resume") {
                    if (args.Length < 2) { Console.Error.WriteLine("Usage: sanctum resume <sessionId>"); exitCode = 2; return true; }
                    var (st, body) = SendPipeCommand(runtime.PipeName, "GET", "/v1/sessions/" + args[1], new JObject());
                    Console.WriteLine(JsonConvert.SerializeObject(body, Formatting.None));
                    exitCode = st >= 200 && st < 300 ? 0 : 1;
                    return true;
                }
                if (cmd == "attach") {
                    if (args.Length < 2) { Console.Error.WriteLine("Usage: sanctum attach <sessionId>"); exitCode = 2; return true; }
                    long afterSeq = 0;
                    long.TryParse(GetArg(args, "--after") ?? "0", out afterSeq);
                    exitCode = StreamSseUntilFinished(runtime, args[1], afterSeq, HasFlag(args, "--json"));
                    return true;
                }
                if (cmd == "run") {
                    if (args.Length < 2) { Console.Error.WriteLine("Usage: sanctum run \"<task>\""); exitCode = 2; return true; }
                    string task = args[1];
                    string mode = GetArg(args, "--mode") ?? "build";
                    string autonomy = GetArg(args, "--autonomy") ?? "auto_reads";
                    string workspace = GetArg(args, "--workspace") ?? Environment.CurrentDirectory;
                    string model = GetArg(args, "--model") ?? "mock";
                    string provArg = GetArg(args, "--provider");
                    if (!string.IsNullOrWhiteSpace(provArg)) {
                        string pNorm = provArg.Trim().ToLowerInvariant();
                        if (pNorm != "ollama" && pNorm != "mock" && pNorm != "openai-local") {
                            Console.Error.WriteLine(JsonConvert.SerializeObject(new {
                                error = $"Unsupported provider '{provArg}'. Sanctum is local-only; allowed providers: ollama, openai-local, mock."
                            }));
                            exitCode = 2;
                            return true;
                        }
                    }
                    bool jsonOut = HasFlag(args, "--json");

                    var (st1, created) = SendPipeCommand(runtime.PipeName, "POST", "/v1/sessions", new JObject {
                        ["title"] = task.Length > 48 ? task.Substring(0, 48) : task,
                        ["workspace"] = workspace,
                        ["mode"] = mode,
                        ["autonomy"] = autonomy,
                        ["model"] = model
                    });
                    if (st1 < 200 || st1 >= 300) {
                        Console.Error.WriteLine(created.ToString(Formatting.None));
                        exitCode = 1;
                        return true;
                    }
                    string sessionId = created["sessionId"].Value<string>();
                    var (st2, runResp) = SendPipeCommand(runtime.PipeName, "POST", $"/v1/sessions/{sessionId}/messages", new JObject {
                        ["content"] = task,
                        ["idempotencyKey"] = "cli-" + Guid.NewGuid().ToString("N")
                    });
                    if (st2 < 200 || st2 >= 300) {
                        Console.Error.WriteLine(runResp.ToString(Formatting.None));
                        exitCode = 1;
                        return true;
                    }
                    exitCode = StreamSseUntilFinished(runtime, sessionId, 0, jsonOut);
                    return true;
                }
            } catch (Exception ex) {
                Console.Error.WriteLine(JsonConvert.SerializeObject(new { error = ex.Message }));
                exitCode = 1;
                return true;
            }
            return false;
        }

        private static int RunHeadlessDaemon(string[] args, string dataDir) {
            int port = 0;
            int.TryParse(GetArg(args, "--port") ?? "0", out port);
            string pipeName = GetArg(args, "--pipe");
            string mockScript = GetArg(args, "--mock-script");
            int idleSec = 0;
            int.TryParse(GetArg(args, "--idle-timeout-sec") ?? "0", out idleSec);

            string mutexName = "Local\\SanctumHarness-" + CanonicalJson.Sha256Hex(dataDir).Substring(0, 12);
            bool createdNew;
            using (var mutex = new Mutex(true, mutexName, out createdNew)) {
                if (!createdNew) {
                    Console.Error.WriteLine("Harness daemon already running for data dir: " + dataDir);
                    return 0;
                }

                var store = new SessionLogStore(dataDir);
                string providerName = (GetArg(args, "--provider") ?? "mock").ToLowerInvariant();
                string ollamaEndpoint = GetArg(args, "--ollama-endpoint") ?? "http://127.0.0.1:11434";
                string localBaseUrl = GetArg(args, "--base-url") ?? "http://127.0.0.1:1234/v1";
                IModelProvider provider;
                if (providerName == "ollama") {
                    provider = new OllamaModelProvider(ollamaEndpoint);
                } else if (providerName == "openai-local") {
                    provider = new LocalOpenAiCompatibleProvider(localBaseUrl);
                } else if (providerName == "mock") {
                    provider = new MockModelProvider(mockScript);
                } else {
                    Console.Error.WriteLine(JsonConvert.SerializeObject(new {
                        error = $"Unsupported provider '{providerName}'. Sanctum is local-only; allowed providers: ollama, openai-local, mock."
                    }));
                    return 2;
                }
                var engine = new HarnessEngine(store, provider, dataDir);
                using (var server = new HarnessServer(dataDir, engine, port, pipeName)) {
                    server.Start();
                    Console.WriteLine(JsonConvert.SerializeObject(new {
                        status = "ready",
                        pid = Process.GetCurrentProcess().Id,
                        httpPort = server.HttpPort,
                        pipeName = server.PipeName,
                        token = server.Token,
                        runtimeFile = server.RuntimeFilePath
                    }, Formatting.None));
                    Console.Out.Flush();

                    var stopEvent = new ManualResetEventSlim(false);
                    Console.CancelKeyPress += (s, e) => { e.Cancel = true; stopEvent.Set(); };

                    DateTime idleSince = DateTime.UtcNow;
                    while (!stopEvent.IsSet) {
                        stopEvent.Wait(500);
                        if (idleSec > 0) {
                            if (engine.ActiveRunCount > 0) idleSince = DateTime.UtcNow;
                            else if ((DateTime.UtcNow - idleSince).TotalSeconds >= idleSec) break;
                        }
                    }
                }
                return 0;
            }
        }

        private static RuntimeInfo EnsureDaemonRunning(string dataDir, string[] originalArgs) {
            string runtimePath = Path.Combine(dataDir, "runtime.json");
            if (File.Exists(runtimePath)) {
                try {
                    var info = JsonConvert.DeserializeObject<RuntimeInfo>(File.ReadAllText(runtimePath, Utf8NoBom));
                    if (info != null && IsProcessAlive(info.Pid)) {
                        var (st, _) = SendPipeCommand(info.PipeName, "GET", "/v1/hello", new JObject(), 1500);
                        if (st == 200) return info;
                    }
                } catch { }
                // Stale runtime.json cleanup
                try { File.Delete(runtimePath); } catch { }
            }

            string exe = Process.GetCurrentProcess().MainModule.FileName;
            string extra = $"--harness --data-dir \"{dataDir}\" --idle-timeout-sec 60";
            string mockScript = GetArg(originalArgs, "--mock-script");
            if (!string.IsNullOrEmpty(mockScript)) extra += $" --mock-script \"{mockScript}\"";

            Process.Start(new ProcessStartInfo {
                FileName = exe,
                Arguments = extra,
                UseShellExecute = false,
                CreateNoWindow = true
            });

            DateTime deadline = DateTime.UtcNow.AddSeconds(8);
            while (DateTime.UtcNow < deadline) {
                Thread.Sleep(80);
                if (!File.Exists(runtimePath)) continue;
                try {
                    var info = JsonConvert.DeserializeObject<RuntimeInfo>(File.ReadAllText(runtimePath, Utf8NoBom));
                    if (info != null && IsProcessAlive(info.Pid)) {
                        var (st, _) = SendPipeCommand(info.PipeName, "GET", "/v1/hello", new JObject(), 1500);
                        if (st == 200) return info;
                    }
                } catch { }
            }
            throw new Exception("Timed out waiting for headless Sanctum Harness daemon to start.");
        }

        private static bool IsProcessAlive(int pid) {
            if (pid <= 0) return false;
            try {
                var p = Process.GetProcessById(pid);
                return !p.HasExited;
            } catch {
                return false;
            }
        }

        public static (int status, JObject body) SendPipeCommand(string pipeName, string method, string path, JObject body, int timeoutMs = 5000) {
            using (var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut)) {
                client.Connect(timeoutMs);
                using (var writer = new StreamWriter(client, Utf8NoBom, 4096, true) { AutoFlush = true })
                using (var reader = new StreamReader(client, Utf8NoBom, false, 4096, true)) {
                    writer.WriteLine(JsonConvert.SerializeObject(new { method, path, body }, Formatting.None));
                    string line = reader.ReadLine();
                    if (string.IsNullOrEmpty(line)) throw new IOException("Empty pipe response.");
                    var parsed = JObject.Parse(line);
                    return (parsed["status"]?.Value<int>() ?? 500, parsed["body"] as JObject ?? new JObject());
                }
            }
        }

        private static int StreamSseUntilFinished(RuntimeInfo runtime, string sessionId, long afterSeq, bool jsonOut) {
            var req = EgressHttpFactory.CreateRequest($"http://127.0.0.1:{runtime.HttpPort}/v1/sessions/{sessionId}/events?after={afterSeq}", EgressFeature.Loopback);
            req.Proxy = null;
            req.Method = "GET";
            req.Headers["Authorization"] = "Bearer " + runtime.Token;
            req.Timeout = 30000;
            req.ReadWriteTimeout = 30000;

            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var sr = new StreamReader(resp.GetResponseStream(), Utf8NoBom)) {
                string line;
                while ((line = sr.ReadLine()) != null) {
                    if (!line.StartsWith("data:")) continue;
                    string json = line.Substring(5).Trim();
                    if (string.IsNullOrEmpty(json)) continue;
                    var evt = JObject.Parse(json);
                    string type = evt["type"]?.Value<string>() ?? "";

                    if (jsonOut) {
                        Console.WriteLine(json);
                    } else if (type == "message_delta") {
                        Console.Write(evt["payload"]?["delta"]?.Value<string>() ?? "");
                    } else if (type == "run_finished") {
                        Console.WriteLine();
                    }

                    if (type == "run_finished") {
                        string stopReason = evt["payload"]?["stopReason"]?.Value<string>() ?? "completed";
                        return stopReason == "error" ? 1 : 0;
                    }
                }
            }
            return 0;
        }

        private static int RunParseFixture(string fixturePath) {
            if (string.IsNullOrWhiteSpace(fixturePath) || !File.Exists(fixturePath)) {
                Console.Error.WriteLine("Fixture file not found: " + fixturePath);
                return 2;
            }
            var cases = JArray.Parse(File.ReadAllText(fixturePath, Utf8NoBom));
            var results = new JArray();
            foreach (JObject c in cases) {
                string id = c["id"]?.Value<string>() ?? "";
                string content = c["input"]?["content"]?.Value<string>() ?? "";
                var rawCalls = c["input"]?["tool_calls"] as JArray;
                int turnId = c["turnId"]?.Value<int>() ?? 1;
                var parsed = ToolCallParser.Parse(content, rawCalls, turnId);
                results.Add(new JObject {
                    ["id"] = id,
                    ["calls"] = JArray.FromObject(parsed)
                });
            }
            Console.WriteLine(results.ToString(Formatting.None));
            return 0;
        }

        private static int RunEvalPermissionFixture(string fixturePath) {
            if (string.IsNullOrWhiteSpace(fixturePath) || !File.Exists(fixturePath)) {
                Console.Error.WriteLine("Fixture file not found: " + fixturePath);
                return 2;
            }
            var doc = JObject.Parse(File.ReadAllText(fixturePath, Utf8NoBom));
            var cmdResults = new JArray();
            foreach (JObject c in (doc["commands"] as JArray ?? new JArray())) {
                string id = c["id"]?.Value<string>() ?? "";
                string command = c["command"]?.Value<string>() ?? "";
                var (action, reason) = PermissionEngine.EvaluateCommandRule(command);
                cmdResults.Add(new JObject {
                    ["id"] = id,
                    ["action"] = action,
                    ["reason"] = reason
                });
            }

            string ws = doc["workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
            var pathResults = new JArray();
            foreach (JObject p in (doc["paths"] as JArray ?? new JArray())) {
                string id = p["id"]?.Value<string>() ?? "";
                string raw = p["path"]?.Value<string>() ?? "";
                bool allowed = true;
                string err = "";
                try {
                    PermissionEngine.ResolveToolPath(ws, raw, allowRoot: true);
                } catch (Exception ex) {
                    allowed = false;
                    err = ex.Message;
                }
                pathResults.Add(new JObject {
                    ["id"] = id,
                    ["allowed"] = allowed,
                    ["error"] = err
                });
            }

            Console.WriteLine(new JObject {
                ["commands"] = cmdResults,
                ["paths"] = pathResults
            }.ToString(Formatting.None));
            return 0;
        }

        private static string GetArg(string[] args, string flag) {
            for (int i = 0; i < args.Length - 1; i++) {
                if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
            }
            return null;
        }

        private static bool HasFlag(string[] args, string flag) {
            for (int i = 0; i < args.Length; i++) {
                if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}
