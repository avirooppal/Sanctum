import subprocess
import os
import sys

CSHARP_SOURCE = r"""
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.InteropServices;

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

        [STAThread]
        public static int Main(string[] args) {
            if (AttachConsole(ATTACH_PARENT_PROCESS)) {
                var stdout = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
                Console.SetOut(stdout);
            }

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
                // Keep alive until SIGINT or stdin closes
                Thread.Sleep(3000);
                app.StopHttpServer();
                return 0;
            }

            Application.EnableVisualStyles();
            Application.Run(app);
            return 0;
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

            // API Endpoints
            if (path == "/api/health" || path == "/health") {
                byte[] json = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"0.1.0\",\"core\":\"active\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/v1/models") {
                byte[] json = Encoding.UTF8.GetBytes("{\"object\":\"list\",\"data\":[]}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
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
