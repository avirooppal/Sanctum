using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Windows Job Object with KILL_ON_JOB_CLOSE so child MCP servers never orphan.
    /// </summary>
    public sealed class ProcessJobObject : IDisposable {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll")]
        private static extern bool SetInformationJobObject(IntPtr hJob, int infoType, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        private const int JobObjectExtendedLimitInformation = 9;
        private const uint JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008;
        private const uint JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200;
        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

        private IntPtr _handle;

        public ProcessJobObject(long jobMemoryLimitBytes = 0, uint activeProcessLimit = 0) {
            try {
                _handle = CreateJobObject(IntPtr.Zero, null);
                if (_handle != IntPtr.Zero) {
                    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                    uint flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    if (jobMemoryLimitBytes > 0) {
                        flags |= JOB_OBJECT_LIMIT_JOB_MEMORY;
                        info.JobMemoryLimit = new UIntPtr((ulong)jobMemoryLimitBytes);
                    }
                    if (activeProcessLimit > 0) {
                        flags |= JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
                        info.BasicLimitInformation.ActiveProcessLimit = activeProcessLimit;
                    }
                    info.BasicLimitInformation.LimitFlags = flags;
                    int len = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                    IntPtr ptr = Marshal.AllocHGlobal(len);
                    try {
                        Marshal.StructureToPtr(info, ptr, false);
                        SetInformationJobObject(_handle, JobObjectExtendedLimitInformation, ptr, (uint)len);
                    } finally {
                        Marshal.FreeHGlobal(ptr);
                    }
                }
            } catch {
                _handle = IntPtr.Zero;
            }
        }

        public bool Assign(Process proc) {
            if (_handle == IntPtr.Zero || proc == null) return false;
            try {
                return AssignProcessToJobObject(_handle, proc.Handle);
            } catch {
                return false;
            }
        }

        public void Dispose() {
            if (_handle != IntPtr.Zero) {
                try { CloseHandle(_handle); } catch { }
                _handle = IntPtr.Zero;
            }
        }
    }

    public sealed class McpServerConfig {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("command")] public string Command { get; set; } = "";
        [JsonProperty("args")] public List<string> Args { get; set; } = new List<string>();
        [JsonProperty("cwd", NullValueHandling = NullValueHandling.Ignore)] public string Cwd { get; set; }
        [JsonProperty("enabled")] public bool Enabled { get; set; } = true;
        [JsonProperty("approvedCommandHash")] public string ApprovedCommandHash { get; set; } = "";
        [JsonProperty("approvedAt")] public string ApprovedAt { get; set; } = "";
    }

    /// <summary>
    /// Host-side stdio MCP Client: Job-Object supervised, first-run trusted-channel approval,
    /// JSON-RPC 2.0 initialize + tools/list discovery + tools/call execution, untrusted output wrapping.
    /// </summary>
    public sealed class HarnessMcpManager : IDisposable {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private sealed class RunningServer {
            public McpServerConfig Config;
            public Process Proc;
            public readonly object RpcLock = new object();
            public int NextId = 1;
        }

        private readonly string _appDataDir;
        private readonly string _configPath;
        private readonly HarnessEngine _engine;
        private readonly ProcessJobObject _job;
        private readonly object _cfgLock = new object();
        private readonly Dictionary<string, McpServerConfig> _configs = new Dictionary<string, McpServerConfig>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, RunningServer> _running = new ConcurrentDictionary<string, RunningServer>(StringComparer.OrdinalIgnoreCase);

        public HarnessMcpManager(string appDataDir, HarnessEngine engine) {
            _appDataDir = appDataDir;
            _configPath = Path.Combine(appDataDir, "mcp_servers.json");
            _engine = engine;
            _job = new ProcessJobObject();
            LoadConfigs();
        }

        private void LoadConfigs() {
            lock (_cfgLock) {
                _configs.Clear();
                if (!File.Exists(_configPath)) return;
                try {
                    var list = JsonConvert.DeserializeObject<List<McpServerConfig>>(File.ReadAllText(_configPath, Utf8NoBom));
                    if (list != null) {
                        foreach (var c in list) _configs[c.Id] = c;
                    }
                } catch { }
            }
        }

        private void SaveConfigs() {
            Directory.CreateDirectory(_appDataDir);
            string tmp = _configPath + ".tmp." + Guid.NewGuid().ToString("N");
            File.WriteAllText(tmp, JsonConvert.SerializeObject(_configs.Values.ToList(), Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
            if (File.Exists(_configPath)) File.Delete(_configPath);
            File.Move(tmp, _configPath);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_configPath);
        }

        private static string ComputeCommandHash(string command, List<string> args) {
            return CanonicalJson.Sha256Hex((command ?? "") + "\n" + string.Join("\n", args ?? new List<string>()));
        }

        public JArray ListServers() {
            lock (_cfgLock) {
                var arr = new JArray();
                foreach (var c in _configs.Values.OrderBy(x => x.Id, StringComparer.OrdinalIgnoreCase)) {
                    var obj = JObject.FromObject(c);
                    obj["running"] = _running.TryGetValue(c.Id, out var r) && r.Proc != null && !r.Proc.HasExited;
                    arr.Add(obj);
                }
                return arr;
            }
        }

        public (int status, JObject body) RegisterServer(McpServerConfig cfg, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                _engine.Audit.Record("", "mcp:" + (cfg?.Id ?? ""), "register_mcp_server", cfg?.Command ?? "", "denied", "Enabling MCP server requires trusted channel", "bearer_channel");
                return (403, new JObject {
                    ["error"] = "Registering or enabling an MCP server requires native dialog or CLI TTY approval showing the full command.",
                    ["code"] = "trusted_channel_required"
                });
            }
            if (cfg == null || string.IsNullOrWhiteSpace(cfg.Id) || string.IsNullOrWhiteSpace(cfg.Command)) {
                return (400, new JObject { ["error"] = "MCP server 'id' and 'command' are required." });
            }
            cfg.Args = cfg.Args ?? new List<string>();
            cfg.ApprovedCommandHash = ComputeCommandHash(cfg.Command, cfg.Args);
            cfg.ApprovedAt = DateTime.UtcNow.ToString("o");
            lock (_cfgLock) {
                _configs[cfg.Id] = cfg;
                SaveConfigs();
            }
            _engine.Audit.Record("", "mcp:" + cfg.Id, "register_mcp_server", cfg.Command + " " + string.Join(" ", cfg.Args), "allowed", "Approved via trusted channel", "trusted_channel");
            return (201, JObject.FromObject(cfg));
        }

        public (int status, JObject body) DeleteServer(string id, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject { ["error"] = "Removing MCP server requires trusted channel.", ["code"] = "trusted_channel_required" });
            }
            StopServer(id);
            lock (_cfgLock) {
                _configs.Remove(id);
                SaveConfigs();
            }
            return (200, new JObject { ["id"] = id, ["deleted"] = true });
        }

        public (int status, JObject body) DiscoverAndRegisterTools(string serverId) {
            McpServerConfig cfg;
            lock (_cfgLock) {
                if (!_configs.TryGetValue(serverId, out cfg)) {
                    return (404, new JObject { ["error"] = "MCP server not found: " + serverId });
                }
            }
            if (!cfg.Enabled || cfg.ApprovedCommandHash != ComputeCommandHash(cfg.Command, cfg.Args)) {
                return (403, new JObject { ["error"] = "MCP server command is not approved." });
            }

            var rs = EnsureRunning(cfg);
            SendRpc(rs, "initialize", new JObject {
                ["protocolVersion"] = "2024-11-05",
                ["capabilities"] = new JObject(),
                ["clientInfo"] = new JObject { ["name"] = "sanctum-harness", ["version"] = ProtocolConstants.HarnessVersion }
            });

            var listResp = SendRpc(rs, "tools/list", new JObject());
            var toolsArr = listResp?["result"]?["tools"] as JArray ?? new JArray();
            var registeredNames = new JArray();

            foreach (JObject t in toolsArr) {
                string remoteName = t["name"]?.Value<string>() ?? "";
                if (string.IsNullOrWhiteSpace(remoteName)) continue;
                string fullName = $"mcp:{cfg.Id}:{remoteName}";
                string desc = t["description"]?.Value<string>() ?? $"MCP tool {remoteName} from {cfg.Id}";
                var schema = t["inputSchema"] as JObject ?? new JObject { ["type"] = "object", ["properties"] = new JObject() };

                _engine.RegisterTool(new HarnessToolDescriptor {
                    Name = fullName,
                    Description = desc,
                    Category = "mcp:" + cfg.Id,
                    Safety = "exec", // MCP tools require approval unless explicitly allow-ruled
                    TimeoutMs = 30000,
                    InputSchema = schema,
                    Execute = (args, ct) => {
                        var cleanArgs = (JObject)(args?.DeepClone() ?? new JObject());
                        cleanArgs.Remove("_workspace");
                        cleanArgs.Remove("_sessionId");
                        var callResp = CallTool(cfg.Id, remoteName, cleanArgs);
                        string raw = callResp.ToString(Formatting.None);
                        return UntrustedContent.Wrap("mcp", fullName, raw);
                    }
                });
                registeredNames.Add(fullName);
            }

            return (200, new JObject {
                ["serverId"] = cfg.Id,
                ["tools"] = registeredNames
            });
        }

        public JObject CallTool(string serverId, string toolName, JObject arguments) {
            McpServerConfig cfg;
            lock (_cfgLock) {
                if (!_configs.TryGetValue(serverId, out cfg)) throw new KeyNotFoundException("MCP server not found: " + serverId);
            }
            var rs = EnsureRunning(cfg);
            var resp = SendRpc(rs, "tools/call", new JObject {
                ["name"] = toolName,
                ["arguments"] = arguments ?? new JObject()
            });
            return resp?["result"] as JObject ?? resp ?? new JObject();
        }

        public JObject RestartServer(string serverId) {
            StopServer(serverId);
            var (st, body) = DiscoverAndRegisterTools(serverId);
            body["restarted"] = st == 200;
            return body;
        }

        private RunningServer EnsureRunning(McpServerConfig cfg) {
            if (_running.TryGetValue(cfg.Id, out var existing) && existing.Proc != null && !existing.Proc.HasExited) {
                return existing;
            }
            string argStr = string.Join(" ", cfg.Args.Select(a => a.Contains(" ") ? $"\"{a.Replace("\"", "\\\"")}\"" : a));
            var psi = new ProcessStartInfo {
                FileName = cfg.Command,
                Arguments = argStr,
                WorkingDirectory = string.IsNullOrWhiteSpace(cfg.Cwd) ? Environment.CurrentDirectory : cfg.Cwd,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var proc = Process.Start(psi);
            _job.Assign(proc);
            var rs = new RunningServer { Config = cfg, Proc = proc };
            _running[cfg.Id] = rs;
            return rs;
        }

        private JObject SendRpc(RunningServer rs, string method, JObject paramObj) {
            lock (rs.RpcLock) {
                int id = rs.NextId++;
                var req = new JObject {
                    ["jsonrpc"] = "2.0",
                    ["id"] = id,
                    ["method"] = method,
                    ["params"] = paramObj ?? new JObject()
                };
                rs.Proc.StandardInput.WriteLine(req.ToString(Formatting.None));
                rs.Proc.StandardInput.Flush();

                var deadline = DateTime.UtcNow.AddSeconds(15);
                while (DateTime.UtcNow < deadline) {
                    var readTask = rs.Proc.StandardOutput.ReadLineAsync();
                    if (!readTask.Wait(15000)) throw new TimeoutException("MCP server RPC timed out: " + method);
                    string line = readTask.Result;
                    if (line == null) throw new IOException("MCP server closed stdout unexpectedly.");
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    try {
                        var msg = JObject.Parse(line);
                        if (msg["id"]?.Value<int>() == id) return msg;
                    } catch { }
                }
                throw new TimeoutException("MCP server did not reply in time.");
            }
        }

        private void StopServer(string id) {
            if (_running.TryRemove(id, out var rs)) {
                try { if (!rs.Proc.HasExited) rs.Proc.Kill(); } catch { }
                try { rs.Proc.Dispose(); } catch { }
            }
        }

        public void Dispose() {
            foreach (string id in _running.Keys.ToList()) StopServer(id);
            _job.Dispose();
        }
    }

    /// <summary>
    /// Discovers .sanctum/ agents, skills, commands, hooks (disabled until trusted approval), and pack manifests.
    /// </summary>
    public sealed class ExtensionsManager {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _approvedHooksPath;
        private readonly HashSet<string> _approvedHookWorkspaces = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly object _lock = new object();

        public ExtensionsManager(string appDataDir) {
            _approvedHooksPath = Path.Combine(appDataDir, "approved_hooks.json");
            Load();
        }

        private void Load() {
            lock (_lock) {
                _approvedHookWorkspaces.Clear();
                if (!File.Exists(_approvedHooksPath)) return;
                try {
                    var list = JsonConvert.DeserializeObject<List<string>>(File.ReadAllText(_approvedHooksPath, Utf8NoBom));
                    if (list != null) foreach (var s in list) _approvedHookWorkspaces.Add(s);
                } catch { }
            }
        }

        private void Save() {
            Directory.CreateDirectory(Path.GetDirectoryName(_approvedHooksPath));
            File.WriteAllText(_approvedHooksPath, JsonConvert.SerializeObject(_approvedHookWorkspaces.ToList(), Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_approvedHooksPath);
        }

        public (int status, JObject body) ApproveWorkspaceHooks(string workspaceRoot, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Enabling workspace hooks requires native dialog or CLI TTY approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            string norm = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            lock (_lock) {
                _approvedHookWorkspaces.Add(norm);
                Save();
            }
            return (200, new JObject { ["workspace"] = norm, ["hooksApproved"] = true });
        }

        public JObject Discover(string workspaceRoot) {
            var agents = new JArray();
            var skills = new JArray();
            var commands = new JArray();
            var packs = new JArray();
            var hooks = new JArray();
            bool hooksApproved = false;

            if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot)) {
                return new JObject { ["agents"] = agents, ["skills"] = skills, ["commands"] = commands, ["packs"] = packs, ["hooks"] = hooks, ["hooksApproved"] = false };
            }

            string normRoot = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            lock (_lock) hooksApproved = _approvedHookWorkspaces.Contains(normRoot);

            // .sanctum/agents/*.md
            TryScanDir(workspaceRoot, ".sanctum/agents", "*.md", (rel, full) => {
                agents.Add(new JObject { ["name"] = Path.GetFileNameWithoutExtension(full), ["path"] = rel });
            });

            // .sanctum/commands/*.md
            TryScanDir(workspaceRoot, ".sanctum/commands", "*.md", (rel, full) => {
                commands.Add(new JObject { ["name"] = "/" + Path.GetFileNameWithoutExtension(full), ["path"] = rel });
            });

            // .sanctum/skills/*/SKILL.md
            try {
                string skillsRoot = PermissionEngine.ResolveToolPath(workspaceRoot, ".sanctum/skills", allowRoot: false);
                if (Directory.Exists(skillsRoot)) {
                    foreach (string dir in Directory.GetDirectories(skillsRoot)) {
                        string skillFile = Path.Combine(dir, "SKILL.md");
                        if (File.Exists(skillFile)) {
                            skills.Add(new JObject {
                                ["name"] = Path.GetFileName(dir),
                                ["path"] = ".sanctum/skills/" + Path.GetFileName(dir) + "/SKILL.md"
                            });
                        }
                    }
                }
            } catch { }

            // .sanctum/hooks.json (discovered, but active only when hooksApproved == true)
            try {
                string hooksFile = PermissionEngine.ResolveToolPath(workspaceRoot, ".sanctum/hooks.json", allowRoot: false);
                if (File.Exists(hooksFile)) {
                    var parsed = JToken.Parse(File.ReadAllText(hooksFile, Utf8NoBom));
                    if (parsed is JArray arr) {
                        foreach (var item in arr) hooks.Add(item);
                    } else if (parsed is JObject obj && obj["hooks"] is JArray hArr) {
                        foreach (var item in hArr) hooks.Add(item);
                    }
                }
            } catch { }

            // packs/*/manifest.json
            try {
                string packsRoot = PermissionEngine.ResolveToolPath(workspaceRoot, "packs", allowRoot: false);
                if (Directory.Exists(packsRoot)) {
                    foreach (string dir in Directory.GetDirectories(packsRoot)) {
                        string mf = Path.Combine(dir, "manifest.json");
                        if (File.Exists(mf)) {
                            try {
                                var mObj = JObject.Parse(File.ReadAllText(mf, Utf8NoBom));
                                packs.Add(new JObject {
                                    ["id"] = mObj["id"]?.Value<string>() ?? Path.GetFileName(dir),
                                    ["name"] = mObj["name"]?.Value<string>() ?? Path.GetFileName(dir),
                                    ["path"] = "packs/" + Path.GetFileName(dir) + "/manifest.json"
                                });
                            } catch { }
                        }
                    }
                }
            } catch { }

            return new JObject {
                ["agents"] = agents,
                ["skills"] = skills,
                ["commands"] = commands,
                ["packs"] = packs,
                ["hooks"] = hooks,
                ["hooksApproved"] = hooksApproved
            };
        }

        private static void TryScanDir(string ws, string relDir, string pattern, Action<string, string> onFile) {
            try {
                string fullDir = PermissionEngine.ResolveToolPath(ws, relDir, allowRoot: false);
                if (!Directory.Exists(fullDir)) return;
                foreach (string f in Directory.GetFiles(fullDir, pattern).OrderBy(x => x, StringComparer.OrdinalIgnoreCase)) {
                    onFile(relDir + "/" + Path.GetFileName(f), f);
                }
            } catch { }
        }
    }

    public sealed class ScheduledJob {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("name")] public string Name { get; set; } = "";
        [JsonProperty("intervalSeconds")] public int IntervalSeconds { get; set; } = 3600;
        [JsonProperty("prompt")] public string Prompt { get; set; } = "";
        [JsonProperty("workspace")] public string Workspace { get; set; } = "";
        [JsonProperty("model")] public string Model { get; set; } = "mock";
        [JsonProperty("enabled")] public bool Enabled { get; set; } = true;
        [JsonProperty("lastRunAt", NullValueHandling = NullValueHandling.Ignore)] public string LastRunAt { get; set; }
        [JsonProperty("lastSessionId", NullValueHandling = NullValueHandling.Ignore)] public string LastSessionId { get; set; }
        [JsonProperty("expiresAt", NullValueHandling = NullValueHandling.Ignore)] public string ExpiresAt { get; set; }
        [JsonProperty("maxAutonomy")] public string MaxAutonomy { get; set; } = "auto_reads";
        [JsonProperty("allowNetwork")] public bool AllowNetwork { get; set; }
        [JsonProperty("lastReportPath", NullValueHandling = NullValueHandling.Ignore)] public string LastReportPath { get; set; }
    }

    /// <summary>
    /// Host-side Scheduler: runs unattended:true sessions on HarnessEngine (strictly fail-closed).
    /// </summary>
    public sealed class HarnessScheduler : IDisposable {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _path;
        private readonly HarnessEngine _engine;
        private readonly object _lock = new object();
        private readonly List<ScheduledJob> _jobs = new List<ScheduledJob>();
        private readonly Timer _timer;

        public HarnessScheduler(string appDataDir, HarnessEngine engine) {
            _path = Path.Combine(appDataDir, "schedules.json");
            _engine = engine;
            Load();
            _timer = new Timer(_ => Tick(), null, 10000, 10000);
        }

        private void Load() {
            lock (_lock) {
                _jobs.Clear();
                if (!File.Exists(_path)) return;
                try {
                    var loaded = JsonConvert.DeserializeObject<List<ScheduledJob>>(File.ReadAllText(_path, Utf8NoBom));
                    if (loaded != null) _jobs.AddRange(loaded);
                } catch { }
            }
        }

        private void Save() {
            Directory.CreateDirectory(Path.GetDirectoryName(_path));
            File.WriteAllText(_path, JsonConvert.SerializeObject(_jobs, Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_path);
        }

        public JArray ListJobs() {
            lock (_lock) return JArray.FromObject(_jobs);
        }

        public (int status, JObject body) AddJob(ScheduledJob job, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Creating a scheduled job requires native dialog or CLI TTY approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            if (job == null || string.IsNullOrWhiteSpace(job.Prompt)) {
                return (400, new JObject { ["error"] = "Scheduled job prompt is required." });
            }
            job.Id = "job_" + Guid.NewGuid().ToString("N").Substring(0, 10);
            if (string.IsNullOrWhiteSpace(job.Name)) job.Name = "Scheduled Task";
            if (job.IntervalSeconds < 60) job.IntervalSeconds = 60;
            lock (_lock) {
                _jobs.Add(job);
                Save();
            }
            return (201, JObject.FromObject(job));
        }

        public (int status, JObject body) DeleteJob(string id, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject { ["error"] = "Deleting a scheduled job requires trusted channel.", ["code"] = "trusted_channel_required" });
            }
            lock (_lock) {
                _jobs.RemoveAll(j => string.Equals(j.Id, id, StringComparison.OrdinalIgnoreCase));
                Save();
            }
            return (200, new JObject { ["id"] = id, ["deleted"] = true });
        }

        public (int status, JObject body) TriggerJobNow(string id) {
            ScheduledJob job;
            lock (_lock) {
                job = _jobs.FirstOrDefault(j => string.Equals(j.Id, id, StringComparison.OrdinalIgnoreCase));
            }
            if (job == null) return (404, new JObject { ["error"] = "Scheduled job not found." });

            // Enforce expiry (fail closed)
            if (!string.IsNullOrWhiteSpace(job.ExpiresAt) &&
                DateTime.TryParse(job.ExpiresAt, out var expDt) &&
                DateTime.UtcNow > expDt.ToUniversalTime()) {
                return (410, new JObject {
                    ["error"] = "Scheduled job has expired and will not run (fail-closed).",
                    ["code"] = "job_expired",
                    ["expiresAt"] = job.ExpiresAt
                });
            }

            if (job.AllowNetwork && EgressHttpFactory.IsOfflineMode) {
                return (403, new JObject {
                    ["error"] = "Scheduled job requires network access, which is blocked in Offline mode.",
                    ["code"] = "offline_mode_active"
                });
            }

            string effectiveAutonomy = ProjectVerifier.CapChildAutonomy(job.MaxAutonomy ?? "auto_reads", "auto_reads");

            var session = _engine.CreateSession(
                title: "[Scheduled] " + job.Name,
                workspace: job.Workspace,
                mode: "build",
                autonomy: effectiveAutonomy,
                model: job.Model,
                unattended: true,
                role: "scheduler");

            var (_, code, resp) = _engine.StartRun(session.SessionId, job.Prompt);

            string reportPath = "";
            try {
                string reportsDir = Path.Combine(Path.GetDirectoryName(_path), "reports");
                Directory.CreateDirectory(reportsDir);
                reportPath = Path.Combine(reportsDir, $"schedule-{job.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}.md");
                string reportMd = $"# Scheduled Job Report: {job.Name}\n\n- Job ID: `{job.Id}`\n- Session ID: `{session.SessionId}`\n- Autonomy Ceiling: `{effectiveAutonomy}`\n- Network Allowed: `{job.AllowNetwork && !EgressHttpFactory.IsOfflineMode}`\n- Triggered At: `{DateTime.UtcNow:o}`\n- Status Code: `{code}`\n";
                File.WriteAllText(reportPath, reportMd, Utf8NoBom);
                WindowsAclHelper.ApplyUserOnlyFileAcl(reportPath);
            } catch { }

            lock (_lock) {
                job.LastRunAt = DateTime.UtcNow.ToString("o");
                job.LastSessionId = session.SessionId;
                job.LastReportPath = reportPath;
                Save();
            }
            return (code, new JObject {
                ["jobId"] = job.Id,
                ["sessionId"] = session.SessionId,
                ["unattended"] = true,
                ["autonomy"] = effectiveAutonomy,
                ["reportPath"] = reportPath,
                ["run"] = resp
            });
        }

        private void Tick() {
            List<ScheduledJob> due;
            DateTime now = DateTime.UtcNow;
            lock (_lock) {
                due = _jobs.Where(j => j.Enabled && (string.IsNullOrEmpty(j.LastRunAt) ||
                    (DateTime.TryParse(j.LastRunAt, out var last) && (now - last.ToUniversalTime()).TotalSeconds >= j.IntervalSeconds))).ToList();
            }
            foreach (var job in due) {
                try { TriggerJobNow(job.Id); } catch { }
            }
        }

        public void Dispose() {
            try { _timer.Dispose(); } catch { }
        }
    }
}
