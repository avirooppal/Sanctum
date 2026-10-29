using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Management;

namespace Sanctum {
    public partial class DesktopHost {
        private static int _enginePort = 11434;
        private static string EngineBase { get { return "http://127.0.0.1:" + _enginePort; } }
        private static readonly object LogLock = new object(), SetupLock = new object(), EngineLock = new object(), MonitorLock = new object();
        private static string LogPath { get { return Path.Combine(_appDataDir, "logs", "desktop.jsonl"); } }
        private static string _setupPhase = "idle", _setupDetail = "Ready to set up Sanctum", _setupModel = "";
        private static double? _setupPercent;
        private static bool _setupBusy;
        private static volatile bool _installerRunning;
        private static CancellationTokenSource _setupCancellation;
        private static Process _ownedEngine;
        private static DateTime _engineLastAttempt = DateTime.MinValue;

        private static void LogEvent(string level, string category, string message) {
            try {
                lock (LogLock) {
                    Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
                    if (File.Exists(LogPath) && new FileInfo(LogPath).Length > 2097152) {
                        if (File.Exists(LogPath + ".1")) File.Delete(LogPath + ".1");
                        File.Move(LogPath, LogPath + ".1");
                    }
                    File.AppendAllText(LogPath, new JavaScriptSerializer().Serialize(new {
                        time = DateTime.UtcNow.ToString("o"), level = level, category = category,
                        message = message.Length > 2000 ? message.Substring(0, 2000) : message
                    }) + "\n", new UTF8Encoding(false));
                }
            } catch { }
        }
        private static void SetupState(string phase, string detail, double? percent) {
            lock (SetupLock) { _setupPhase = phase; _setupDetail = detail; _setupPercent = percent; }
        }
        private static object SetupSnapshot() {
            lock (SetupLock) return new { phase = _setupPhase, detail = _setupDetail, percent = _setupPercent, busy = _setupBusy, model = _setupModel };
        }
        private static HttpWebRequest EngineRequest(string path, object body, int timeout) {
            var request = (HttpWebRequest)WebRequest.Create(EngineBase + path);
            request.Proxy = null; request.Timeout = timeout; request.ReadWriteTimeout = timeout;
            if (body != null) {
                request.Method = "POST"; request.ContentType = "application/json";
                byte[] bytes = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(body));
                request.ContentLength = bytes.Length;
                using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
            }
            return request;
        }
        private static Dictionary<string, object> EngineJson(string path, object body, int timeout) {
            using (var response = EngineRequest(path, body, timeout).GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
        }
        private static bool EngineOnline() {
            try { return EngineJson("/api/version", null, 1500).ContainsKey("version"); } catch { return false; }
        }
        private static string FindOllama() {
            var candidates = new List<string> {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Ollama", "ollama.exe")
            };
            foreach (string folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';')) {
                try { if (!string.IsNullOrWhiteSpace(folder)) candidates.Add(Path.Combine(folder.Trim('"'), "ollama.exe")); } catch { }
            }
            foreach (string file in candidates) if (File.Exists(file)) return Path.GetFullPath(file);
            return null;
        }
        private static bool EnsureEngineStarted() {
            if (EngineOnline()) return true;
            lock (EngineLock) {
                if (EngineOnline()) return true;
                if ((DateTime.UtcNow - _engineLastAttempt).TotalSeconds < 10) return false;
                _engineLastAttempt = DateTime.UtcNow;
                string exe = FindOllama();
                if (exe == null) return false;
                try {
                    var info = new ProcessStartInfo(exe, "serve") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardError = true, RedirectStandardOutput = true };
                    info.EnvironmentVariables["OLLAMA_HOST"] = "127.0.0.1:" + _enginePort;
                    info.EnvironmentVariables["OLLAMA_NO_CLOUD"] = "1";
                    _ownedEngine = new Process { StartInfo = info };
                    // Drain output without logging prompts or model content.
                    _ownedEngine.OutputDataReceived += (s, e) => { };
                    _ownedEngine.ErrorDataReceived += (s, e) => { };
                    _ownedEngine.Start(); _ownedEngine.BeginOutputReadLine(); _ownedEngine.BeginErrorReadLine();
                    LogEvent("info", "engine", "Started local inference service");
                    for (int i = 0; i < 30; i++) { if (EngineOnline()) return true; if (_ownedEngine.HasExited) break; Thread.Sleep(500); }
                } catch (Exception ex) { LogEvent("error", "engine", ex.Message); }
                return false;
            }
        }
        private static void VerifyInstaller(string file, string publisher) {
            // Use Windows Authenticode trust validation, not just a downloaded checksum.
            string escaped = file.Replace("'", "''");
            string script = "$s=Get-AuthenticodeSignature -LiteralPath '" + escaped + "'; if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notlike '*" + publisher + "*'){exit 9}";
            var info = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"), "-NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script))) {
                UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
            };
            using (var process = Process.Start(info)) {
                if (!process.WaitForExit(60000)) { process.Kill(); throw new Exception("Installer signature verification timed out. Retry setup."); }
                if (process.ExitCode != 0) throw new Exception("Installer signature could not be verified for " + publisher + ". Nothing was executed.");
            }
        }
        private static void DownloadAndInstall(string url, string filename, string publisher, string arguments, CancellationToken cancellation, Action<string> progress) {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            string directory = Path.Combine(_appDataDir, "installers"); Directory.CreateDirectory(directory);
            string file = Path.Combine(directory, filename);
            string partial = file + ".download";
            progress("Downloading " + publisher + " runtime");
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = 30000; request.ReadWriteTimeout = 60000; request.UserAgent = "Sanctum-Desktop/1.0";
            try {
                using (cancellation.Register(() => request.Abort()))
                using (var response = request.GetResponse())
                using (var input = response.GetResponseStream())
                using (var output = new FileStream(partial, FileMode.Create, FileAccess.Write)) {
                    if (response.ResponseUri.Scheme != "https") throw new Exception("Runtime download must use HTTPS.");
                    byte[] buffer = new byte[65536]; int read; long total = 0; long lastReport = 0;
                    while ((read = input.Read(buffer, 0, buffer.Length)) > 0) {
                        cancellation.ThrowIfCancellationRequested(); output.Write(buffer, 0, read); total += read;
                        if (total > 4294967296L) throw new Exception("Runtime download exceeded the 4 GiB limit.");
                        if (total - lastReport > 1048576) {
                            lastReport = total;
                            progress("Downloading " + publisher + ": " + (total / 1048576) + " MB" + (response.ContentLength > 0 ? " / " + response.ContentLength / 1048576 + " MB" : ""));
                        }
                    }
                }
                cancellation.ThrowIfCancellationRequested(); progress("Verifying " + publisher + " installer signature");
                VerifyInstaller(partial, publisher);
                if (File.Exists(file)) File.Delete(file); File.Move(partial, file);
                cancellation.ThrowIfCancellationRequested(); progress("Installing " + publisher + ". Windows may request permission; keep Sanctum open.");
                _installerRunning = true;
                try { using (var process = Process.Start(new ProcessStartInfo(file, arguments) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden })) {
                    // Do not terminate an installer halfway through changes. Cancellation takes effect after it exits.
                    if (!process.WaitForExit(1200000)) throw new Exception("The installer is still running. Wait for it to finish, then retry setup.");
                    if (process.ExitCode != 0 && process.ExitCode != 3010) throw new Exception(publisher + " installer exited with code " + process.ExitCode + ". Retry setup or inspect Logs.");
                } } finally { _installerRunning = false; }
                LogEvent("info", "setup", publisher + " runtime installation completed");
                cancellation.ThrowIfCancellationRequested();
            } finally { try { if (File.Exists(partial)) File.Delete(partial); } catch { } }
        }
        private async Task EnsureWebViewRuntime() {
            try { if (!string.IsNullOrEmpty(Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString())) return; } catch { }
            var panel = new Panel { Dock = DockStyle.Fill, BackColor = System.Drawing.Color.FromArgb(24, 24, 27) };
            var label = new Label { Dock = DockStyle.Fill, ForeColor = System.Drawing.Color.White, Padding = new Padding(35), Text = "Preparing Sanctum's display runtime… Internet is required for this first setup.", Font = new System.Drawing.Font("Segoe UI", 12) };
            var retry = new Button { Dock = DockStyle.Bottom, Height = 48, Text = "Retry setup", Visible = false };
            panel.Controls.Add(label); panel.Controls.Add(retry); Controls.Add(panel); panel.BringToFront();
            bool complete = false;
            while (!complete && !IsDisposed) {
                string failure = null;
                try {
                    await Task.Run(() => DownloadAndInstall("https://go.microsoft.com/fwlink/p/?LinkId=2124703", "MicrosoftEdgeWebview2Setup.exe", "Microsoft", "/silent /install", CancellationToken.None,
                        message => { if (!IsDisposed) BeginInvoke(new Action(() => label.Text = message)); }));
                    string version = Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString();
                    if (string.IsNullOrEmpty(version)) throw new Exception("Windows needs to finish installing the display runtime. Restart Sanctum, or retry.");
                    complete = true;
                } catch (Exception ex) {
                    LogEvent("error", "setup", ex.Message); failure = ex.Message;
                }
                if (failure != null) {
                    label.Text = "Setup could not finish: " + failure + "\nCheck your connection, then Retry setup.";
                    var completion = new TaskCompletionSource<bool>();
                    EventHandler handler = (s, e) => completion.TrySetResult(true);
                    retry.Click += handler; retry.Visible = true;
                    await completion.Task; retry.Click -= handler; retry.Visible = false;
                }
            }
            Controls.Remove(panel); panel.Dispose();
        }
        private static string FindChatModel() {
            var data = EngineJson("/api/tags", null, 5000);
            var models = data.ContainsKey("models") ? data["models"] as System.Collections.IEnumerable : null;
            if (models == null) return null;
            var names = new List<string>();
            foreach (var value in models) {
                var model = value as Dictionary<string, object>;
                if (model != null && model.ContainsKey("name")) names.Add(Convert.ToString(model["name"]));
            }
            names.Sort((a, b) => a == "qwen3:1.7b" ? -1 : b == "qwen3:1.7b" ? 1 : string.CompareOrdinal(a, b));
            foreach (string name in names) {
                var show = EngineJson("/api/show", new { model = name }, 10000);
                var caps = show.ContainsKey("capabilities") ? show["capabilities"] as System.Collections.IEnumerable : null;
                if (caps != null) foreach (var cap in caps) if (Convert.ToString(cap) == "completion") return name;
            }
            return null;
        }
        private static void StartSetup() {
            lock (SetupLock) {
                if (_setupBusy) return;
                _setupBusy = true; _setupModel = "";
                _setupCancellation = new CancellationTokenSource();
                _setupPhase = "checking"; _setupDetail = "Checking local runtime"; _setupPercent = null;
            }
            Task.Run(() => {
                var cancel = _setupCancellation.Token;
                try {
                    LogEvent("info", "setup", "Automatic setup started");
                    if (!EnsureEngineStarted()) {
                        if (FindOllama() == null) {
                            SetupState("installing", "Installing the local AI runtime", null);
                            DownloadAndInstall("https://ollama.com/download/OllamaSetup.exe", "OllamaSetup.exe", "Ollama", "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART", cancel, message => SetupState("installing", message, null));
                        }
                        _engineLastAttempt = DateTime.MinValue;
                        if (!EnsureEngineStarted()) throw new Exception("The local AI runtime did not start. Check Logs and retry setup.");
                    }
                    cancel.ThrowIfCancellationRequested();
                    SetupState("model", "Checking installed chat models", null);
                    string model = FindChatModel();
                    if (model == null) {
                        model = "qwen3:1.7b";
                        var pull = EngineRequest("/api/pull", new { model = model, stream = true }, 600000);
                        bool success = false;
                        using (cancel.Register(() => pull.Abort()))
                        using (var response = pull.GetResponse())
                        using (var reader = new StreamReader(response.GetResponseStream())) {
                            string line;
                            while ((line = reader.ReadLine()) != null) {
                                cancel.ThrowIfCancellationRequested();
                                var record = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(line);
                                if (record.ContainsKey("error")) throw new Exception(Convert.ToString(record["error"]));
                                string status = record.ContainsKey("status") ? Convert.ToString(record["status"]) : "Downloading";
                                double? pct = record.ContainsKey("completed") && record.ContainsKey("total") && Convert.ToDouble(record["total"]) > 0 ? (double?)(100 * Convert.ToDouble(record["completed"]) / Convert.ToDouble(record["total"])) : null;
                                SetupState("model", "Qwen3 1.7B: " + status, pct);
                                if (status == "success") success = true;
                            }
                        }
                        if (!success) throw new Exception("Model download interrupted. Retry to resume the download.");
                    }
                    cancel.ThrowIfCancellationRequested();
                    lock (SetupLock) _setupModel = model;
                    SetupState("verifying", "Testing a response from " + model, null);
                    var verify = EngineRequest("/api/chat", new { model = model, messages = new[] { new { role = "user", content = "Reply with the word READY. /no_think" } }, think = false, stream = false, options = new { num_predict = 32, num_ctx = 2048 } }, 180000);
                    using (cancel.Register(() => verify.Abort()))
                    using (var response = verify.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream())) {
                        var result = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                        var message = result.ContainsKey("message") ? result["message"] as Dictionary<string, object> : null;
                        if (message == null || !message.ContainsKey("content") || string.IsNullOrWhiteSpace(Convert.ToString(message["content"]))) throw new Exception("The model did not produce a response. Retry setup or choose another model in the Hub.");
                    }
                    cancel.ThrowIfCancellationRequested();
                    SetupState("ready", "Your local model responded successfully. Sanctum is ready.", 100);
                    LogEvent("info", "setup", "Setup verified with " + model);
                } catch (Exception ex) {
                    bool cancelled = cancel.IsCancellationRequested;
                    SetupState(cancelled ? "cancelled" : "error", cancelled ? "Setup stopped. Retry to resume." : ex.Message, null);
                    LogEvent(cancelled ? "info" : "error", "setup", cancelled ? "Setup cancelled" : ex.Message);
                } finally { lock (SetupLock) _setupBusy = false; }
            });
        }

        [StructLayout(LayoutKind.Sequential)] private class MemoryStatus {
            public uint length = (uint)Marshal.SizeOf(typeof(MemoryStatus)); public uint load;
            public ulong totalPhysical, availablePhysical, totalPage, availablePage, totalVirtual, availableVirtual, availableExtended;
        }
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GlobalMemoryStatusEx([In, Out] MemoryStatus status);
        [DllImport("kernel32.dll")] private static extern bool GetSystemTimes(out long idle, out long kernel, out long user);
        [DllImport("kernel32.dll")] private static extern ulong GetTickCount64();
        private static long _lastIdle, _lastKernel, _lastUser;
        private static DateTime _monitorAt = DateTime.MinValue;
        private static object _monitorCache;
        private static string _cpuName, _gpuName;
        private static object MonitorSnapshot() {
            lock (MonitorLock) {
                if (_monitorCache != null && (DateTime.UtcNow - _monitorAt).TotalSeconds < 2) return _monitorCache;
                var memory = new MemoryStatus(); bool hasMemory = GlobalMemoryStatusEx(memory);
                long idle, kernel, user; double? cpu = null;
                if (GetSystemTimes(out idle, out kernel, out user)) {
                    long total = kernel - _lastKernel + user - _lastUser;
                    if (_lastKernel > 0 && total > 0) cpu = Math.Round(Math.Max(0, Math.Min(100, 100.0 * (total - (idle - _lastIdle)) / total)), 1);
                    _lastIdle = idle; _lastKernel = kernel; _lastUser = user;
                }
                if (_cpuName == null) {
                    _cpuName = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "Unknown CPU";
                    _gpuName = "Unavailable";
                    try { using (var search = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController")) using (var items = search.Get()) foreach (ManagementObject item in items) { _gpuName = Convert.ToString(item["Name"]); break; } } catch { }
                }
                double? free = null, totalDisk = null;
                try { var drive = new DriveInfo(Path.GetPathRoot(_appDataDir)); free = drive.AvailableFreeSpace / 1073741824.0; totalDisk = drive.TotalSize / 1073741824.0; } catch { }
                var runningModels = new List<object>(); bool engineOnline = false;
                try {
                    var ps = EngineJson("/api/ps", null, 2000); engineOnline = true;
                    var values = ps.ContainsKey("models") ? ps["models"] as System.Collections.IEnumerable : null;
                    if (values != null) foreach (Dictionary<string, object> model in values) runningModels.Add(new {
                        name = model.ContainsKey("name") ? model["name"] : "unknown",
                        sizeBytes = model.ContainsKey("size") ? model["size"] : null,
                        vramBytes = model.ContainsKey("size_vram") ? model["size_vram"] : null
                    });
                } catch { }
                _monitorAt = DateTime.UtcNow;
                _monitorCache = new {
                    timestamp = _monitorAt.ToString("o"), cpuPercent = cpu, cpuName = _cpuName, logicalCores = Environment.ProcessorCount,
                    ramTotalGB = hasMemory ? (double?)(memory.totalPhysical / 1073741824.0) : null,
                    ramUsedGB = hasMemory ? (double?)((memory.totalPhysical - memory.availablePhysical) / 1073741824.0) : null,
                    appMemoryMB = Process.GetCurrentProcess().WorkingSet64 / 1048576.0,
                    diskFreeGB = free, diskTotalGB = totalDisk, gpuName = _gpuName,
                    gpuUtilization = (double?)null, gpuTemperature = (double?)null,
                    uptimeSeconds = GetTickCount64() / 1000, appUptimeSeconds = _startupWatch.Elapsed.TotalSeconds,
                    engineOnline = engineOnline, loadedModels = runningModels
                };
                return _monitorCache;
            }
        }
        private bool HandleDesktopServices(HttpListenerRequest req, HttpListenerResponse res, string path, string method) {
            if (path == "/api/setup" && method == "GET") { WriteJson(res, 200, SetupSnapshot()); return true; }
            if (path == "/api/setup/start" && method == "POST") { StartSetup(); WriteJson(res, 202, SetupSnapshot()); return true; }
            if (path == "/api/setup/cancel" && method == "POST") {
                lock (SetupLock) { if (_setupCancellation != null) _setupCancellation.Cancel(); }
                WriteJson(res, 200, SetupSnapshot()); return true;
            }
            if (path == "/api/system" && method == "GET") { WriteJson(res, 200, MonitorSnapshot()); return true; }
            if (path == "/api/logs" && method == "GET") {
                lock (LogLock) {
                    var lines = File.Exists(LogPath) ? File.ReadAllLines(LogPath, Encoding.UTF8) : new string[0];
                    var recent = new List<object>();
                    for (int i = Math.Max(0, lines.Length - 300); i < lines.Length; i++) { try { recent.Add(new JavaScriptSerializer().DeserializeObject(lines[i])); } catch { } }
                    WriteJson(res, 200, new { entries = recent, path = LogPath });
                }
                return true;
            }
            if (path == "/api/logs" && method == "DELETE") {
                lock (LogLock) { if (File.Exists(LogPath)) File.Delete(LogPath); if (File.Exists(LogPath + ".1")) File.Delete(LogPath + ".1"); }
                WriteJson(res, 200, new { cleared = true }); return true;
            }
            return false;
        }
        private void ExportLogs() {
            using (var dialog = new SaveFileDialog { Title = "Export Sanctum logs", Filter = "JSON Lines (*.jsonl)|*.jsonl", FileName = "sanctum-logs.jsonl" }) {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try { lock (LogLock) File.WriteAllText(dialog.FileName, File.Exists(LogPath) ? File.ReadAllText(LogPath, Encoding.UTF8) : "", new UTF8Encoding(false)); }
                catch (Exception ex) { MessageBox.Show(this, ex.Message, "Log export failed"); }
            }
        }
    }
}
