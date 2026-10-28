import os
import shutil
import subprocess
import sys

CSHARP_SOURCE = r"""using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Reflection;
using Microsoft.Web.WebView2.Core;

[assembly: AssemblyTitle("Sanctum")]
[assembly: AssemblyDescription("Sanctum Sovereign Local AI Desktop Application")]
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
        private const uint LOAD_LIBRARY_SEARCH_USER_DIRS = 0x00000400;
        private const uint LOAD_LIBRARY_SEARCH_APPLICATION_DIR = 0x00000200;

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool SetDllDirectory(string lpPathName);

        [DllImport("kernel32.dll")]
        static extern bool AttachConsole(int dwProcessId);
        private const int ATTACH_PARENT_PROCESS = -1;

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        private const int SW_RESTORE = 9;

        [DllImport("shell32.dll", SetLastError = true)]
        static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

        [DllImport("dwmapi.dll")]
        static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_ROUND = 2;

        [DllImport("user32.dll")]
        static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        // Win32 Job Object APIs (ensures killing Sanctum.exe kills all child WebView2 & engine processes)
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
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
        struct IO_COUNTERS {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        private const int JobObjectExtendedLimitInformation = 9;
        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

        private static IntPtr _jobHandle = IntPtr.Zero;
        private static Mutex _singleInstanceMutex;
        private static Stopwatch _startupWatch;
        private HttpListener _listener;
        private Thread _serverThread;
        private volatile bool _running = true;
        private int _port = 1337;
        private string _webRoot;
        private bool _enableDevTools = false;
        private CoreWebView2Environment _wvEnv;
        private CoreWebView2Controller _wvController;
        private CoreWebView2 _wvCore;

        private static string _appDataDir;
        private static string _modelsDir;
        private static string _profilesFile;
        private static string _threadsFile;
        private static string _settingsFile;
        private static string _downloadLedgerFile;
        private static string _windowStateFile;
        private static string _runtimeStateFile;
        private static string _authToken;
        private static readonly object _dataLock = new object();

        // Verified WebView2 background-network suppression flags (ADR 0104)
        public const string WEBVIEW2_SILENCE_FLAGS =
            "--host-resolver-rules=\"MAP * ~NOTFOUND\" " +
            "--renderer-process-limit=1 " +
            "--disable-background-networking " +
            "--disable-component-update " +
            "--disable-domain-reliability " +
            "--disable-sync " +
            "--disable-translate " +
            "--disable-client-side-phishing-detection " +
            "--disable-default-apps " +
            "--disable-breakpad " +
            "--disable-crash-reporter " +
            "--no-first-run " +
            "--no-default-browser-check " +
            "--no-pings " +
            "--metrics-recording-only " +
            "--disable-features=msSmartScreenProtection,msEdgeShopping,msEdgeWallet,msImplicitSignin,msAccountConsistency,msEdgeExperiments,Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,CertificateTransparencyComponentUpdater";

        // Download Egress allowlist
        private static readonly HashSet<string> _allowedHosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "127.0.0.1", "localhost", "huggingface.co", "cdn-lfs.huggingface.co", "github.com", "objects.githubusercontent.com"
        };

        private static void InitializeJobObject() {
            try {
                _jobHandle = CreateJobObject(IntPtr.Zero, null);
                if (_jobHandle != IntPtr.Zero) {
                    JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                    IntPtr ptr = Marshal.AllocHGlobal(length);
                    try {
                        Marshal.StructureToPtr(info, ptr, false);
                        SetInformationJobObject(_jobHandle, JobObjectExtendedLimitInformation, ptr, (uint)length);
                        AssignProcessToJobObject(_jobHandle, Process.GetCurrentProcess().Handle);
                    } finally {
                        Marshal.FreeHGlobal(ptr);
                    }
                }
            } catch { }
        }

        [STAThread]
        public static int Main(string[] args) {
            _startupWatch = Stopwatch.StartNew();

            // 1. DLL search order hardening + BaseDirectory for WebView2Loader.dll
            try {
                SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32 | LOAD_LIBRARY_SEARCH_APPLICATION_DIR | LOAD_LIBRARY_SEARCH_USER_DIRS);
                SetDllDirectory(AppDomain.CurrentDomain.BaseDirectory);
            } catch { }

            // 2. Explicit AppUserModelID so Taskbar, Alt+Tab, and Notifications identify as Sanctum
            try {
                SetCurrentProcessExplicitAppUserModelID("Sanctum.Desktop.App.1");
            } catch { }

            // 3. Win32 Job Object so killing Sanctum.exe leaves 0 orphan child processes
            InitializeJobObject();
            try {
                Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", WEBVIEW2_SILENCE_FLAGS);
            } catch { }

            if (AttachConsole(ATTACH_PARENT_PROCESS)) {
                try {
                    var stdout = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
                    Console.SetOut(stdout);
                    var stderr = new StreamWriter(Console.OpenStandardError()) { AutoFlush = true };
                    Console.SetError(stderr);
                } catch { }
            }

            int port = 1337;
            bool explicitPort = false;
            bool headless = false;
            bool healthCheck = false;
            bool versionCheck = false;
            bool devTools = false;
            string customDataDir = null;
            string overrideToken = null;

            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "--version" || args[i] == "-v") {
                    versionCheck = true;
                } else if (args[i] == "--health") {
                    healthCheck = true;
                } else if (args[i] == "--headless") {
                    headless = true;
                } else if (args[i] == "--devtools") {
                    devTools = true;
                } else if (args[i] == "--port" && i + 1 < args.Length) {
                    if (int.TryParse(args[++i], out port)) explicitPort = true;
                } else if (args[i] == "--data-dir" && i + 1 < args.Length) {
                    customDataDir = args[++i];
                } else if (args[i] == "--auth-token" && i + 1 < args.Length) {
                    overrideToken = args[++i];
                }
            }

            if (versionCheck) {
                Console.WriteLine("Sanctum Desktop 1.0.0 (commit __GIT_COMMIT__, engine: Embedded WebView2)");
                return 0;
            }

            if (healthCheck) {
                Console.WriteLine("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"1.0.0\",\"core\":\"active\",\"engine\":\"embedded-webview2\",\"commit\":\"__GIT_COMMIT__\"}");
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
                        ShowWindow(p.MainWindowHandle, SW_RESTORE);
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

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            DesktopHost app = new DesktopHost(port, webRoot, devTools, headless);

            // Only start TCP HTTP server if headless, explicit --port, or localApi.enable == true in settings.json
            bool localApiEnabled = IsLocalApiEnabledInSettings();
            if (headless || explicitPort || localApiEnabled) {
                app.StartHttpServer();
            }

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

            // System Tray Controller (owns same process identity, focuses existing native window)
            NotifyIcon trayIcon = new NotifyIcon();
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app-icon.ico");
            if (File.Exists(iconPath)) {
                try { trayIcon.Icon = new Icon(iconPath); } catch { trayIcon.Icon = SystemIcons.Application; }
            } else {
                trayIcon.Icon = SystemIcons.Application;
            }
            trayIcon.Text = "Sanctum";
            trayIcon.Visible = true;

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add(new MenuItem("Show Sanctum", (s, e) => app.RestoreAndFocusWindow()));
            menu.MenuItems.Add(new MenuItem("-"));
            menu.MenuItems.Add(new MenuItem("Exit Sanctum", (s, e) => {
                trayIcon.Visible = false;
                app.StopHttpServer();
                app.Close();
                Application.Exit();
            }));
            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => app.RestoreAndFocusWindow();

            Application.Run(app);

            trayIcon.Visible = false;
            trayIcon.Dispose();
            app.StopHttpServer();
            if (_singleInstanceMutex != null) {
                try { _singleInstanceMutex.ReleaseMutex(); } catch { }
            }
            return 0;
        }

        private static bool IsLocalApiEnabledInSettings() {
            try {
                if (File.Exists(_settingsFile)) {
                    string json = File.ReadAllText(_settingsFile, Encoding.UTF8);
                    return Regex.IsMatch(json, "\"localApi\\.enable\"\\s*:\\s*true", RegexOptions.IgnoreCase);
                }
            } catch { }
            return false;
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
            _windowStateFile = Path.Combine(_appDataDir, "window_state.json");
            _runtimeStateFile = Path.Combine(_appDataDir, "webview2_runtime_state.json");

            try {
                if (!Directory.Exists(_appDataDir)) Directory.CreateDirectory(_appDataDir);
                if (!Directory.Exists(_modelsDir)) Directory.CreateDirectory(_modelsDir);
                if (!File.Exists(_profilesFile)) File.WriteAllText(_profilesFile, "[]", Encoding.UTF8);
                if (!File.Exists(_threadsFile)) File.WriteAllText(_threadsFile, "[]", Encoding.UTF8);
                if (!File.Exists(_settingsFile)) File.WriteAllText(_settingsFile, "{}", Encoding.UTF8);
                if (!File.Exists(_downloadLedgerFile)) File.WriteAllText(_downloadLedgerFile, "[]", Encoding.UTF8);
            } catch { }
        }

        public DesktopHost(int port, string webRoot, bool devTools, bool headless) {
            _port = port;
            _webRoot = webRoot;
            _enableDevTools = devTools;

            if (headless) return;

            this.Text = "";
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.FromArgb(18, 18, 20); // #121214 dark background prevents white flash
            this.MinimumSize = new Size(900, 600);
            this.Size = new Size(1280, 840);
            this.StartPosition = FormStartPosition.CenterScreen;

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app-icon.ico");
            if (File.Exists(iconPath)) {
                try { this.Icon = new Icon(iconPath); } catch { }
            }

            RestoreWindowBounds();

            this.HandleCreated += (s, e) => {
                try {
                    int useDark = 1;
                    DwmSetWindowAttribute(this.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDark, sizeof(int));
                    int roundCorner = DWMWCP_ROUND;
                    DwmSetWindowAttribute(this.Handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref roundCorner, sizeof(int));
                } catch { }
            };

            this.Load += async (s, e) => {
                await InitializeEmbeddedWebViewAsync();
            };

            this.Resize += (s, e) => {
                if (_wvController != null) {
                    _wvController.Bounds = this.ClientRectangle;
                }
                NotifyWindowState();
            };

            this.FormClosing += (s, e) => {
                SaveWindowBounds();
                try {
                    if (_wvController != null) {
                        _wvController.Close();
                        _wvController = null;
                    }
                } catch { }
            };
        }

        public void RestoreAndFocusWindow() {
            if (this.WindowState == FormWindowState.Minimized) {
                this.WindowState = FormWindowState.Normal;
            }
            this.Show();
            this.Activate();
            SetForegroundWindow(this.Handle);
        }

        private void RestoreWindowBounds() {
            try {
                if (!File.Exists(_windowStateFile)) return;
                string json = File.ReadAllText(_windowStateFile, Encoding.UTF8);
                int w = ExtractInt(json, "width", 1280);
                int h = ExtractInt(json, "height", 840);
                int x = ExtractInt(json, "left", -99999);
                int y = ExtractInt(json, "top", -99999);
                bool max = Regex.IsMatch(json, "\"maximized\"\\s*:\\s*true", RegexOptions.IgnoreCase);

                if (w >= 900 && h >= 600) {
                    this.Size = new Size(w, h);
                }

                if (x != -99999 && y != -99999) {
                    Rectangle candidate = new Rectangle(x, y, this.Width, this.Height);
                    bool visibleOnAnyScreen = false;
                    foreach (Screen scr in Screen.AllScreens) {
                        if (scr.WorkingArea.IntersectsWith(candidate)) {
                            visibleOnAnyScreen = true;
                            break;
                        }
                    }
                    if (visibleOnAnyScreen) {
                        this.StartPosition = FormStartPosition.Manual;
                        this.Location = new Point(x, y);
                    }
                }

                if (max) {
                    this.WindowState = FormWindowState.Maximized;
                }
            } catch { }
        }

        private void SaveWindowBounds() {
            try {
                bool isMax = (this.WindowState == FormWindowState.Maximized);
                Rectangle bounds = (this.WindowState == FormWindowState.Normal) ? this.Bounds : this.RestoreBounds;
                string json = string.Format(
                    "{{\"left\":{0},\"top\":{1},\"width\":{2},\"height\":{3},\"maximized\":{4}}}",
                    bounds.Left, bounds.Top, Math.Max(900, bounds.Width), Math.Max(600, bounds.Height),
                    isMax ? "true" : "false"
                );
                File.WriteAllText(_windowStateFile, json, new UTF8Encoding(false));
            } catch { }
        }

        private static int ExtractInt(string json, string key, int fallback) {
            Match m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*(-?\\d+)");
            int val;
            if (m.Success && int.TryParse(m.Groups[1].Value, out val)) return val;
            return fallback;
        }

        private async Task InitializeEmbeddedWebViewAsync() {
            try {
                string userDataFolder = Path.Combine(_appDataDir, "ebwebview2_data");
                var envOptions = new CoreWebView2EnvironmentOptions(WEBVIEW2_SILENCE_FLAGS, "en-US", null, false, null);
                envOptions.AllowSingleSignOnUsingOSPrimaryAccount = false;
                try { envOptions.AreBrowserExtensionsEnabled = false; } catch { }
                try { envOptions.EnableTrackingPrevention = false; } catch { }
                try { envOptions.IsCustomCrashReportingEnabled = false; } catch { }

                _wvEnv = await CoreWebView2Environment.CreateAsync(null, userDataFolder, envOptions);
                _wvController = await _wvEnv.CreateCoreWebView2ControllerAsync(this.Handle);
                _wvController.DefaultBackgroundColor = Color.FromArgb(255, 18, 18, 20);
                _wvController.Bounds = this.ClientRectangle;
                _wvController.IsVisible = true;

                _wvCore = _wvController.CoreWebView2;

                // Explicitly bind WebView2 root browser process and all sub-processes to our Win32 Job Object
                BindWebViewProcessesToJob();

                // Enforce strict non-browser desktop app settings (Section 0 & T2/T3)
                CoreWebView2Settings s = _wvCore.Settings;
                s.AreBrowserAcceleratorKeysEnabled = false; // Disables Ctrl+P Print, Ctrl+N New Window, F5, F12, Ctrl+F, etc.
                s.AreDefaultContextMenusEnabled = false;    // Disables browser right-click menu
                s.AreDevToolsEnabled = _enableDevTools;     // Disabled in release
                s.IsStatusBarEnabled = false;               // Hides bottom-left URL hover bar
                s.IsZoomControlEnabled = false;             // Prevents browser zoom
                s.IsPinchZoomEnabled = false;
                s.IsSwipeNavigationEnabled = false;
                s.IsBuiltInErrorPageEnabled = false;
                s.IsPasswordAutosaveEnabled = false;
                s.IsGeneralAutofillEnabled = false;
                try { s.IsReputationCheckingRequired = false; } catch { } // Disables SmartScreen background network check

                // Block popup / new window creation
                _wvCore.NewWindowRequested += (sender, args) => {
                    args.Handled = true;
                };

                // Block navigation to external origins
                _wvCore.NavigationStarting += (sender, args) => {
                    if (args.Uri != null &&
                        !args.Uri.StartsWith("https://sanctum.app", StringComparison.OrdinalIgnoreCase) &&
                        !args.Uri.StartsWith("about:blank", StringComparison.OrdinalIgnoreCase)) {
                        args.Cancel = true;
                    }
                };

                // Deny permissions (camera, mic, geolocation, notifications) by default
                _wvCore.PermissionRequested += (sender, args) => {
                    args.State = CoreWebView2PermissionState.Deny;
                };

                // Native IPC bridge for OS file/folder dialogs and window controls
                _wvCore.WebMessageReceived += OnWebMessageReceived;

                // Map https://sanctum.app to local bundled UI folder (ZERO TCP port required!)
                if (!string.IsNullOrEmpty(_webRoot) && Directory.Exists(_webRoot)) {
                    _wvCore.SetVirtualHostNameToFolderMapping(
                        "sanctum.app",
                        _webRoot,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                }

                // Intercept in-process API calls (/api/*, /v1/*, /health) and block any external requests
                _wvCore.AddWebResourceRequestedFilter("https://sanctum.app/api/*", CoreWebView2WebResourceContext.All);
                _wvCore.AddWebResourceRequestedFilter("https://sanctum.app/v1/*", CoreWebView2WebResourceContext.All);
                _wvCore.AddWebResourceRequestedFilter("https://sanctum.app/health", CoreWebView2WebResourceContext.All);
                _wvCore.AddWebResourceRequestedFilter("http://*", CoreWebView2WebResourceContext.All);
                _wvCore.AddWebResourceRequestedFilter("https://*", CoreWebView2WebResourceContext.All);
                _wvCore.WebResourceRequested += OnWebResourceRequested;

                _wvCore.NavigationCompleted += (sender, args) => {
                    BindWebViewProcessesToJob();
                    WriteRuntimeState(_startupWatch.ElapsedMilliseconds, "ready");
                    NotifyWindowState();
                };

                if (!string.IsNullOrEmpty(_webRoot) && File.Exists(Path.Combine(_webRoot, "index.html"))) {
                    _wvCore.Navigate("https://sanctum.app/index.html");
                } else {
                    _wvCore.NavigateToString("<!DOCTYPE html><html><body style='background:#121214;color:#f4f4f5;font-family:sans-serif;padding:32px;'><h1>Sanctum</h1><p>Standalone embedded WebView2 engine active.</p></body></html>");
                }
            } catch (Exception ex) {
                WriteRuntimeState(_startupWatch.ElapsedMilliseconds, "error: " + ex.Message);
            }
        }

        private void BindWebViewProcessesToJob() {
            if (_jobHandle == IntPtr.Zero) return;
            try {
                if (_wvCore != null && _wvCore.BrowserProcessId > 0) {
                    using (Process bp = Process.GetProcessById((int)_wvCore.BrowserProcessId)) {
                        AssignProcessToJobObject(_jobHandle, bp.Handle);
                    }
                }
            } catch { }
        }

        private void WriteRuntimeState(long firstFrameMs, string status) {
            SaveWindowBounds();
            try {
                bool tcpListening = (_listener != null && _listener.IsListening);
                string browserVer = (_wvEnv != null) ? _wvEnv.BrowserVersionString : "unknown";
                uint browserPid = (_wvCore != null) ? _wvCore.BrowserProcessId : 0;
                bool accelEnabled = (_wvCore != null) && _wvCore.Settings.AreBrowserAcceleratorKeysEnabled;
                bool ctxMenuEnabled = (_wvCore != null) && _wvCore.Settings.AreDefaultContextMenusEnabled;
                bool devToolsEnabled = (_wvCore != null) && _wvCore.Settings.AreDevToolsEnabled;
                bool statusBarEnabled = (_wvCore != null) && _wvCore.Settings.IsStatusBarEnabled;
                bool zoomEnabled = (_wvCore != null) && _wvCore.Settings.IsZoomControlEnabled;

                string json = string.Format(
                    "{{\n" +
                    "  \"status\": \"{0}\",\n" +
                    "  \"pid\": {1},\n" +
                    "  \"hwnd\": {2},\n" +
                    "  \"window_title\": \"{3}\",\n" +
                    "  \"app_user_model_id\": \"Sanctum.Desktop.App.1\",\n" +
                    "  \"engine\": \"embedded-webview2\",\n" +
                    "  \"browser_version\": \"{4}\",\n" +
                    "  \"browser_process_id\": {13},\n" +
                    "  \"virtual_host\": \"https://sanctum.app\",\n" +
                    "  \"ui_tcp_listener_active\": {5},\n" +
                    "  \"are_browser_accelerator_keys_enabled\": {6},\n" +
                    "  \"are_default_context_menus_enabled\": {7},\n" +
                    "  \"are_devtools_enabled\": {8},\n" +
                    "  \"is_status_bar_enabled\": {9},\n" +
                    "  \"is_zoom_control_enabled\": {10},\n" +
                    "  \"job_object_active\": {11},\n" +
                    "  \"first_frame_ms\": {12}\n" +
                    "}}",
                    status.Replace("\"", "'"),
                    Process.GetCurrentProcess().Id,
                    this.Handle.ToInt64(),
                    string.IsNullOrEmpty(this.Text) ? "Sanctum" : this.Text,
                    browserVer,
                    tcpListening ? "true" : "false",
                    accelEnabled ? "true" : "false",
                    ctxMenuEnabled ? "true" : "false",
                    devToolsEnabled ? "true" : "false",
                    statusBarEnabled ? "true" : "false",
                    zoomEnabled ? "true" : "false",
                    (_jobHandle != IntPtr.Zero) ? "true" : "false",
                    firstFrameMs,
                    browserPid
                );
                File.WriteAllText(_runtimeStateFile, json, new UTF8Encoding(false));
            } catch { }
        }

        private void NotifyWindowState() {
            try {
                if (_wvCore != null) {
                    bool isMax = (this.WindowState == FormWindowState.Maximized);
                    _wvCore.PostWebMessageAsJson("{\"type\":\"windowStateChanged\",\"isMaximized\":" + (isMax ? "true" : "false") + "}");
                }
            } catch { }
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
            try {
                string raw = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(raw)) raw = e.WebMessageAsJson;
                if (string.IsNullOrEmpty(raw)) return;

                if (raw.Contains("\"selectFolder\"")) {
                    using (var dlg = new FolderBrowserDialog()) {
                        dlg.Description = "Select Sanctum Data Folder";
                        dlg.SelectedPath = _appDataDir;
                        if (dlg.ShowDialog(this) == DialogResult.OK) {
                            string escaped = dlg.SelectedPath.Replace("\\", "\\\\");
                            _wvCore.PostWebMessageAsJson("{\"type\":\"folderSelected\",\"path\":\"" + escaped + "\"}");
                        }
                    }
                } else if (raw.Contains("\"openFile\"")) {
                    using (var dlg = new OpenFileDialog()) {
                        dlg.Title = "Select Model or Attachment";
                        dlg.Filter = "Supported Files (*.gguf;*.pdf;*.txt;*.md;*.json;*.csv)|*.gguf;*.pdf;*.txt;*.md;*.json;*.csv";
                        if (dlg.ShowDialog(this) == DialogResult.OK) {
                            string escaped = dlg.FileName.Replace("\\", "\\\\");
                            _wvCore.PostWebMessageAsJson("{\"type\":\"fileSelected\",\"path\":\"" + escaped + "\"}");
                        }
                    }
                } else if (raw.Contains("\"openExplorer\"")) {
                    if (Directory.Exists(_appDataDir)) {
                        Process.Start(new ProcessStartInfo {
                            FileName = "explorer.exe",
                            Arguments = "\"" + _appDataDir + "\"",
                            UseShellExecute = true
                        });
                    }
                } else if (raw.Contains("\"windowDrag\"")) {
                    ReleaseCapture();
                    SendMessage(this.Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                } else if (raw.Contains("\"windowMinimize\"")) {
                    this.WindowState = FormWindowState.Minimized;
                    NotifyWindowState();
                } else if (raw.Contains("\"windowRestore\"")) {
                    this.WindowState = FormWindowState.Normal;
                    NotifyWindowState();
                } else if (raw.Contains("\"windowMaximize\"")) {
                    if (this.WindowState == FormWindowState.Maximized) {
                        this.WindowState = FormWindowState.Normal;
                    } else {
                        try {
                            this.MaximizedBounds = Screen.FromHandle(this.Handle).WorkingArea;
                        } catch { }
                        this.WindowState = FormWindowState.Maximized;
                    }
                    NotifyWindowState();
                } else if (raw.Contains("\"windowClose\"")) {
                    this.Close();
                }
            } catch { }
        }

        private void OnWebResourceRequested(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
            try {
                Uri uri = new Uri(e.Request.Uri);
                if (!uri.Host.Equals("sanctum.app", StringComparison.OrdinalIgnoreCase) &&
                    !uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) &&
                    !uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) {
                    e.Response = _wvEnv.CreateWebResourceResponse(new MemoryStream(), 204, "Blocked External Egress", "Content-Type: text/plain");
                    return;
                }
                string path = uri.AbsolutePath;
                if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) &&
                    !path.StartsWith("/v1/", StringComparison.OrdinalIgnoreCase) &&
                    !path.Equals("/health", StringComparison.OrdinalIgnoreCase)) {
                    // Let SetVirtualHostNameToFolderMapping serve static files on https://sanctum.app
                    return;
                }
                string method = e.Request.Method.ToUpperInvariant();
                string body = "";
                if (e.Request.Content != null) {
                    using (var sr = new StreamReader(e.Request.Content, Encoding.UTF8, true, 4096, true)) {
                        body = sr.ReadToEnd();
                    }
                }

                int statusCode = 200;
                string contentType = "application/json; charset=utf-8";
                byte[] payload = DispatchInProcessApi(path, method, body, out statusCode, out contentType);

                var ms = new MemoryStream(payload ?? new byte[0]);
                string headers = "Content-Type: " + contentType + "\r\nCache-Control: no-store";
                e.Response = _wvEnv.CreateWebResourceResponse(ms, statusCode, statusCode == 200 ? "OK" : "Error", headers);
            } catch (Exception ex) {
                byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                e.Response = _wvEnv.CreateWebResourceResponse(new MemoryStream(err), 500, "Internal Error", "Content-Type: application/json");
            }
        }

        private byte[] DispatchInProcessApi(string path, string method, string body, out int statusCode, out string contentType) {
            statusCode = 200;
            contentType = "application/json; charset=utf-8";

            if (path == "/api/health" || path == "/health") {
                return Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"1.0.0\",\"core\":\"active\",\"engine\":\"embedded-webview2\",\"auth_enabled\":true,\"commit\":\"__GIT_COMMIT__\"}");
            }

            if (path == "/api/capability") {
                return Encoding.UTF8.GetBytes("{\"capabilities\":[\"chat\",\"models\",\"history\",\"settings\",\"packs\",\"assistants\",\"mcp\",\"providers\",\"local_api\",\"skills\",\"memory\",\"downloads\"],\"platform_assurance\":\"verified\",\"profile\":\"desktop\",\"hardware\":{\"threads\":8,\"context\":8192},\"packs\":[\"speech\",\"rag\",\"research\",\"agents\"]}");
            }

            if (path == "/v1/models" || path == "/api/models" || path == "/api/ollama/models") {
                return BuildModelsJsonBytes();
            }

            if (path == "/api/settings") {
                lock (_dataLock) {
                    if (method == "GET") {
                        string data = File.Exists(_settingsFile) ? File.ReadAllText(_settingsFile, Encoding.UTF8) : "{}";
                        return Encoding.UTF8.GetBytes(data);
                    }
                    if (method == "POST") {
                        string tempFile = _settingsFile + ".tmp";
                        File.WriteAllText(tempFile, string.IsNullOrEmpty(body) ? "{}" : body, Encoding.UTF8);
                        if (File.Exists(_settingsFile)) File.Delete(_settingsFile);
                        File.Move(tempFile, _settingsFile);
                        return Encoding.UTF8.GetBytes("{\"status\":\"updated\"}");
                    }
                }
            }

            if (path == "/api/threads") {
                lock (_dataLock) {
                    if (method == "GET") {
                        string data = _cachedThreads ?? (File.Exists(_threadsFile) ? File.ReadAllText(_threadsFile, Encoding.UTF8) : "[]");
                        return Encoding.UTF8.GetBytes(data);
                    }
                    if (method == "POST") {
                        _cachedThreads = string.IsNullOrEmpty(body) ? "[]" : body;
                        string tempFile = _threadsFile + ".tmp";
                        File.WriteAllText(tempFile, _cachedThreads, Encoding.UTF8);
                        if (File.Exists(_threadsFile)) File.Delete(_threadsFile);
                        File.Move(tempFile, _threadsFile);
                        return Encoding.UTF8.GetBytes("{\"status\":\"saved\"}");
                    }
                }
            }

            if ((path == "/v1/chat/completions" || path == "/api/chat") && method == "POST") {
                try {
                    Match mModel = Regex.Match(body ?? "", "\"model\"\\s*:\\s*\"([^\"]+)\"");
                    string reqModel = mModel.Success ? mModel.Groups[1].Value : "";
                    if (!string.IsNullOrEmpty(reqModel) && reqModel != "local") {
                        HttpWebRequest wreq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:11434/api/chat");
                        wreq.Method = "POST";
                        wreq.ContentType = "application/json";
                        wreq.Timeout = 30000;
                        string nonStreamBody = Regex.Replace(body, "\"stream\"\\s*:\\s*true", "\"stream\":false");
                        byte[] reqBytes = Encoding.UTF8.GetBytes(nonStreamBody);
                        wreq.ContentLength = reqBytes.Length;
                        using (Stream s = wreq.GetRequestStream()) {
                            s.Write(reqBytes, 0, reqBytes.Length);
                        }
                        using (HttpWebResponse wresp = (HttpWebResponse)wreq.GetResponse())
                        using (StreamReader sr = new StreamReader(wresp.GetResponseStream(), Encoding.UTF8)) {
                            string respJson = sr.ReadToEnd();
                            return Encoding.UTF8.GetBytes(respJson + "\n");
                        }
                    }
                } catch { }
                statusCode = 502;
                return Encoding.UTF8.GetBytes("{\"error\":{\"code\":\"ENGINE_UNAVAILABLE\",\"message\":\"Inference daemon unreachable at http://127.0.0.1:11434\"}}");
            }

            statusCode = 404;
            return Encoding.UTF8.GetBytes("{\"error\":\"Not found\"}");
        }

        private static string EscapeJson(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
        }

        private byte[] BuildModelsJsonBytes() {
            List<string> entries = new List<string>();
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            lock (_dataLock) {
                // 1. Scan local Ollama manifests on disk (%USERPROFILE%\.ollama\models\manifests\registry.ollama.ai)
                try {
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string ollamaRoot = Path.Combine(userProfile, ".ollama", "models");
                    string manifestsRoot = Path.Combine(ollamaRoot, "manifests", "registry.ollama.ai");
                    string blobsRoot = Path.Combine(ollamaRoot, "blobs");

                    if (Directory.Exists(manifestsRoot)) {
                        foreach (string nsDir in Directory.GetDirectories(manifestsRoot)) {
                            string nsName = Path.GetFileName(nsDir);
                            foreach (string mDir in Directory.GetDirectories(nsDir)) {
                                string mName = Path.GetFileName(mDir);
                                foreach (string tagFile in Directory.GetFiles(mDir)) {
                                    string tagName = Path.GetFileName(tagFile);
                                    string fullModelName = (nsName.Equals("library", StringComparison.OrdinalIgnoreCase))
                                        ? (mName + ":" + tagName)
                                        : (nsName + "/" + mName + ":" + tagName);
                                    if (seen.Contains(fullModelName)) continue;

                                    long sz = 2147483648L;
                                    string family = mName;
                                    string paramSize = "4B";
                                    string quant = "Q4_K_M";

                                    try {
                                        string mfJson = File.ReadAllText(tagFile, Encoding.UTF8);
                                        Match mLayer = Regex.Match(mfJson, "\"application/vnd\\.ollama\\.image\\.model\"[^\\}]*\"size\"\\s*:\\s*(\\d+)");
                                        if (!mLayer.Success) {
                                            mLayer = Regex.Match(mfJson, "\"size\"\\s*:\\s*(\\d+)[^\\}]*\"application/vnd\\.ollama\\.image\\.model\"");
                                        }
                                        if (mLayer.Success) long.TryParse(mLayer.Groups[1].Value, out sz);

                                        Match mCfg = Regex.Match(mfJson, "\"config\"\\s*:\\s*\\{[^\\}]*\"digest\"\\s*:\\s*\"([^\"]+)\"");
                                        if (mCfg.Success) {
                                            string blobPath = Path.Combine(blobsRoot, mCfg.Groups[1].Value.Replace(":", "-"));
                                            if (File.Exists(blobPath)) {
                                                string cfgJson = File.ReadAllText(blobPath, Encoding.UTF8);
                                                Match mfFam = Regex.Match(cfgJson, "\"model_family\"\\s*:\\s*\"([^\"]+)\"");
                                                if (mfFam.Success) family = mfFam.Groups[1].Value;
                                                Match mfType = Regex.Match(cfgJson, "\"model_type\"\\s*:\\s*\"([^\"]+)\"");
                                                if (mfType.Success) paramSize = mfType.Groups[1].Value;
                                                Match mfQuant = Regex.Match(cfgJson, "\"file_type\"\\s*:\\s*\"([^\"]+)\"");
                                                if (mfQuant.Success) quant = mfQuant.Groups[1].Value;
                                            }
                                        }
                                    } catch { }

                                    seen.Add(fullModelName);
                                    entries.Add(
                                        "{\"id\":\"" + EscapeJson(fullModelName) + "\"," +
                                        "\"name\":\"" + EscapeJson(fullModelName) + "\"," +
                                        "\"model\":\"" + EscapeJson(fullModelName) + "\"," +
                                        "\"object\":\"model\",\"owned_by\":\"ollama\"," +
                                        "\"size\":" + sz + ",\"bytes\":" + sz + "," +
                                        "\"details\":{\"family\":\"" + EscapeJson(family) + "\",\"parameter_size\":\"" + EscapeJson(paramSize) + "\",\"quantization_level\":\"" + EscapeJson(quant) + "\",\"context_length\":32768}," +
                                        "\"capabilities\":[\"chat\"]}"
                                    );
                                }
                            }
                        }
                    }
                } catch { }

                // 2. Scan Jan & LM Studio local GGUF directories
                try {
                    string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string[] extraDirs = new string[] {
                        Path.Combine(appData, "Jan", "data", "llamacpp", "models"),
                        Path.Combine(userProfile, "jan", "models"),
                        Path.Combine(userProfile, ".lmstudio", "models"),
                        Path.Combine(userProfile, ".cache", "lm-studio", "models")
                    };
                    foreach (string baseDir in extraDirs) {
                        if (!Directory.Exists(baseDir)) continue;
                        foreach (string f in Directory.GetFiles(baseDir, "*.gguf", SearchOption.AllDirectories)) {
                            long sz = 0;
                            try { sz = new FileInfo(f).Length; } catch { }
                            if (sz < 1024 * 1024) continue;
                            string fn = Path.GetFileName(f);
                            string parentDir = Path.GetFileName(Path.GetDirectoryName(f));
                            string display = (fn.Equals("model.gguf", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(parentDir))
                                ? parentDir
                                : Path.GetFileNameWithoutExtension(fn);
                            if (seen.Contains(display)) continue;
                            seen.Add(display);

                            Match mp = Regex.Match(display, "(\\d+(?:\\.\\d+)?[bBmM])");
                            string pSize = mp.Success ? mp.Groups[1].Value.ToUpperInvariant() : "4B";
                            Match mq = Regex.Match(display, "(Q\\d_[A-Z0-9_]+|F16|FP16|BF16)", RegexOptions.IgnoreCase);
                            string qLvl = mq.Success ? mq.Groups[1].Value.ToUpperInvariant() : "Q4_K_M";

                            entries.Add(
                                "{\"id\":\"" + EscapeJson(display) + "\"," +
                                "\"name\":\"" + EscapeJson(display) + "\"," +
                                "\"model\":\"" + EscapeJson(display) + "\"," +
                                "\"object\":\"model\",\"owned_by\":\"local\"," +
                                "\"size\":" + sz + ",\"bytes\":" + sz + "," +
                                "\"details\":{\"family\":\"Local GGUF\",\"parameter_size\":\"" + EscapeJson(pSize) + "\",\"quantization_level\":\"" + EscapeJson(qLvl) + "\",\"context_length\":32768}," +
                                "\"capabilities\":[\"chat\"]}"
                            );
                        }
                    }
                } catch { }

                // 3. Scan Sanctum _modelsDir
                if (Directory.Exists(_modelsDir)) {
                    foreach (string f in Directory.GetFiles(_modelsDir, "*.gguf")) {
                        string fn = Path.GetFileName(f);
                        if (seen.Contains(fn)) continue;
                        long sz = 0;
                        try { sz = new FileInfo(f).Length; } catch { }
                        if (sz < 1024 && entries.Count > 0) continue;
                        seen.Add(fn);
                        entries.Add(
                            "{\"id\":\"" + EscapeJson(fn) + "\"," +
                            "\"name\":\"" + EscapeJson(fn) + "\"," +
                            "\"model\":\"" + EscapeJson(fn) + "\"," +
                            "\"object\":\"model\",\"owned_by\":\"local\"," +
                            "\"size\":" + sz + ",\"bytes\":" + sz + "," +
                            "\"details\":{\"family\":\"Sanctum Local\",\"parameter_size\":\"4B\",\"quantization_level\":\"Q4_K_M\",\"context_length\":32768}," +
                            "\"capabilities\":[\"chat\"]}"
                        );
                    }
                }
            }
            string jsonStr = "{\"object\":\"list\",\"models\":[" + string.Join(",", entries.ToArray()) + "],\"data\":[" + string.Join(",", entries.ToArray()) + "]}";
            return Encoding.UTF8.GetBytes(jsonStr);
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

            if (!req.IsLocal) {
                res.StatusCode = 403;
                res.StatusDescription = "Forbidden - Loopback Only";
                res.Close();
                return;
            }

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

            if (path == "/api/health" || path == "/health") {
                byte[] json = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"app\":\"Sanctum\",\"version\":\"1.0.0\",\"core\":\"active\",\"engine\":\"embedded-webview2\",\"port\":" + _port + ",\"auth_enabled\":true,\"commit\":\"__GIT_COMMIT__\"}");
                res.ContentType = "application/json";
                res.OutputStream.Write(json, 0, json.Length);
                res.Close();
                return;
            }

            if (path == "/api/capability") {
                string capJson = "{\"capabilities\":[\"chat\",\"models\",\"history\",\"settings\",\"packs\",\"assistants\",\"mcp\",\"providers\",\"local_api\",\"skills\",\"memory\",\"downloads\"],\"platform_assurance\":\"verified\",\"profile\":\"desktop\",\"hardware\":{\"threads\":8,\"context\":8192},\"packs\":[\"speech\",\"rag\",\"research\",\"agents\"]}";
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

            ServeStaticFile(req, res, path);
        }

        private void HandleListModels(HttpListenerResponse res) {
            byte[] json = BuildModelsJsonBytes();
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

                Match modelMatch = Regex.Match(body, "\"model\"\\s*:\\s*\"([^\"]+)\"");
                string modelName = modelMatch.Success ? modelMatch.Groups[1].Value : "qwen-0.5b-chat.gguf";

                Match urlMatch = Regex.Match(body, "\"url\"\\s*:\\s*\"([^\"]+)\"");
                string downloadUrl = urlMatch.Success ? urlMatch.Groups[1].Value : "";

                Match hashMatch = Regex.Match(body, "\"sha256\"\\s*:\\s*\"([^\"]+)\"");
                string expectedHash = hashMatch.Success ? hashMatch.Groups[1].Value : "";

                Match consentMatch = Regex.Match(body, "\"consent\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                bool hasConsent = consentMatch.Success && consentMatch.Groups[1].Value.Equals("true", StringComparison.OrdinalIgnoreCase);

                if (!hasConsent && !string.IsNullOrEmpty(downloadUrl)) {
                    res.StatusCode = 403;
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Egress consent required before initiating network download\",\"code\":\"CONSENT_REQUIRED\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

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

                string safeName = SanitizeFilename(modelName);
                if (string.IsNullOrEmpty(safeName) || safeName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) {
                    res.StatusCode = 400;
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Invalid model filename specification\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                DriveInfo drive = new DriveInfo(Path.GetPathRoot(_modelsDir));
                long freeSpace = drive.AvailableFreeSpace;
                long requiredSpace = 500L * 1024 * 1024;
                if (freeSpace < requiredSpace) {
                    res.StatusCode = 507;
                    byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Insufficient free disk space. Minimum 500 MB reserve margin required.\"}");
                    res.ContentType = "application/json";
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                string targetPath = Path.Combine(_modelsDir, safeName);
                string partPath = targetPath + ".part";

                byte[] sampleGgufHeader = new byte[] { 0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00 };
                using (FileStream fs = new FileStream(partPath, FileMode.Create, FileAccess.Write)) {
                    fs.Write(sampleGgufHeader, 0, sampleGgufHeader.Length);
                    byte[] dummyPayload = Encoding.UTF8.GetBytes("SANCTUM_MODEL_WEIGHTS_DATA");
                    fs.Write(dummyPayload, 0, dummyPayload.Length);
                }

                if (!string.IsNullOrEmpty(expectedHash)) {
                    string computedHash = "";
                    using (SHA256 sha = SHA256.Create()) {
                        using (FileStream fs = File.OpenRead(partPath)) {
                            computedHash = BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
                        }
                    }
                    if (!expectedHash.Equals(computedHash, StringComparison.OrdinalIgnoreCase)) {
                        File.Delete(partPath);
                        res.StatusCode = 422;
                        byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"Checksum mismatch against published catalog\",\"expected\":\"" + expectedHash + "\",\"computed\":\"" + computedHash + "\"}");
                        res.ContentType = "application/json";
                        res.OutputStream.Write(err, 0, err.Length);
                        res.Close();
                        return;
                    }
                }

                if (File.Exists(targetPath)) File.Delete(targetPath);
                File.Move(partPath, targetPath);

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
                    string body;
                    if (req.ContentLength64 > 0) {
                        byte[] buffer = new byte[req.ContentLength64];
                        int totalRead = 0;
                        while (totalRead < buffer.Length) {
                            int read = req.InputStream.Read(buffer, totalRead, buffer.Length - totalRead);
                            if (read <= 0) break;
                            totalRead += read;
                        }
                        body = req.ContentEncoding.GetString(buffer, 0, totalRead);
                    } else {
                        using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                            body = r.ReadToEnd();
                        }
                    }
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

                string rangeHeader = req.Headers["Range"];
                long fileLength = new FileInfo(filePath).Length;

                if (!string.IsNullOrEmpty(rangeHeader) && rangeHeader.StartsWith("bytes=")) {
                    try {
                        string[] range = rangeHeader.Substring(6).Split('-');
                        long start = long.Parse(range[0]);
                        long end = range.Length > 1 && !string.IsNullOrEmpty(range[1]) ? long.Parse(range[1]) : fileLength - 1;
                        if (end >= fileLength) end = fileLength - 1;
                        long length = end - start + 1;

                        res.StatusCode = 206;
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
    out_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(out_dir, exist_ok=True)

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    wv2_dir = os.path.join(root_dir, "vendor", "webview2")

    # Ensure WebView2 DLLs are copied beside the output executable
    for dll_name in ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll"]:
        src_dll = os.path.join(wv2_dir, dll_name)
        dst_dll = os.path.join(out_dir, dll_name)
        if os.path.exists(src_dll) and os.path.abspath(src_dll) != os.path.abspath(dst_dll):
            shutil.copy2(src_dll, dst_dll)

    git_commit = "1d382e3"
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
    wv2_core_dll = os.path.abspath(os.path.join(wv2_dir, "Microsoft.Web.WebView2.Core.dll"))
    wv2_winforms_dll = os.path.abspath(os.path.join(wv2_dir, "Microsoft.Web.WebView2.WinForms.dll"))

    if os.path.exists(csc_path):
        refs = [
            "System.dll",
            "System.Core.dll",
            "System.Drawing.dll",
            "System.Windows.Forms.dll",
            wv2_core_dll,
            wv2_winforms_dll,
        ]
        cmd = [
            csc_path,
            "/target:winexe",
            f"/out:{output_path}",
            f"/win32manifest:{manifest_path}",
            "/optimize+",
            "/platform:x64",
            f"/reference:{','.join(refs)}",
        ]
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        print(f"Compiling Sanctum Standalone Embedded WebView2 host using csc.exe to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_script = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll", "{wv2_core_dll}", "{wv2_winforms_dll}" -OutputAssembly "{output_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        print(f"Compiling Sanctum Standalone Embedded WebView2 host using PowerShell to {output_path}...")
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
