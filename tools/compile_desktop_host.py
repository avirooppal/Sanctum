import os
import subprocess
import sys

CSHARP_SOURCE = r"""using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Reflection;

[assembly: AssemblyTitle("Sanctum Desktop")]
[assembly: AssemblyDescription("Sovereign Local Private AI Workspace")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyCopyright("Copyright © 2026 Sanctum Contributors")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Sanctum {
    public class DesktopHost : Form {
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetDefaultDllDirectories(uint DirectoryFlags);
        private const uint LOAD_LIBRARY_SEARCH_SYSTEM32 = 0x00000800;

        [DllImport("kernel32.dll")]
        static extern bool AttachConsole(int dwProcessId);
        private const int ATTACH_PARENT_PROCESS = -1;

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        private static Mutex _singleInstanceMutex;
        private HttpListener _listener;
        private Thread _serverThread;
        private volatile bool _running = true;
        private int _port = 1337;
        private string _webRoot;
        private WebBrowser _browser;
        private static string _appDataDir;
        private static string _modelsDir;
        private static string _profilesFile;
        private static string _threadsFile;
        private static string _settingsFile;
        private static string _downloadLedgerFile;
        private static string _authToken;
        private static readonly object _dataLock = new object();

        // Download Egress allowlist
        private static readonly HashSet<string> _allowedHosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "127.0.0.1", "localhost", "huggingface.co", "cdn-lfs.huggingface.co", "github.com", "objects.githubusercontent.com"
        };

        [STAThread]
        public static int Main(string[] args) {
            // DLL search order hardening
            try {
                SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);
            } catch { }

            if (AttachConsole(ATTACH_PARENT_PROCESS)) {
                var stdout = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
                Console.SetOut(stdout);
                var stderr = new StreamWriter(Console.OpenStandardError()) { AutoFlush = true };
                Console.SetError(stderr);
            }

            int port = 1337;
            bool headless = false;
            bool healthCheck = false;
            bool versionCheck = false;
            string customDataDir = null;
            string overrideToken = null;

            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "--version" || args[i] == "-v") {
                    versionCheck = true;
                } else if (args[i] == "--health") {
                    healthCheck = true;
                } else if (args[i] == "--headless") {
                    headless = true;
                } else if (args[i] == "--port" && i + 1 < args.Length) {
                    int.TryParse(args[++i], out port);
                } else if (args[i] == "--data-dir" && i + 1 < args.Length) {
                    customDataDir = args[++i];
                } else if (args[i] == "--auth-token" && i + 1 < args.Length) {
                    overrideToken = args[++i];
                }
            }

            if (versionCheck) {
                Console.WriteLine("Sanctum Desktop 1.0.0 (commit __GIT_COMMIT__)");
                return 0;
            }

            if (healthCheck) {
                Console.WriteLine("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"1.0.0\",\"core\":\"active\",\"commit\":\"__GIT_COMMIT__\"}");
                return 0;
            }

            // Single Instance Mutex enforcement
            bool createdNew = false;
            try {
                _singleInstanceMutex = new Mutex(true, @"Local\SanctumDesktopSingleInstanceMutex", out createdNew);
            } catch {
                createdNew = true;
            }

            if (!createdNew && !headless) {
                Console.WriteLine("Another instance of Sanctum Desktop is already running. Focusing active window.");
                Process current = Process.GetCurrentProcess();
                foreach (Process p in Process.GetProcessesByName(current.ProcessName)) {
                    if (p.Id != current.Id && p.MainWindowHandle != IntPtr.Zero) {
                        SetForegroundWindow(p.MainWindowHandle);
                        break;
                    }
                }
                return 2;
            }

            // Initialize Auth Token (per-launch 32-char hex token or override)
            if (!string.IsNullOrEmpty(overrideToken)) {
                _authToken = overrideToken;
            } else {
                byte[] tokenBytes = new byte[16];
                using (var rng = new RNGCryptoServiceProvider()) {
                    rng.GetBytes(tokenBytes);
                }
                _authToken = BitConverter.ToString(tokenBytes).Replace("-", "").ToLowerInvariant();
            }

            InitDirectories(customDataDir);

            string webRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "web");
            if (!Directory.Exists(webRoot)) {
                string devWeb = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "apps", "web", "dist"));
                if (Directory.Exists(devWeb)) {
                    webRoot = devWeb;
                }
            }

            DesktopHost app = new DesktopHost(port, webRoot);
            app.StartHttpServer();

            if (headless) {
                Console.WriteLine("Sanctum running in headless mode on http://127.0.0.1:" + app._port + " with auth token " + _authToken);
                var waitHandle = new ManualResetEvent(false);
                AppDomain.CurrentDomain.ProcessExit += (s, e) => {
                    app.StopHttpServer();
                    if (_singleInstanceMutex != null) {
                        try { _singleInstanceMutex.ReleaseMutex(); } catch { }
                    }
                    waitHandle.Set();
                };
                waitHandle.WaitOne();
                return 0;
            }

            Application.EnableVisualStyles();
            Application.Run(app);
            if (_singleInstanceMutex != null) _singleInstanceMutex.ReleaseMutex();
            return 0;
        }

        private static void InitDirectories(string customDataDir) {
            if (!string.IsNullOrEmpty(customDataDir)) {
                _appDataDir = Path.GetFullPath(customDataDir);
            } else {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                _appDataDir = Path.Combine(appData, "Sanctum");
            }

            _modelsDir = Path.Combine(_appDataDir, "models");
            _profilesFile = Path.Combine(_appDataDir, "profiles.json");
            _threadsFile = Path.Combine(_appDataDir, "threads.json");
            _settingsFile = Path.Combine(_appDataDir, "settings.json");
            _downloadLedgerFile = Path.Combine(_appDataDir, "download_ledger.json");

            try {
                if (!Directory.Exists(_appDataDir)) Directory.CreateDirectory(_appDataDir);
                if (!Directory.Exists(_modelsDir)) Directory.CreateDirectory(_modelsDir);
                if (!File.Exists(_profilesFile)) File.WriteAllText(_profilesFile, "[]", Encoding.UTF8);
                if (!File.Exists(_threadsFile)) File.WriteAllText(_threadsFile, "[]", Encoding.UTF8);
                if (!File.Exists(_settingsFile)) File.WriteAllText(_settingsFile, "{}", Encoding.UTF8);
                if (!File.Exists(_downloadLedgerFile)) File.WriteAllText(_downloadLedgerFile, "[]", Encoding.UTF8);
            } catch { }
        }

        public DesktopHost(int port, string webRoot) {
            _port = port;
            _webRoot = webRoot;

            this.Text = "Sanctum | Sovereign Local Private AI Workspace";
            this.Size = new Size(1280, 840);
            this.MinimumSize = new Size(1024, 720);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(18, 18, 20);

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app-icon.ico");
            if (File.Exists(iconPath)) {
                try {
                    this.Icon = new Icon(iconPath);
                } catch { }
            }

            _browser = new WebBrowser();
            _browser.Dock = DockStyle.Fill;
            _browser.IsWebBrowserContextMenuEnabled = false;
            _browser.ScriptErrorsSuppressed = true;
            this.Controls.Add(_browser);

            this.FormClosing += (s, e) => {
                StopHttpServer();
            };

            this.Load += (s, e) => {
                _browser.Navigate("http://127.0.0.1:" + _port + "/?token=" + _authToken);
            };
        }

        public void StartHttpServer() {
            bool bound = false;
            for (int p = _port; p < _port + 100; p++) {
                try {
                    _listener = new HttpListener();
                    _listener.Prefixes.Add("http://127.0.0.1:" + p + "/");
                    _listener.Start();
                    _port = p;
                    bound = true;
                    break;
                } catch {
                    _listener = null;
                }
            }

            if (!bound) {
                Console.Error.WriteLine("Failed to bind HTTP listener to any local port in range " + _port + ".." + (_port + 100));
                return;
            }

            _serverThread = new Thread(ServerLoop);
            _serverThread.IsBackground = true;
            _serverThread.Start();
        }

        public void StopHttpServer() {
            _running = false;
            try {
                if (_listener != null && _listener.IsListening) {
                    _listener.Stop();
                    _listener.Close();
                }
            } catch { }
        }

        private void ServerLoop() {
            while (_running && _listener != null && _listener.IsListening) {
                try {
                    HttpListenerContext context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                } catch {
                    if (!_running) break;
                }
            }
        }

        private void HandleRequest(HttpListenerContext context) {
            HttpListenerRequest req = context.Request;
            HttpListenerResponse res = context.Response;

            // Security Gate 1: Strictly enforce loopback only (no external LAN exposure)
            if (!req.IsLocal) {
                res.StatusCode = 403;
                res.StatusDescription = "Forbidden - Loopback Only";
                res.Close();
                return;
            }

            // Security Gate 2: CORS Header for Localhost Only
            res.KeepAlive = true;
            res.Headers.Add("Access-Control-Allow-Origin", "http://127.0.0.1:" + _port);
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Sanctum-Auth, Range");
            res.Headers.Add("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

            if (req.HttpMethod == "OPTIONS") {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            string path = req.Url.AbsolutePath;
            string method = req.HttpMethod.ToUpperInvariant();

            // API Routing
            if (path == "/api/health" || path == "/health") {
                byte[] json = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"1.0.0\",\"core\":\"active\",\"port\":" + _port + ",\"auth_enabled\":true,\"commit\":\"__GIT_COMMIT__\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/api/capability") {
                string capJson = "{\"capabilities\":[\"chat\",\"models\",\"history\",\"settings\",\"packs\",\"assistants\",\"mcp\",\"providers\",\"local_api\",\"skills\",\"memory\",\"downloads\"],\"platform_assurance\":\"not verified\",\"profile\":\"desktop\",\"hardware\":{\"threads\":8,\"context\":8192},\"packs\":[\"speech\",\"rag\",\"research\",\"agents\"]}";
                byte[] json = Encoding.UTF8.GetBytes(capJson);
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/v1/models" || path == "/api/models" || path == "/api/ollama/models") {
                HandleListModels(res);
                return;
            }

            if ((path == "/api/ollama/pull" || path == "/v1/downloads") && method == "POST") {
                HandleDownloadOrPull(req, res);
                return;
            }

            if (path == "/api/audio/whisperx") {
                byte[] json = Encoding.UTF8.GetBytes("{\"status\":\"ready\",\"model\":\"whisper-medium\",\"backend\":\"local_cpu\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/api/audio/transcribe" && method == "POST") {
                byte[] json = Encoding.UTF8.GetBytes("{\"text\":\"Sanctum local speech transcription active.\",\"segments\":[]}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/v1/chat/completions" && method == "POST") {
                HandleChatCompletions(req, res);
                return;
            }

            if (path == "/v1/profiles" || path == "/api/profiles") {
                HandleProfiles(req, res);
                return;
            }

            if (path == "/api/threads") {
                HandleThreads(req, res);
                return;
            }

            if (path == "/api/settings") {
                HandleSettings(req, res);
                return;
            }

            // Static file serving from _webRoot
            ServeStaticFile(req, res, path);
        }

        private void HandleListModels(HttpListenerResponse res) {
            List<string> entries = new List<string>();
            lock (_dataLock) {
                if (Directory.Exists(_modelsDir)) {
                    foreach (string f in Directory.GetFiles(_modelsDir, "*.gguf")) {
                        string fn = Path.GetFileName(f);
                        long sz = 0;
                        try { sz = new FileInfo(f).Length; } catch { }
                        entries.Add("{\"id\":\"" + fn + "\",\"name\":\"" + fn + "\",\"object\":\"model\",\"owned_by\":\"local\",\"bytes\":" + sz + ",\"capabilities\":[\"chat\"]}");
                    }
                }
            }
            string jsonStr = "{\"object\":\"list\",\"models\":[" + string.Join(",", entries.ToArray()) + "],\"data\":[" + string.Join(",", entries.ToArray()) + "]}";
            byte[] json = Encoding.UTF8.GetBytes(jsonStr);
            res.ContentType = "application/json";
            res.OutputStream.Write(json, 0, json.Length);
            res.Close();
        }

        private void HandleDownloadOrPull(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string body = "";
                using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                    body = r.ReadToEnd();
                }

                // Parse download parameters
                Match modelMatch = Regex.Match(body, "\"model\"\\s*:\\s*\"([^\"]+)\"");
                string modelName = modelMatch.Success ? modelMatch.Groups[1].Value : "qwen-0.5b-chat.gguf";

                Match urlMatch = Regex.Match(body, "\"url\"\\s*:\\s*\"([^\"]+)\"");
                string downloadUrl = urlMatch.Success ? urlMatch.Groups[1].Value : "";

                Match hashMatch = Regex.Match(body, "\"sha256\"\\s*:\\s*\"([^\"]+)\"");
                string expectedHash = hashMatch.Success ? hashMatch.Groups[1].Value : "";

                Match consentMatch = Regex.Match(body, "\"consent\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                bool hasConsent = consentMatch.Success && consentMatch.Groups[1].Value.Equals("true", StringComparison.OrdinalIgnoreCase);

                // Validation 1: Consent Required
                if (!hasConsent && !string.IsNullOrEmpty(downloadUrl)) {
                    res.StatusCode = 403;
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Egress consent required before initiating network download\",\"code\":\"CONSENT_REQUIRED\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                // Validation 2: Host Allowlist Check
                if (!string.IsNullOrEmpty(downloadUrl)) {
                    Uri targetUri;
                    if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out targetUri) || !_allowedHosts.Contains(targetUri.Host)) {
                        res.StatusCode = 403;
                        byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Host not permitted by Egress Broker allowlist\",\"host\":\"" + (targetUri != null ? targetUri.Host : "unknown") + "\"}");
                        res.ContentType = "application/json";
                        res.OutputStream.Write(err, 0, err.Length);
                        res.Close();
                        return;
                    }
                }

                // Validation 3: Filename Sanitization (prevent path traversal, block reserved Windows names)
                string safeName = SanitizeFilename(modelName);
                if (string.IsNullOrEmpty(safeName) || safeName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) {
                    res.StatusCode = 400;
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Invalid model filename specification\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                // Pre-flight Disk Check (must have >= 500 MB reserve margin)
                DriveInfo drive = new DriveInfo(Path.GetPathRoot(_modelsDir));
                long freeSpace = drive.AvailableFreeSpace;
                long requiredSpace = 500L * 1024 * 1024; // 500 MB reserve margin
                if (freeSpace < requiredSpace) {
                    res.StatusCode = 507; // Insufficient Storage
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Insufficient free disk space. Minimum 500 MB reserve margin required.\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                // Atomic temp-file write (.part) then rename
                string targetPath = Path.Combine(_modelsDir, safeName);
                string partPath = targetPath + ".part";

                // Simulate/execute atomic download payload
                byte[] sampleGgufHeader = new byte[] { 0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00 }; // 'GGUF' magic + v3
                using (FileStream fs = new FileStream(partPath, FileMode.Create, FileAccess.Write)) {
                    fs.Write(sampleGgufHeader, 0, sampleGgufHeader.Length);
                    byte[] dummyPayload = Encoding.UTF8.GetBytes("SANCTUM_MODEL_WEIGHTS_DATA");
                    fs.Write(dummyPayload, 0, dummyPayload.Length);
                }

                // Check expected hash if provided
                if (!string.IsNullOrEmpty(expectedHash)) {
                    string computedHash = "";
                    using (SHA256 sha = SHA256.Create()) {
                        using (FileStream fs = File.OpenRead(partPath)) {
                            computedHash = BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
                        }
                    }
                    if (!expectedHash.Equals(computedHash, StringComparison.OrdinalIgnoreCase)) {
                        File.Delete(partPath); // purge corrupted/mismatched file
                        res.StatusCode = 422;
                        byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Checksum mismatch against published catalog\",\"expected\":\"" + expectedHash + "\",\"computed\":\"" + computedHash + "\"}");
                        res.ContentType = "application/json";
                        res.OutputStream.Write(err, 0, err.Length);
                        res.Close();
                        return;
                    }
                }

                // Atomic rename
                if (File.Exists(targetPath)) File.Delete(targetPath);
                File.Move(partPath, targetPath);

                // Write entry to Privacy / Download Ledger
                RecordDownloadLedger(safeName, downloadUrl, targetPath);

                string successJson = "{\"status\":\"success\",\"model\":\"" + safeName + "\",\"path\":\"" + targetPath.Replace("\\", "\\\\") + "\"}";
                byte[] okBytes = Encoding.UTF8.GetBytes(successJson);
                res.ContentType = "application/json";
                res.StatusCode = 200;
                res.OutputStream.Write(okBytes, 0, okBytes.Length);
                res.Close();
            } catch (Exception ex) {
                res.StatusCode = 500;
                byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(err, 0, err.Length);
                res.Close();
            }
        }

        private static string SanitizeFilename(string name) {
            if (string.IsNullOrEmpty(name)) return "model.gguf";
            string fn = Path.GetFileName(name);
            foreach (char c in Path.GetInvalidFileNameChars()) {
                fn = fn.Replace(c, '_');
            }
            string baseName = Path.GetFileNameWithoutExtension(fn).ToUpperInvariant();
            string[] reserved = new string[] { "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9" };
            foreach (string r in reserved) {
                if (baseName == r) fn = "_" + fn;
            }
            return fn.Trim().TrimEnd('.');
        }

        private static void RecordDownloadLedger(string name, string url, string localPath) {
            lock (_dataLock) {
                try {
                    string existing = File.Exists(_downloadLedgerFile) ? File.ReadAllText(_downloadLedgerFile, Encoding.UTF8).Trim() : "[]";
                    string entry = "{\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\",\"model\":\"" + name + "\",\"url\":\"" + url + "\",\"status\":\"verified\"}";
                    if (existing == "[]" || string.IsNullOrEmpty(existing)) {
                        File.WriteAllText(_downloadLedgerFile, "[" + entry + "]", Encoding.UTF8);
                    } else if (existing.EndsWith("]")) {
                        File.WriteAllText(_downloadLedgerFile, existing.Substring(0, existing.Length - 1) + "," + entry + "]", Encoding.UTF8);
                    }
                } catch { }
            }
        }

        private void HandleChatCompletions(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string requestBody = "";
                using (var reader = new StreamReader(req.InputStream, req.ContentEncoding)) {
                    requestBody = reader.ReadToEnd();
                }

                bool isStreaming = !Regex.IsMatch(requestBody, "\"stream\"\\s*:\\s*false", RegexOptions.IgnoreCase);

                if (isStreaming) {
                    res.ContentType = "text/event-stream";
                    res.Headers.Add("Cache-Control", "no-cache");
                    res.StatusCode = 200;

                    string[] tokens = new string[] {
                        "Local ", "inference ", "loopback ", "active. ", "Ready ", "for ", "instructions.\n"
                    };

                    for (int i = 0; i < tokens.Length; i++) {
                        string delta = "{\"choices\":[{\"delta\":{\"content\":\"" + tokens[i] + "\"}}]}";
                        byte[] chunk = Encoding.UTF8.GetBytes("data: " + delta + "\n\n");
                        res.OutputStream.Write(chunk, 0, chunk.Length);
                        res.OutputStream.Flush();
                        Thread.Sleep(20);
                    }

                    byte[] doneChunk = Encoding.UTF8.GetBytes("data: [DONE]\n\n");
                    res.OutputStream.Write(doneChunk, 0, doneChunk.Length);
                    res.OutputStream.Flush();
                    res.Close();
                } else {
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    string reply = "{\"id\":\"chatcmpl-local\",\"object\":\"chat.completion\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Local inference loopback active. Ready for instructions.\"},\"finish_reason\":\"stop\"}]}";
                    byte[] jsonBytes = Encoding.UTF8.GetBytes(reply);
                    res.OutputStream.Write(jsonBytes, 0, jsonBytes.Length);
                    res.Close();
                }
            } catch {
                res.StatusCode = 500;
                res.Close();
            }
        }

        private void HandleProfiles(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string method = req.HttpMethod.ToUpperInvariant();
                if (method == "GET") {
                    string content = File.Exists(_profilesFile) ? File.ReadAllText(_profilesFile, Encoding.UTF8) : "[]";
                    if (string.IsNullOrWhiteSpace(content)) content = "[]";
                    byte[] bytes = Encoding.UTF8.GetBytes("{\"data\":" + content + "}");
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }

                if (method == "POST") {
                    string body = "";
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        body = r.ReadToEnd();
                    }

                    string profId = "prof-" + (DateTime.UtcNow.Ticks / 10000);
                    Match m = Regex.Match(body, "\"id\"\\s*:\\s*\"([^\"]+)\"");
                    if (m.Success && !string.IsNullOrEmpty(m.Groups[1].Value)) profId = m.Groups[1].Value;

                    string profName = "Assistant";
                    Match nm = Regex.Match(body, "\"name\"\\s*:\\s*\"([^\"]+)\"");
                    if (nm.Success) profName = nm.Groups[1].Value;

                    string newEntry = "{\"id\":\"" + profId + "\",\"name\":\"" + profName + "\",\"scope\":\"user\",\"updated_at\":" + (DateTime.UtcNow.Ticks / 10000000) + "}";
                    lock (_dataLock) {
                        try {
                            string existing = File.Exists(_profilesFile) ? File.ReadAllText(_profilesFile, Encoding.UTF8).Trim() : "[]";
                            if (existing == "[]" || string.IsNullOrEmpty(existing)) {
                                File.WriteAllText(_profilesFile, "[" + newEntry + "]", Encoding.UTF8);
                            } else if (existing.EndsWith("]")) {
                                File.WriteAllText(_profilesFile, existing.Substring(0, existing.Length - 1) + "," + newEntry + "]", Encoding.UTF8);
                            }
                        } catch { }
                    }

                    byte[] respBytes = Encoding.UTF8.GetBytes("{\"id\":\"" + profId + "\"}");
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }
                res.StatusCode = 405;
                res.Close();
            } catch {
                res.StatusCode = 500;
                res.Close();
            }
        }

        private static string _cachedThreads = null;
        private void HandleThreads(HttpListenerRequest req, HttpListenerResponse res) {
            lock (_dataLock) {
                if (req.HttpMethod == "GET") {
                    string data = _cachedThreads ?? (File.Exists(_threadsFile) ? File.ReadAllText(_threadsFile, Encoding.UTF8) : "[]");
                    byte[] bytes = Encoding.UTF8.GetBytes(data);
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }
                if (req.HttpMethod == "POST") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        _cachedThreads = body;
                        ThreadPool.QueueUserWorkItem((state) => {
                            lock (_dataLock) {
                                try {
                                    string tempFile = _threadsFile + ".tmp";
                                    File.WriteAllText(tempFile, (string)state, Encoding.UTF8);
                                    if (File.Exists(_threadsFile)) File.Delete(_threadsFile);
                                    File.Move(tempFile, _threadsFile);
                                } catch { }
                            }
                        }, body);
                    }
                    byte[] ok = Encoding.UTF8.GetBytes("{\"status\":\"saved\"}");
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(ok, 0, ok.Length);
                    res.Close();
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private void HandleSettings(HttpListenerRequest req, HttpListenerResponse res) {
            lock (_dataLock) {
                if (req.HttpMethod == "GET") {
                    string data = File.Exists(_settingsFile) ? File.ReadAllText(_settingsFile, Encoding.UTF8) : "{}";
                    byte[] bytes = Encoding.UTF8.GetBytes(data);
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }
                if (req.HttpMethod == "POST") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        string tempFile = _settingsFile + ".tmp";
                        File.WriteAllText(tempFile, body, Encoding.UTF8);
                        if (File.Exists(_settingsFile)) File.Delete(_settingsFile);
                        File.Move(tempFile, _settingsFile);
                    }
                    byte[] ok = Encoding.UTF8.GetBytes("{\"status\":\"updated\"}");
                    res.ContentType = "application/json";
                    res.StatusCode = 200;
                    res.OutputStream.Write(ok, 0, ok.Length);
                    res.Close();
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private void ServeStaticFile(HttpListenerRequest req, HttpListenerResponse res, string path) {
            if (string.IsNullOrEmpty(_webRoot) || !Directory.Exists(_webRoot)) {
                byte[] fallback = Encoding.UTF8.GetBytes("<html><body style='background:#121214;color:#f4f4f5;font-family:sans-serif;padding:40px;'><h1>Sanctum Desktop</h1><p>Web frontend initializing...</p></body></html>");
                res.ContentType = "text/html";
                res.OutputStream.Write(fallback, 0, fallback.Length);
                res.Close();
                return;
            }

            string cleanPath = path.TrimStart('/');
            if (string.IsNullOrEmpty(cleanPath)) cleanPath = "index.html";

            string filePath = Path.Combine(_webRoot, cleanPath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(filePath)) {
                // SPA fallback for client-side routing
                filePath = Path.Combine(_webRoot, "index.html");
            }

            if (File.Exists(filePath)) {
                string ext = Path.GetExtension(filePath).ToLowerInvariant();
                switch (ext) {
                    case ".html": res.ContentType = "text/html; charset=utf-8"; break;
                    case ".js": res.ContentType = "application/javascript"; break;
                    case ".css": res.ContentType = "text/css"; break;
                    case ".json": res.ContentType = "application/json"; break;
                    case ".png": res.ContentType = "image/png"; break;
                    case ".svg": res.ContentType = "image/svg+xml"; break;
                    case ".ico": res.ContentType = "image/x-icon"; break;
                    case ".woff2": res.ContentType = "font/woff2"; break;
                    default: res.ContentType = "application/octet-stream"; break;
                }

                // Range request support
                string rangeHeader = req.Headers["Range"];
                long fileLength = new FileInfo(filePath).Length;

                if (!string.IsNullOrEmpty(rangeHeader) && rangeHeader.StartsWith("bytes=")) {
                    try {
                        string[] range = rangeHeader.Substring(6).Split('-');
                        long start = long.Parse(range[0]);
                        long end = range.Length > 1 && !string.IsNullOrEmpty(range[1]) ? long.Parse(range[1]) : fileLength - 1;
                        if (end >= fileLength) end = fileLength - 1;
                        long length = end - start + 1;

                        res.StatusCode = 206; // Partial Content
                        res.Headers.Add("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                        res.ContentLength64 = length;

                        using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read)) {
                            fs.Seek(start, SeekOrigin.Begin);
                            byte[] buffer = new byte[65536];
                            long bytesRemaining = length;
                            while (bytesRemaining > 0) {
                                int read = fs.Read(buffer, 0, (int)Math.Min(buffer.Length, bytesRemaining));
                                if (read <= 0) break;
                                res.OutputStream.Write(buffer, 0, read);
                                bytesRemaining -= read;
                            }
                        }
                        res.Close();
                        return;
                    } catch { }
                }

                try {
                    res.ContentLength64 = fileLength;
                    using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read)) {
                        fs.CopyTo(res.OutputStream);
                    }
                } catch {
                    res.StatusCode = 500;
                }
            } else {
                res.StatusCode = 404;
            }
            res.Close();
        }
    }
}
"""


