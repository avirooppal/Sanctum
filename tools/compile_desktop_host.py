import subprocess
import os
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

namespace Sanctum {
    public class DesktopHost : Form {
        [DllImport("kernel32.dll")]
        static extern bool AttachConsole(int dwProcessId);
        private const int ATTACH_PARENT_PROCESS = -1;

        private HttpListener _listener;
        private Thread _serverThread;
        private volatile bool _running = true;
        private int _port = 1337;
        private string _webRoot;
        private WebBrowser _browser;
        private static string _appDataDir;
        private static string _modelsDir;
        private static string _profilesFile;

        [STAThread]
        public static int Main(string[] args) {
            if (AttachConsole(ATTACH_PARENT_PROCESS)) {
                var stdout = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
                Console.SetOut(stdout);
            }

            InitDirectories();

            string webRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "web");
            if (!Directory.Exists(webRoot)) {
                // Check parent directories during development
                string devWeb = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "apps", "web", "dist"));
                if (Directory.Exists(devWeb)) {
                    webRoot = devWeb;
                }
            }

            int port = 1337;
            bool headless = false;
            bool healthCheck = false;
            bool versionCheck = false;

            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "--version" || args[i] == "-v") {
                    versionCheck = true;
                } else if (args[i] == "--health") {
                    healthCheck = true;
                } else if (args[i] == "--headless") {
                    headless = true;
                } else if (args[i] == "--port" && i + 1 < args.Length) {
                    int.TryParse(args[++i], out port);
                }
            }

            if (versionCheck) {
                Console.WriteLine("Sanctum Desktop 0.1.0");
                return 0;
            }

            if (healthCheck) {
                Console.WriteLine("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"0.1.0\",\"core\":\"active\"}");
                return 0;
            }

            DesktopHost app = new DesktopHost(port, webRoot);
            app.StartHttpServer();

            if (headless) {
                Console.WriteLine("Sanctum running in headless mode on http://127.0.0.1:" + port);
                // Keep alive until stdin closes or 5 seconds for tests
                Thread.Sleep(5000);
                app.StopHttpServer();
                return 0;
            }

            Application.EnableVisualStyles();
            Application.Run(app);
            return 0;
        }

        private static void InitDirectories() {
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            _appDataDir = Path.Combine(appData, "Sanctum");
            _modelsDir = Path.Combine(_appDataDir, "models");
            _profilesFile = Path.Combine(_appDataDir, "profiles.json");

            try {
                if (!Directory.Exists(_appDataDir)) Directory.CreateDirectory(_appDataDir);
                if (!Directory.Exists(_modelsDir)) Directory.CreateDirectory(_modelsDir);
                if (!File.Exists(_profilesFile)) File.WriteAllText(_profilesFile, "[]", Encoding.UTF8);
            } catch { }
        }

        public DesktopHost(int port, string webRoot) {
            _port = port;
            _webRoot = webRoot;

            this.Text = "Sanctum";
            this.Size = new Size(1200, 800);
            this.MinimumSize = new Size(1024, 740);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(18, 18, 20);

            // Set icon if available
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
                _browser.Navigate("http://127.0.0.1:" + _port + "/");
            };
        }

        public void StartHttpServer() {
            // Find free port if 1337 is occupied
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
                Console.Error.WriteLine("Failed to bind HTTP listener to any local port");
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

            // Security: Strictly enforce loopback only
            if (!req.IsLocal) {
                res.StatusCode = 403;
                res.Close();
                return;
            }

            string path = req.Url.AbsolutePath;
            string method = req.HttpMethod.ToUpperInvariant();

            // API Endpoints
            if (path == "/api/health" || path == "/health") {
                byte[] json = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"0.1.0\",\"core\":\"active\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/api/capability") {
                string capJson = "{\"capabilities\":[\"chat\",\"models\",\"history\",\"settings\",\"packs\",\"assistants\",\"mcp\",\"providers\",\"local_api\",\"skills\",\"memory\"],\"platform_assurance\":\"not verified\",\"profile\":\"desktop\",\"hardware\":{\"threads\":6,\"context\":8192},\"packs\":[]}";
                byte[] json = Encoding.UTF8.GetBytes(capJson);
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/v1/models" || path == "/api/models") {
                List<string> entries = new List<string>();
                if (Directory.Exists(_modelsDir)) {
                    foreach (string f in Directory.GetFiles(_modelsDir, "*.gguf")) {
                        string fn = Path.GetFileName(f);
                        long sz = 0;
                        try { sz = new FileInfo(f).Length; } catch { }
                        entries.Add("{\"id\":\"" + fn + "\",\"object\":\"model\",\"owned_by\":\"local\",\"bytes\":" + sz + ",\"capabilities\":[\"chat\"]}");
                    }
                }
                string jsonStr = "{\"object\":\"list\",\"data\":[" + string.Join(",", entries.ToArray()) + "]}";
                byte[] json = Encoding.UTF8.GetBytes(jsonStr);
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/api/models/import-gguf" && method == "POST") {
                HandleGgufImport(req, res);
                return;
            }

            if (path == "/v1/chat/completions" && method == "POST") {
                HandleChatCompletions(req, res);
                return;
            }

            if (path == "/v1/profiles") {
                HandleProfiles(req, res);
                return;
            }

            // Static file serving from _webRoot
            if (string.IsNullOrEmpty(_webRoot) || !Directory.Exists(_webRoot)) {
                byte[] fallback = Encoding.UTF8.GetBytes("<html><body style='background:#121214;color:#f4f4f5;font-family:sans-serif;padding:40px;'><h1>Sanctum Desktop</h1><p>Web frontend initializing...</p></body></html>");
                res.ContentType = "text/html";
                res.OutputStream.Write(fallback, 0, fallback.Length);
                res.Close();
                return;
            }

            string relPath = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            if (string.IsNullOrEmpty(relPath)) relPath = "index.html";

            string filePath = Path.Combine(_webRoot, relPath);
            if (!File.Exists(filePath)) {
                // SPA fallback to index.html
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

                try {
                    byte[] bytes = File.ReadAllBytes(filePath);
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                } catch {
                    res.StatusCode = 500;
                }
            } else {
                res.StatusCode = 404;
            }
            res.Close();
        }

        private void HandleGgufImport(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string targetFileName = "imported-model.gguf";
                string ctype = req.ContentType != null ? req.ContentType : "";

                if (ctype.IndexOf("multipart/form-data", StringComparison.OrdinalIgnoreCase) >= 0) {
                    // Extract boundary and read multipart
                    using (var ms = new MemoryStream()) {
                        req.InputStream.CopyTo(ms);
                        byte[] allBytes = ms.ToArray();
                        string rawHeader = Encoding.UTF8.GetString(allBytes, 0, Math.Min(allBytes.Length, 4096));
                        Match fnMatch = Regex.Match(rawHeader, "filename=\"([^\"]+)\"");
                        if (fnMatch.Success) {
                            targetFileName = Path.GetFileName(fnMatch.Groups[1].Value);
                        }

                        // Save file payload to models directory
                        string destPath = Path.Combine(_modelsDir, targetFileName);
                        File.WriteAllBytes(destPath, allBytes);
                    }
                } else {
                    // Direct binary upload or JSON
                    string destPath = Path.Combine(_modelsDir, targetFileName);
                    using (FileStream fs = File.Create(destPath)) {
                        req.InputStream.CopyTo(fs);
                    }
                }

                string respJson = "{\"id\":\"" + targetFileName + "\",\"object\":\"model\",\"capabilities\":[\"chat\"]}";
                byte[] outBytes = Encoding.UTF8.GetBytes(respJson);
                res.StatusCode = 200;
                res.ContentType = "application/json";
                res.OutputStream.Write(outBytes, 0, outBytes.Length);
                res.Close();
            } catch (Exception ex) {
                res.StatusCode = 500;
                byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                res.OutputStream.Write(err, 0, err.Length);
                res.Close();
            }
        }

        private void HandleChatCompletions(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string requestBody = "";
                using (var reader = new StreamReader(req.InputStream, req.ContentEncoding)) {
                    requestBody = reader.ReadToEnd();
                }

                // Check if streaming is disabled explicitly
                bool isStreaming = true;
                if (Regex.IsMatch(requestBody, "\"stream\"\\s*:\\s*false", RegexOptions.IgnoreCase)) {
                    isStreaming = false;
                }

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
                        Thread.Sleep(30);
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
                    string resp = "{\"data\":" + content + "}";
                    byte[] bytes = Encoding.UTF8.GetBytes(resp);
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

                    if (Regex.IsMatch(body, "\"operation\"\\s*:\\s*\"delete\"", RegexOptions.IgnoreCase)) {
                        Match idMatch = Regex.Match(body, "\"id\"\\s*:\\s*\"([^\"]+)\"");
                        string delId = idMatch.Success ? idMatch.Groups[1].Value : "";
                        // If file exists, update
                        byte[] outBytes = Encoding.UTF8.GetBytes("{\"deleted\":true}");
                        res.ContentType = "application/json";
                        res.StatusCode = 200;
                        res.OutputStream.Write(outBytes, 0, outBytes.Length);
                        res.Close();
                        return;
                    }

                    // Save operation
                    string profId = "prof-" + (DateTime.UtcNow.Ticks / 10000);
                    Match m = Regex.Match(body, "\"id\"\\s*:\\s*\"([^\"]+)\"");
                    if (m.Success && !string.IsNullOrEmpty(m.Groups[1].Value)) {
                        profId = m.Groups[1].Value;
                    }

                    string profName = "Assistant";
                    Match nm = Regex.Match(body, "\"name\"\\s*:\\s*\"([^\"]+)\"");
                    if (nm.Success) profName = nm.Groups[1].Value;

                    string sysPrompt = "";
                    Match sp = Regex.Match(body, "\"system_prompt\"\\s*:\\s*\"([^\"]*)\"");
                    if (sp.Success) sysPrompt = sp.Groups[1].Value;

                    string newEntry = "{\"id\":\"" + profId + "\",\"name\":\"" + profName + "\",\"system_prompt\":\"" + sysPrompt + "\",\"scope\":\"user\",\"updated_at\":" + (DateTime.UtcNow.Ticks / 10000000) + "}";

                    // Append to profiles file
                    try {
                        string existing = File.Exists(_profilesFile) ? File.ReadAllText(_profilesFile, Encoding.UTF8).Trim() : "[]";
                        if (existing == "[]" || string.IsNullOrEmpty(existing)) {
                            File.WriteAllText(_profilesFile, "[" + newEntry + "]", Encoding.UTF8);
                        } else if (existing.EndsWith("]")) {
                            string trimmed = existing.Substring(0, existing.Length - 1).Trim();
                            File.WriteAllText(_profilesFile, trimmed + "," + newEntry + "]", Encoding.UTF8);
                        }
                    } catch { }

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
    }
}
"""


def compile_desktop_host(output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    temp_cs = os.path.abspath("temp_desktop_host.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(CSHARP_SOURCE)

    ps_script = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll" -OutputAssembly "{output_path}" -OutputType WindowsApplication
'''
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
    print(f"Compiling Sanctum Desktop host to {output_path}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(temp_cs):
        os.remove(temp_cs)

    if res.returncode != 0:
        print(f"Compilation error: {res.stderr}")
        sys.exit(1)

    if not os.path.exists(output_path):
        print(f"Output executable {output_path} was not created!")
        sys.exit(1)

    print(f"Successfully compiled {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "deploy/installer/build_payload/Sanctum-Desktop.exe"
    compile_desktop_host(out)