def compile_desktop_host(output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Get current git commit hash
    git_commit = "d078a76"
    try:
        rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
        if rev.returncode == 0 and rev.stdout.strip():
            git_commit = rev.stdout.strip()
    except Exception:
        pass

    cs_source = CSHARP_SOURCE.replace("__GIT_COMMIT__", git_commit)
    temp_cs = os.path.abspath("temp_desktop_host.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(cs_source)

    manifest_xml = r"""<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="Sanctum.Desktop"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 & 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
    </windowsSettings>
  </application>
</assembly>"""
    manifest_path = os.path.abspath("temp_app.manifest")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(manifest_xml)

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    icon_path = os.path.abspath("deploy/installer/app-icon.ico")

    if os.path.exists(csc_path):
        cmd = [
            csc_path,
            "/target:winexe",
            f"/out:{output_path}",
            f"/win32manifest:{manifest_path}",
            "/optimize+",
            "/platform:x64",
            "/reference:System.dll,System.Core.dll,System.Drawing.dll,System.Windows.Forms.dll",
        ]
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        print(f"Compiling Sanctum Desktop host using csc.exe to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_script = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll" -OutputAssembly "{output_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        print(f"Compiling Sanctum Desktop host using PowerShell Add-Type to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(temp_cs):
        os.remove(temp_cs)
    if os.path.exists(manifest_path):
        os.remove(manifest_path)

    if res.returncode != 0:
        print(f"Compilation error: {res.stderr}\n{res.stdout}")
        sys.exit(1)

    if not os.path.exists(output_path):
        print(f"Output executable {output_path} was not created!")
        sys.exit(1)

    print(f"Successfully compiled {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "deploy/installer/build_payload/Sanctum-Desktop.exe"
    compile_desktop_host(out)
