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
using System.Speech.Recognition;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Sanctum")]
[assembly: AssemblyDescription("Sanctum Sovereign Local AI Desktop Application")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyCopyright("Copyright © 2026 Sanctum Contributors")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Sanctum {
    public partial class DesktopHost : Form {
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

        [DllImport("user32.dll", EntryPoint = "SendMessage")]
        static extern IntPtr SendMessagePtr(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern IntPtr GetSystemMenu(IntPtr hWnd, bool bRevert);

        [DllImport("user32.dll")]
        static extern bool EnableMenuItem(IntPtr hMenu, uint uIDEnableItem, uint uEnable);

        [DllImport("user32.dll")]
        static extern int TrackPopupMenu(IntPtr hMenu, uint uFlags, int x, int y, int nReserved, IntPtr hWnd, IntPtr prcRect);

        [DllImport("user32.dll")]
        static extern short GetAsyncKeyState(int vKey);

        private const int VK_LBUTTON = 0x01;
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;
        private const uint MF_BYCOMMAND = 0x00000000;
        private const uint MF_ENABLED = 0x00000000;
        private const uint MF_GRAYED = 0x00000001;
        private const uint TPM_RETURNCMD = 0x0100;
        private const uint TPM_RIGHTBUTTON = 0x0002;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);
        private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

        [DllImport("dwmapi.dll")]
        private static extern int DwmExtendFrameIntoClientArea(IntPtr hWnd, ref MARGINS pMarInset);

        [StructLayout(LayoutKind.Sequential)]
        public struct MARGINS {
            public int cxLeftWidth;
            public int cxRightWidth;
            public int cyTopHeight;
            public int cyBottomHeight;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
            public int left;
            public int top;
            public int right;
            public int bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT {
            public int x;
            public int y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MINMAXINFO {
            public POINT ptReserved;
            public POINT ptMaxSize;
            public POINT ptMaxPosition;
            public POINT ptMinTrackSize;
            public POINT ptMaxTrackSize;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct NCCALCSIZE_PARAMS {
            public RECT rgrc0;
            public RECT rgrc1;
            public RECT rgrc2;
            public IntPtr lppos;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MONITORINFO {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetricsForDpi(int nIndex, uint dpi);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern bool IsZoomed(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);
        private const uint MONITOR_DEFAULTTONEAREST = 2;

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("comctl32.dll", SetLastError = true)]
        private static extern bool SetWindowSubclass(IntPtr hWnd, SubclassWndProcDelegate lpfnSubclass, UIntPtr uIdSubclass, IntPtr dwRefData);

        [DllImport("comctl32.dll", SetLastError = true)]
        private static extern IntPtr DefSubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        private delegate IntPtr SubclassWndProcDelegate(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, UIntPtr uIdSubclass, IntPtr dwRefData);

        private const int SM_CXSIZEFRAME = 32;
        private const int SM_CYSIZEFRAME = 33;
        private const int SM_CXPADDEDBORDER = 92;

        private const int WM_SIZE = 0x0005;
        private const int WM_GETMINMAXINFO = 0x0024;
        private const int WM_WINDOWPOSCHANGED = 0x0047;
        private const int WM_NCCALCSIZE = 0x0083;
        private const int WM_NCHITTEST = 0x0084;
        private const int WM_NCLBUTTONUP = 0x00A2;
        private const int WM_SYSCOMMAND = 0x0112;

        private const int WS_CAPTION = 0x00C00000;
        private const int WS_THICKFRAME = 0x00040000;
        private const int WS_MINIMIZEBOX = 0x00020000;
        private const int WS_MAXIMIZEBOX = 0x00010000;
        private const int WS_SYSMENU = 0x00080000;

        private const int SC_SIZE = 0xF000;
        private const int SC_MOVE = 0xF010;
        private const int SC_RESTORE = 0xF120;
        private const int SC_MINIMIZE = 0xF020;
        private const int SC_MAXIMIZE = 0xF030;
        private const int SC_CLOSE = 0xF060;

        private const int HTTRANSPARENT = -1;
        private const int HTCLIENT = 1;
        private const int HTCAPTION = 2;
        private const int HTMINBUTTON = 8;
        private const int HTMAXBUTTON = 9;
        private const int HTLEFT = 10;
        private const int HTRIGHT = 11;
        private const int HTTOP = 12;
        private const int HTTOPLEFT = 13;
        private const int HTTOPRIGHT = 14;
        private const int HTBOTTOM = 15;
        private const int HTBOTTOMLEFT = 16;
        private const int HTBOTTOMRIGHT = 17;
        private const int HTCLOSE = 20;

        private int GetMetric(int index) {
            try {
                uint dpi = GetDpiForWindow(this.Handle);
                if (dpi > 0) return GetSystemMetricsForDpi(index, dpi);
            } catch { }
            try {
                return GetSystemMetrics(index);
            } catch {
                return 0;
            }
        }

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

        // Win32 ConPTY (PseudoConsole) APIs for genuine interactive terminal
        [StructLayout(LayoutKind.Sequential)]
        struct COORD {
            public short X;
            public short Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct SECURITY_ATTRIBUTES {
            public int nLength;
            public IntPtr lpSecurityDescriptor;
            public int bInheritHandle;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct STARTUPINFO {
            public int cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public int dwX;
            public int dwY;
            public int dwXSize;
            public int dwYSize;
            public int dwXCountChars;
            public int dwYCountChars;
            public int dwFillAttribute;
            public int dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct STARTUPINFOEX {
            public STARTUPINFO StartupInfo;
            public IntPtr lpAttributeList;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct PROCESS_INFORMATION {
            public IntPtr hProcess;
            public IntPtr hThread;
            public int dwProcessId;
            public int dwThreadId;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CreatePipe(out SafeFileHandle hReadPipe, out SafeFileHandle hWritePipe, ref SECURITY_ATTRIBUTES lpPipeAttributes, int nSize);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern int CreatePseudoConsole(COORD size, SafeFileHandle hInput, SafeFileHandle hOutput, uint dwFlags, out IntPtr phPC);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern int ResizePseudoConsole(IntPtr hPC, COORD size);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern void ClosePseudoConsole(IntPtr hPC);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool InitializeProcThreadAttributeList(IntPtr lpAttributeList, int dwAttributeCount, int dwFlags, ref IntPtr lpSize);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool UpdateProcThreadAttribute(IntPtr lpAttributeList, uint dwFlags, IntPtr Attribute, IntPtr lpValue, IntPtr cbSize, IntPtr lpPreviousValue, IntPtr lpReturnSize);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern void DeleteProcThreadAttributeList(IntPtr lpAttributeList);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool CreateProcessW(string lpApplicationName, string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFOEX lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CloseHandle(IntPtr hObject);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

        private const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
        private static readonly IntPtr PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE = new IntPtr(0x00020016);

        private IntPtr _ptyHandle = IntPtr.Zero;
        private IntPtr _ptyProcess = IntPtr.Zero;
        private SafeFileHandle _ptyInputWrite;
        private SafeFileHandle _ptyOutputRead;
        private FileStream _ptyInputStream;
        private Thread _ptyReadThread;
        private readonly object _ptyLock = new object();
        private int _ptySessionGen = 0;

        private static IntPtr _jobHandle = IntPtr.Zero;
        private static Mutex _singleInstanceMutex;
        private static Stopwatch _startupWatch;
        private HttpListener _listener;
        private SpeechRecognitionEngine _speech;
        private Thread _serverThread;
        private volatile bool _running = true;
        private int _port = 1337;
        private string _webRoot;
        private bool _enableDevTools = false;
        private CoreWebView2Environment _wvEnv;
        private CoreWebView2Controller _wvController;
        private CoreWebView2 _wvCore;
        private Microsoft.Web.WebView2.WinForms.WebView2 _webView;
        private Rectangle _maxButtonRect = Rectangle.Empty;
        private int _suppressWinFormsRestoreDepth = 0;
        private bool _wasZoomed = false;
        private readonly SubclassWndProcDelegate _subclassDelegate;
        private readonly HashSet<IntPtr> _subclassedHwnds = new HashSet<IntPtr>();

        private static string _appDataDir;
        private static string _toolWorkspace;
        private static string _workspaceId = Guid.NewGuid().ToString("N");
        private static readonly object _toolLock = new object();
        private static string _modelsDir;
        private static string _profilesFile;
        private static string _threadsFile;
        private static string _settingsFile;
        private static string _downloadLedgerFile;
        private static string _windowStateFile;
        private static string _runtimeStateFile;
        private static string _auditLogFile;
        private static readonly System.Collections.Generic.Dictionary<string, Process> _bgProcesses = new System.Collections.Generic.Dictionary<string, Process>();
        private static readonly System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<string>> _bgOutput = new System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<string>>();
        private static string _authToken;
        private static readonly object _dataLock = new object();

        // Verified WebView2 background-network suppression flags (ADR 0104)
        public const string WEBVIEW2_SILENCE_FLAGS =
            "--host-resolver-rules=\"MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost\" " +
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
            try {
                SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            } catch { }

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
                Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", WEBVIEW2_SILENCE_FLAGS + (Array.IndexOf(args, "--devtools") >= 0 ? " " + Environment.GetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") : ""));
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
            bool resetData = false;
            bool devTools = false;
            string customDataDir = null;
            string overrideToken = null;

            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "--version" || args[i] == "-v") {
                    versionCheck = true;
                } else if (args[i] == "--health") {
                    healthCheck = true;
                } else if (args[i] == "--reset") {
                    resetData = true;
                } else if (args[i] == "--headless") {
                    headless = true;
                } else if (args[i] == "--devtools") {
                    devTools = true;
                } else if (args[i] == "--port" && i + 1 < args.Length) {
                    if (int.TryParse(args[++i], out port)) explicitPort = true;
                } else if (args[i] == "--data-dir" && i + 1 < args.Length) {
                    customDataDir = args[++i];
                } else if (args[i] == "--engine-port" && i + 1 < args.Length) {
                    int candidate;
                    if (!int.TryParse(args[++i], out candidate) || candidate < 1024 || candidate > 65535) throw new ArgumentException("Invalid engine port");
                    _enginePort = candidate;
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
                _singleInstanceMutex = new Mutex(true, @"Local\SanctumDesktopSingleInstanceMutex" + (string.IsNullOrEmpty(customDataDir) ? "" : "-" + BitConverter.ToString(SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(customDataDir)))).Replace("-", "")), out createdNew);
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
            if (resetData) {
                WipeAppData(true, true);
                InitDirectories(customDataDir);
                if (headless) {
                    Console.WriteLine("{\"status\":\"reset_complete\"}");
                    return 0;
                }
            }

            string webRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "web");
            if (!Directory.Exists(webRoot)) {
                string payloadWeb = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "deploy", "installer", "build_payload", "resources", "web");
                string devWeb = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "apps", "web", "dist"));
                if (Directory.Exists(payloadWeb)) {
                    webRoot = payloadWeb;
                } else if (Directory.Exists(devWeb)) {
                    webRoot = devWeb;
                }
            }

            ServicePointManager.DefaultConnectionLimit = 32;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            DesktopHost app = new DesktopHost(port, webRoot, devTools, headless);

            // The virtual-host UI uses this authenticated loopback API for real streaming.
            app.StartHttpServer();
            LogEvent("info", "startup", "Sanctum started (commit __GIT_COMMIT__)");
            Task.Run(() => EnsureEngineStarted());

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

            _toolWorkspace = Path.Combine(_appDataDir, "workspace");
            Directory.CreateDirectory(_toolWorkspace);
            string workspaceConfig = Path.Combine(_appDataDir, "tool_workspace.txt");
            if (File.Exists(workspaceConfig)) {
                string saved = File.ReadAllText(workspaceConfig).Trim();
                if (Directory.Exists(saved)) _toolWorkspace = Path.GetFullPath(saved);
            }
            _modelsDir = Path.Combine(_appDataDir, "models");
            _profilesFile = Path.Combine(_appDataDir, "profiles.json");
            _threadsFile = Path.Combine(_appDataDir, "threads.json");
            _settingsFile = Path.Combine(_appDataDir, "settings.json");
            _downloadLedgerFile = Path.Combine(_appDataDir, "download_ledger.json");
            _windowStateFile = Path.Combine(_appDataDir, "window_state.json");
            _runtimeStateFile = Path.Combine(_appDataDir, "webview2_runtime_state.json");
            _auditLogFile = Path.Combine(_appDataDir, "audit.log");

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
            _subclassDelegate = new SubclassWndProcDelegate(ChildSubclassProc);

            if (headless) return;

            this.Text = "Sanctum";
            this.FormBorderStyle = FormBorderStyle.None;
            this.AutoScaleMode = AutoScaleMode.None;
            this.BackColor = Color.FromArgb(15, 15, 18);
            this.Padding = new Padding(0, 4, 0, 0);
            this.Margin = new Padding(0);
            this.DoubleBuffered = true;
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app-icon.ico");
            if (File.Exists(iconPath)) {
                try { this.Icon = new Icon(iconPath); } catch { }
            }

            InitializeWindowPosition();

            this.HandleCreated += (s, e) => {
                try {
                    MARGINS m = new MARGINS { cxLeftWidth = 0, cxRightWidth = 0, cyTopHeight = 1, cyBottomHeight = 0 };
                    DwmExtendFrameIntoClientArea(this.Handle, ref m);
                } catch { }
                try {
                    int useDark = 1;
                    DwmSetWindowAttribute(this.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDark, sizeof(int));
                } catch { }
                try {
                    int roundCorner = DWMWCP_ROUND;
                    DwmSetWindowAttribute(this.Handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref roundCorner, sizeof(int));
                } catch { }
                SyncWindowChromeState();
            };

            this.Load += async (s, e) => {
                await InitializeEmbeddedWebViewAsync();
            };

            this.Resize += (s, e) => {
                SyncWindowChromeState();
                if (_wvController != null) {
                    _wvController.Bounds = this.DisplayRectangle;
                }
                SubclassChildWindows();
            };

            this.LocationChanged += (s, e) => {
                NotifyWindowState();
            };

            this.FormClosing += (s, e) => {
                if (_installerRunning && MessageBox.Show(this, "A runtime installer is running. Close Sanctum and interrupt setup?", "Installation in progress", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) { e.Cancel = true; return; }
                if (_setupCancellation != null) _setupCancellation.Cancel();
                if (_speech != null) { try { _speech.RecognizeAsyncCancel(); _speech.Dispose(); } catch { } _speech = null; }
                StopPtySession();
                SaveWindowBounds();
                try {
                    if (_webView != null) {
                        _webView.Dispose();
                        _webView = null;
                    }
                    if (_wvController != null) {
                        _wvController.Close();
                        _wvController = null;
                    }
                } catch { }
            };
        }

        protected override CreateParams CreateParams {
            get {
                CreateParams cp = base.CreateParams;
                cp.Style |= (WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU);
                return cp;
            }
        }

        private int ScaleForDpi(int px) {
            try {
                uint dpi = GetDpiForWindow(this.Handle);
                if (dpi > 0) return Math.Max(px, (int)Math.Round(px * dpi / 96.0));
            } catch { }
            return px;
        }

        private void SyncWindowChromeState() {
            if (!IsHandleCreated) return;
            bool isMax = IsZoomed(this.Handle) || this.WindowState == FormWindowState.Maximized;
            int targetTop = isMax ? 0 : ScaleForDpi(4);
            if (this.Padding.Top != targetTop) {
                this.Padding = new Padding(0, targetTop, 0, 0);
            }
            NotifyWindowState();
        }

        private void ShowSystemMenu(Point screenPt) {
            try {
                IntPtr hMenu = GetSystemMenu(this.Handle, false);
                if (hMenu == IntPtr.Zero) return;
                bool isMax = IsZoomed(this.Handle) || this.WindowState == FormWindowState.Maximized;
                EnableMenuItem(hMenu, (uint)SC_RESTORE, MF_BYCOMMAND | (isMax ? MF_ENABLED : MF_GRAYED));
                EnableMenuItem(hMenu, (uint)SC_MOVE, MF_BYCOMMAND | (isMax ? MF_GRAYED : MF_ENABLED));
                EnableMenuItem(hMenu, (uint)SC_SIZE, MF_BYCOMMAND | (isMax ? MF_GRAYED : MF_ENABLED));
                EnableMenuItem(hMenu, (uint)SC_MINIMIZE, MF_BYCOMMAND | MF_ENABLED);
                EnableMenuItem(hMenu, (uint)SC_MAXIMIZE, MF_BYCOMMAND | (isMax ? MF_GRAYED : MF_ENABLED));
                EnableMenuItem(hMenu, (uint)SC_CLOSE, MF_BYCOMMAND | MF_ENABLED);

                int cmd = TrackPopupMenu(hMenu, TPM_RETURNCMD | TPM_RIGHTBUTTON, screenPt.X, screenPt.Y, 0, this.Handle, IntPtr.Zero);
                if (cmd != 0) {
                    PostMessage(this.Handle, WM_SYSCOMMAND, (IntPtr)cmd, IntPtr.Zero);
                }
            } catch { }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
            if (keyData == (Keys.Alt | Keys.Space)) {
                ShowSystemMenu(this.PointToScreen(new Point(ScaleForDpi(8), ScaleForDpi(36))));
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private IntPtr PerformHitTest(Point screenPt) {
            Point clientPt = this.PointToClient(screenPt);
            int w = this.ClientSize.Width;
            int h = this.ClientSize.Height;

            if (clientPt.X < 0 || clientPt.Y < 0 || clientPt.X >= w || clientPt.Y >= h) {
                return (IntPtr)HTCLIENT;
            }

            if (_maxButtonRect.Width > 0 && _maxButtonRect.Height > 0 && _maxButtonRect.Contains(clientPt)) {
                return (IntPtr)HTMAXBUTTON;
            }

            if (IsZoomed(this.Handle) || this.WindowState == FormWindowState.Maximized) {
                return (IntPtr)HTCLIENT;
            }

            int border = ScaleForDpi(6);
            int corner = ScaleForDpi(12);
            bool left = clientPt.X < border;
            bool right = clientPt.X >= w - border;
            bool top = clientPt.Y < border;
            bool bottom = clientPt.Y >= h - border;

            if (top && left) return (IntPtr)HTTOPLEFT;
            if (top && right) return (IntPtr)HTTOPRIGHT;
            if (bottom && left) return (IntPtr)HTBOTTOMLEFT;
            if (bottom && right) return (IntPtr)HTBOTTOMRIGHT;
            if (top) {
                if (clientPt.X < corner) return (IntPtr)HTTOPLEFT;
                if (clientPt.X >= w - corner) return (IntPtr)HTTOPRIGHT;
                return (IntPtr)HTTOP;
            }
            if (bottom) return (IntPtr)HTBOTTOM;
            if (left) return (IntPtr)HTLEFT;
            if (right) return (IntPtr)HTRIGHT;

            return (IntPtr)HTCLIENT;
        }

        private IntPtr ChildSubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, UIntPtr uIdSubclass, IntPtr dwRefData) {
            if (uMsg == WM_NCHITTEST) {
                int lp = unchecked((int)lParam.ToInt64());
                short x = (short)(lp & 0xFFFF);
                short y = (short)((lp >> 16) & 0xFFFF);
                IntPtr hit = PerformHitTest(new Point(x, y));
                if (hit != (IntPtr)HTCLIENT) {
                    return (IntPtr)HTTRANSPARENT;
                }
            }
            return DefSubclassProc(hWnd, uMsg, wParam, lParam);
        }

        private void SubclassChildWindows() {
            try {
                EnumChildWindows(this.Handle, (hWnd, lParam) => {
                    if (_subclassedHwnds.Add(hWnd)) {
                        SetWindowSubclass(hWnd, _subclassDelegate, (UIntPtr)1001, IntPtr.Zero);
                    }
                    return true;
                }, IntPtr.Zero);
            } catch { }
        }

        protected override void SetBoundsCore(int x, int y, int width, int height, BoundsSpecified specified) {
            // Suppress WinForms' RestoreWindowBoundsIfNecessary height inflation (+CaptionHeight)
            // when WM_NCCALCSIZE intentionally removes the native caption bar.
            if (_suppressWinFormsRestoreDepth > 0) {
                return;
            }
            base.SetBoundsCore(x, y, width, height, specified);
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == WM_NCCALCSIZE) {
                if (m.WParam != IntPtr.Zero) {
                    NCCALCSIZE_PARAMS csp = (NCCALCSIZE_PARAMS)Marshal.PtrToStructure(m.LParam, typeof(NCCALCSIZE_PARAMS));
                    if (IsZoomed(this.Handle)) {
                        IntPtr hMonitor = MonitorFromWindow(this.Handle, MONITOR_DEFAULTTONEAREST);
                        if (hMonitor != IntPtr.Zero) {
                            MONITORINFO mi = new MONITORINFO();
                            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
                            if (GetMonitorInfo(hMonitor, ref mi)) {
                                RECT work = mi.rcWork;
                                if (work.left == mi.rcMonitor.left && work.top == mi.rcMonitor.top &&
                                    work.right == mi.rcMonitor.right && work.bottom == mi.rcMonitor.bottom) {
                                    work.bottom -= 1;
                                }
                                csp.rgrc0 = work;
                            }
                        }
                    } else {
                        int borderX = GetMetric(SM_CXSIZEFRAME) + GetMetric(SM_CXPADDEDBORDER);
                        int borderY = GetMetric(SM_CYSIZEFRAME) + GetMetric(SM_CXPADDEDBORDER);
                        csp.rgrc0.left += borderX;
                        csp.rgrc0.right -= borderX;
                        csp.rgrc0.bottom -= borderY;
                    }
                    Marshal.StructureToPtr(csp, m.LParam, false);
                    m.Result = IntPtr.Zero;
                    return;
                }
            } else if (m.Msg == WM_GETMINMAXINFO) {
                MINMAXINFO mmi = (MINMAXINFO)Marshal.PtrToStructure(m.LParam, typeof(MINMAXINFO));
                IntPtr hMonitor = MonitorFromWindow(this.Handle, MONITOR_DEFAULTTONEAREST);
                if (hMonitor != IntPtr.Zero) {
                    MONITORINFO mi = new MONITORINFO();
                    mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
                    if (GetMonitorInfo(hMonitor, ref mi)) {
                        int borderX = GetMetric(SM_CXSIZEFRAME) + GetMetric(SM_CXPADDEDBORDER);
                        int borderY = GetMetric(SM_CYSIZEFRAME) + GetMetric(SM_CXPADDEDBORDER);
                        mmi.ptMaxPosition.x = (mi.rcWork.left - mi.rcMonitor.left) - borderX;
                        mmi.ptMaxPosition.y = (mi.rcWork.top - mi.rcMonitor.top) - borderY;
                        mmi.ptMaxSize.x = (mi.rcWork.right - mi.rcWork.left) + 2 * borderX;
                        mmi.ptMaxSize.y = (mi.rcWork.bottom - mi.rcWork.top) + 2 * borderY;
                    }
                }
                mmi.ptMinTrackSize.x = Math.Max(mmi.ptMinTrackSize.x, 420);
                mmi.ptMinTrackSize.y = Math.Max(mmi.ptMinTrackSize.y, 320);
                Marshal.StructureToPtr(mmi, m.LParam, false);
                m.Result = IntPtr.Zero;
                return;
            } else if (m.Msg == WM_NCHITTEST) {
                base.WndProc(ref m);
                if (m.Result == (IntPtr)HTCLIENT) {
                    int lp = unchecked((int)m.LParam.ToInt64());
                    short x = (short)(lp & 0xFFFF);
                    short y = (short)((lp >> 16) & 0xFFFF);
                    IntPtr hit = PerformHitTest(new Point(x, y));
                    if (hit != (IntPtr)HTCLIENT) {
                        m.Result = hit;
                    }
                }
                return;
            } else if (m.Msg == WM_NCLBUTTONDOWN) {
                if ((int)m.WParam == HTMAXBUTTON) {
                    m.Result = IntPtr.Zero;
                    return;
                }
            } else if (m.Msg == WM_NCLBUTTONUP) {
                if ((int)m.WParam == HTMAXBUTTON) {
                    if (this.WindowState == FormWindowState.Maximized || IsZoomed(this.Handle)) {
                        SendMessage(this.Handle, WM_SYSCOMMAND, SC_RESTORE, 0);
                    } else {
                        SendMessage(this.Handle, WM_SYSCOMMAND, SC_MAXIMIZE, 0);
                    }
                    m.Result = IntPtr.Zero;
                    return;
                }
            } else if (m.Msg == WM_WINDOWPOSCHANGED) {
                bool nowZoomed = IsHandleCreated && IsZoomed(this.Handle);
                bool restoringFromMax = _wasZoomed && !nowZoomed;
                _wasZoomed = nowZoomed;
                if (restoringFromMax) {
                    _suppressWinFormsRestoreDepth++;
                    try {
                        base.WndProc(ref m);
                    } finally {
                        _suppressWinFormsRestoreDepth--;
                    }
                    return;
                }
            } else if ((m.Msg == WM_SYSCOMMAND && ((int)m.WParam & 0xFFF0) == SC_RESTORE) ||
                       m.Msg == WM_SIZE) {
                _suppressWinFormsRestoreDepth++;
                try {
                    base.WndProc(ref m);
                } finally {
                    _suppressWinFormsRestoreDepth--;
                }
                return;
            }

            base.WndProc(ref m);
        }

        public void RestoreAndFocusWindow() {
            if (this.WindowState == FormWindowState.Minimized) {
                this.WindowState = FormWindowState.Normal;
            }
            this.Show();
            this.Activate();
            SetForegroundWindow(this.Handle);
        }

        private void InitializeWindowPosition() {
            Rectangle workArea = Screen.PrimaryScreen.WorkingArea;
            int defaultW = Math.Min(1280, Math.Max(900, workArea.Width - 80));
            int defaultH = Math.Min(820, Math.Max(600, workArea.Height - 80));
            int defaultX = workArea.Left + (workArea.Width - defaultW) / 2;
            int defaultY = workArea.Top + (workArea.Height - defaultH) / 2;

            this.StartPosition = FormStartPosition.Manual;
            this.MinimumSize = new Size(420, 320);
            this.Size = new Size(defaultW, defaultH);
            this.Location = new Point(defaultX, defaultY);

            try {
                if (!File.Exists(_windowStateFile)) {
                    this.WindowState = FormWindowState.Normal;
                    return;
                }

                string json = File.ReadAllText(_windowStateFile, Encoding.UTF8);
                int w = ExtractInt(json, "width", defaultW);
                int h = ExtractInt(json, "height", defaultH);
                int x = ExtractInt(json, "x", ExtractInt(json, "left", defaultX));
                int y = ExtractInt(json, "y", ExtractInt(json, "top", defaultY));
                bool isMax = Regex.IsMatch(json, "\"isMaximized\"\\s*:\\s*true", RegexOptions.IgnoreCase) ||
                             Regex.IsMatch(json, "\"maximized\"\\s*:\\s*true", RegexOptions.IgnoreCase);

                w = Math.Max(420, w);
                h = Math.Max(320, h);

                Rectangle candidate = new Rectangle(x, y, w, h);
                Screen targetScreen = null;
                foreach (Screen scr in Screen.AllScreens) {
                    if (scr.WorkingArea.IntersectsWith(candidate)) {
                        targetScreen = scr;
                        break;
                    }
                }

                if (targetScreen != null) {
                    Rectangle targetWork = targetScreen.WorkingArea;
                    w = Math.Min(w, targetWork.Width + 32);
                    h = Math.Min(h, targetWork.Height + 16);
                    x = Math.Max(targetWork.Left - 16, Math.Min(x, targetWork.Right - w + 16));
                    y = Math.Max(targetWork.Top, Math.Min(y, targetWork.Bottom - h + 16));

                    this.Location = new Point(x, y);
                    this.Size = new Size(w, h);

                    if (isMax) {
                        this.WindowState = FormWindowState.Maximized;
                    } else {
                        this.WindowState = FormWindowState.Normal;
                    }
                } else {
                    this.Location = new Point(defaultX, defaultY);
                    this.Size = new Size(defaultW, defaultH);
                    this.WindowState = FormWindowState.Normal;
                }
            } catch {
                this.Location = new Point(defaultX, defaultY);
                this.Size = new Size(defaultW, defaultH);
                this.WindowState = FormWindowState.Normal;
            }
        }

        private void SaveWindowBounds() {
            try {
                bool isMax = (this.WindowState == FormWindowState.Maximized) || IsZoomed(this.Handle);
                Rectangle bounds;
                if (isMax) {
                    bounds = this.RestoreBounds;
                } else {
                    bounds = this.Bounds;
                }

                if (bounds.Width < 420 || bounds.Height < 320) {
                    bounds.Width = Math.Max(420, bounds.Width);
                    bounds.Height = Math.Max(320, bounds.Height);
                }

                string json = string.Format(
                    "{{\"x\":{0},\"y\":{1},\"left\":{0},\"top\":{1},\"width\":{2},\"height\":{3},\"isMaximized\":{4},\"maximized\":{4}}}",
                    bounds.Left, bounds.Top, bounds.Width, bounds.Height,
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
                await EnsureWebViewRuntime();
                string userDataFolder = Path.Combine(_appDataDir, "ebwebview2_data");
                var envOptions = new CoreWebView2EnvironmentOptions(WEBVIEW2_SILENCE_FLAGS, "en-US", null, false, null);
                envOptions.AllowSingleSignOnUsingOSPrimaryAccount = false;
                try { envOptions.AreBrowserExtensionsEnabled = false; } catch { }
                try { envOptions.EnableTrackingPrevention = false; } catch { }
                try { envOptions.IsCustomCrashReportingEnabled = false; } catch { }

                _wvEnv = await CoreWebView2Environment.CreateAsync(null, userDataFolder, envOptions);
                _webView = new Microsoft.Web.WebView2.WinForms.WebView2();
                _webView.Dock = DockStyle.Fill;
                _webView.Margin = new Padding(0);
                _webView.Padding = new Padding(0);
                _webView.DefaultBackgroundColor = Color.FromArgb(15, 15, 18);
                this.Controls.Add(_webView);

                await _webView.EnsureCoreWebView2Async(_wvEnv);
                _wvCore = _webView.CoreWebView2;

                SubclassChildWindows();

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

                bool hasBundledWeb = !string.IsNullOrEmpty(_webRoot) && File.Exists(Path.Combine(_webRoot, "index.html"));

                // Block navigation to external origins
                _wvCore.NavigationStarting += (sender, args) => {
                    if (args.Uri != null &&
                        !args.Uri.StartsWith("https://sanctum.app", StringComparison.OrdinalIgnoreCase) &&
                        !args.Uri.StartsWith("about:blank", StringComparison.OrdinalIgnoreCase) &&
                        !( !hasBundledWeb && args.Uri.StartsWith("data:text/html", StringComparison.OrdinalIgnoreCase) )) {
                        args.Cancel = true;
                    }
                };

                _wvCore.PermissionRequested += (sender, args) => {
                    Uri origin;
                    bool trusted = Uri.TryCreate(args.Uri, UriKind.Absolute, out origin) && origin.Scheme == "https" && origin.Host == "sanctum.app";
                    args.State = trusted && args.PermissionKind == CoreWebView2PermissionKind.Microphone
                        ? CoreWebView2PermissionState.Default : CoreWebView2PermissionState.Deny;
                };

                // Preserve the workspace origin, but send API traffic to the shared streaming backend.
                // No UI-thread network calls, CORS changes to Ollama, or duplicate API implementation.
                string bridge = @"(() => {
                    const send = window.fetch.bind(window);
                    const base = 'http://127.0.0.1:__PORT__';
                    window.fetch = async (input, init) => {
                        const request = new Request(input, init);
                        const url = new URL(request.url);
                        let target = null;
                        if (url.origin === location.origin && (/^\/(api|v1)\//.test(url.pathname) || url.pathname === '/health')) target = base + url.pathname + url.search;
                        if (['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '11434') target = base + '/api/engine' + url.pathname + url.search;
                        if (!target) return send(input, init);
                        const headers = new Headers(request.headers);
                        headers.set('X-Sanctum-Auth', '__TOKEN__');
                        return send(target, { method: request.method, headers, signal: request.signal,
                            body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer() });
                    };
                })();".Replace("__PORT__", _port.ToString()).Replace("__TOKEN__", _authToken);
                await _wvCore.AddScriptToExecuteOnDocumentCreatedAsync(bridge);

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
                    SubclassChildWindows();
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
                LogEvent("error", "display", ex.Message);
                MessageBox.Show(this, "Sanctum could not open its display: " + ex.Message + "\nRestart Sanctum to retry. Logs: " + LogPath, "Sanctum startup");
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
                    "false",
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
                    bool isMax = (this.WindowState == FormWindowState.Maximized) || IsZoomed(this.Handle);
                    _wvCore.PostWebMessageAsJson("{\"type\":\"windowStateChanged\",\"isMaximized\":" + (isMax ? "true" : "false") + "}");
                }
            } catch { }
        }

        private void SpeechEvent(string type, string text) {
            if (IsDisposed || !IsHandleCreated) return;
            BeginInvoke((Action)(() => {
                if (_wvCore != null) _wvCore.PostWebMessageAsJson(new JavaScriptSerializer().Serialize(new { type = type, text = text }));
            }));
        }

        private void StartDictation() {
            try {
                if (_speech != null) { _speech.Dispose(); _speech = null; }
                var recognizers = SpeechRecognitionEngine.InstalledRecognizers();
                if (recognizers.Count == 0) throw new InvalidOperationException("Install Windows Speech Recognition in Settings > Time & language > Speech.");
                _speech = new SpeechRecognitionEngine(recognizers[0]);
                _speech.LoadGrammar(new DictationGrammar());
                _speech.SpeechRecognized += (s, e) => SpeechEvent("speechResult", e.Result.Text);
                _speech.RecognizeCompleted += (s, e) => SpeechEvent(e.Error == null ? "speechStopped" : "speechError", e.Error == null ? "" : e.Error.Message);
                _speech.SetInputToDefaultAudioDevice();
                _speech.RecognizeAsync(RecognizeMode.Multiple);
                SpeechEvent("speechStarted", "Listening on this device");
            } catch (Exception ex) {
                if (_speech != null) { _speech.Dispose(); _speech = null; }
                SpeechEvent("speechError", "Cannot start microphone: " + ex.Message);
            }
        }

        private void PtyPost(object payload) {
            if (IsDisposed || !IsHandleCreated) return;
            try {
                string json = new JavaScriptSerializer().Serialize(payload);
                BeginInvoke((Action)(() => {
                    try {
                        if (_wvCore != null) _wvCore.PostWebMessageAsJson(json);
                    } catch { }
                }));
            } catch { }
        }

        private void StartPtySession(string shell, string cwd, int cols, int rows) {
            StopPtySession();
            int gen;
            lock (_ptyLock) {
                gen = ++_ptySessionGen;
            }

            try {
                short c = (short)Math.Max(20, Math.Min(400, cols));
                short r = (short)Math.Max(5, Math.Min(150, rows));

                string workDir = (!string.IsNullOrEmpty(cwd) && Directory.Exists(cwd)) ? cwd : _toolWorkspace;
                if (string.IsNullOrEmpty(workDir) || !Directory.Exists(workDir)) {
                    workDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                }

                string cmdLine = "powershell.exe -NoLogo";
                if (string.Equals(shell, "cmd", StringComparison.OrdinalIgnoreCase)) {
                    cmdLine = "cmd.exe";
                } else if (string.Equals(shell, "wsl", StringComparison.OrdinalIgnoreCase)) {
                    cmdLine = "wsl.exe";
                }

                SECURITY_ATTRIBUTES sa = new SECURITY_ATTRIBUTES {
                    nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),
                    bInheritHandle = 0
                };
                SafeFileHandle inRead, inWrite, outRead, outWrite;
                if (!CreatePipe(out inRead, out inWrite, ref sa, 0) ||
                    !CreatePipe(out outRead, out outWrite, ref sa, 0)) {
                    throw new Exception("CreatePipe failed");
                }

                IntPtr hPC;
                int hr = CreatePseudoConsole(new COORD { X = c, Y = r }, inRead, outWrite, 0, out hPC);
                inRead.Dispose();
                outWrite.Dispose();
                if (hr != 0 || hPC == IntPtr.Zero) {
                    inWrite.Dispose();
                    outRead.Dispose();
                    throw new Exception("CreatePseudoConsole failed: 0x" + hr.ToString("X"));
                }

                IntPtr attrSize = IntPtr.Zero;
                InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attrSize);
                IntPtr attrList = Marshal.AllocHGlobal(attrSize);
                PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
                bool started = false;

                try {
                    if (!InitializeProcThreadAttributeList(attrList, 1, 0, ref attrSize)) {
                        throw new Exception("InitializeProcThreadAttributeList failed");
                    }
                    if (!UpdateProcThreadAttribute(attrList, 0, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, hPC, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero)) {
                        throw new Exception("UpdateProcThreadAttribute failed");
                    }

                    STARTUPINFOEX si = new STARTUPINFOEX();
                    si.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
                    si.lpAttributeList = attrList;

                    started = CreateProcessW(
                        null,
                        cmdLine,
                        IntPtr.Zero,
                        IntPtr.Zero,
                        false,
                        EXTENDED_STARTUPINFO_PRESENT,
                        IntPtr.Zero,
                        workDir,
                        ref si,
                        out pi
                    );
                } finally {
                    DeleteProcThreadAttributeList(attrList);
                    Marshal.FreeHGlobal(attrList);
                }

                if (!started) {
                    int err = Marshal.GetLastWin32Error();
                    ClosePseudoConsole(hPC);
                    inWrite.Dispose();
                    outRead.Dispose();
                    throw new Exception("CreateProcessW failed: " + err);
                }

                if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
                if (_jobHandle != IntPtr.Zero && pi.hProcess != IntPtr.Zero) {
                    try { AssignProcessToJobObject(_jobHandle, pi.hProcess); } catch { }
                }

                FileStream inputStream = new FileStream(inWrite, FileAccess.Write, 4096, false);
                FileStream outputStream = new FileStream(outRead, FileAccess.Read, 4096, false);

                lock (_ptyLock) {
                    if (gen != _ptySessionGen) {
                        try { inputStream.Dispose(); } catch { }
                        try { outputStream.Dispose(); } catch { }
                        ClosePseudoConsole(hPC);
                        if (pi.hProcess != IntPtr.Zero) {
                            try { TerminateProcess(pi.hProcess, 1); CloseHandle(pi.hProcess); } catch { }
                        }
                        return;
                    }
                    _ptyHandle = hPC;
                    _ptyProcess = pi.hProcess;
                    _ptyInputWrite = inWrite;
                    _ptyOutputRead = outRead;
                    _ptyInputStream = inputStream;
                }

                Thread reader = new Thread(() => {
                    byte[] buf = new byte[4096];
                    char[] chars = new char[4096];
                    Decoder dec = Encoding.UTF8.GetDecoder();
                    try {
                        while (true) {
                            int n = outputStream.Read(buf, 0, buf.Length);
                            if (n <= 0) break;
                            int charCount = dec.GetChars(buf, 0, n, chars, 0, false);
                            if (charCount > 0) {
                                string chunk = new string(chars, 0, charCount);
                                PtyPost(new { type = "ptyOutput", gen = gen, data = chunk });
                            }
                        }
                    } catch {
                    } finally {
                        try { outputStream.Dispose(); } catch { }
                        uint exitCode = 0;
                        IntPtr procCopy = IntPtr.Zero;
                        lock (_ptyLock) {
                            if (gen == _ptySessionGen) {
                                procCopy = _ptyProcess;
                            }
                        }
                        if (procCopy != IntPtr.Zero) {
                            try { GetExitCodeProcess(procCopy, out exitCode); } catch { }
                        }
                        PtyPost(new { type = "ptyExit", gen = gen, exitCode = (int)exitCode });
                    }
                });
                reader.IsBackground = true;
                reader.Start();
                _ptyReadThread = reader;
            } catch (Exception ex) {
                PtyPost(new { type = "ptyOutput", gen = gen, data = "\r\n\x1b[31m[Terminal error: " + ex.Message + "]\x1b[0m\r\n" });
                PtyPost(new { type = "ptyExit", gen = gen, exitCode = 1 });
            }
        }

        private void WritePtyInput(string data) {
            if (string.IsNullOrEmpty(data)) return;
            lock (_ptyLock) {
                if (_ptyInputStream == null) return;
                try {
                    byte[] bytes = Encoding.UTF8.GetBytes(data);
                    _ptyInputStream.Write(bytes, 0, bytes.Length);
                    _ptyInputStream.Flush();
                } catch { }
            }
        }

        private void ResizePty(int cols, int rows) {
            lock (_ptyLock) {
                if (_ptyHandle == IntPtr.Zero) return;
                try {
                    short c = (short)Math.Max(20, Math.Min(400, cols));
                    short r = (short)Math.Max(5, Math.Min(150, rows));
                    ResizePseudoConsole(_ptyHandle, new COORD { X = c, Y = r });
                } catch { }
            }
        }

        private void StopPtySession() {
            lock (_ptyLock) {
                _ptySessionGen++;
                if (_ptyInputStream != null) {
                    try { _ptyInputStream.Dispose(); } catch { }
                    _ptyInputStream = null;
                }
                if (_ptyInputWrite != null) {
                    try { _ptyInputWrite.Dispose(); } catch { }
                    _ptyInputWrite = null;
                }
                if (_ptyHandle != IntPtr.Zero) {
                    try { ClosePseudoConsole(_ptyHandle); } catch { }
                    _ptyHandle = IntPtr.Zero;
                }
                if (_ptyOutputRead != null) {
                    try { _ptyOutputRead.Dispose(); } catch { }
                    _ptyOutputRead = null;
                }
                if (_ptyProcess != IntPtr.Zero) {
                    try { TerminateProcess(_ptyProcess, 0); } catch { }
                    try { CloseHandle(_ptyProcess); } catch { }
                    _ptyProcess = IntPtr.Zero;
                }
                _ptyReadThread = null;
            }
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
            try {
                string raw = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(raw)) raw = e.WebMessageAsJson;
                if (string.IsNullOrEmpty(raw)) return;

                if (e.Source != "https://sanctum.app/index.html" && !e.Source.StartsWith("https://sanctum.app/")) return;
                if (raw.Contains("\"exportLogs\"")) {
                    ExportLogs();
                } else if (raw.Contains("\"openLogs\"")) {
                    Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
                    Process.Start(new ProcessStartInfo("explorer.exe", "\"" + Path.GetDirectoryName(LogPath) + "\"") { UseShellExecute = true });
                } else if (raw.Contains("\"speechStart\"")) {
                    StartDictation();
                } else if (raw.Contains("\"speechStop\"")) {
                    if (_speech != null) _speech.RecognizeAsyncStop();
                } else if (raw.Contains("\"selectToolWorkspace\"")) {
                    using (var dlg = new FolderBrowserDialog()) {
                        dlg.Description = "Choose the workspace Sanctum can read and edit";
                        dlg.SelectedPath = _toolWorkspace;
                        if (dlg.ShowDialog(this) == DialogResult.OK) {
                            lock (_toolLock) {
                                _toolWorkspace = Path.GetFullPath(dlg.SelectedPath);
                                _workspaceId = Guid.NewGuid().ToString("N");
                                File.WriteAllText(Path.Combine(_appDataDir, "tool_workspace.txt"), _toolWorkspace);
                            }
                            _wvCore.PostWebMessageAsJson("{\"type\":\"toolWorkspaceChanged\"}");
                        }
                    }
                } else if (raw.Contains("\"selectFolder\"")) {
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
                } else if (raw.Contains("\"setMaximizeBounds\"")) {
                    int x = ExtractInt(raw, "x", -1);
                    int y = ExtractInt(raw, "y", -1);
                    int w = ExtractInt(raw, "width", -1);
                    int h = ExtractInt(raw, "height", -1);
                    if (x >= 0 && y >= 0 && w > 0 && h > 0) {
                        _maxButtonRect = new Rectangle(x, y, w, h);
                    }
                } else if (raw.Contains("\"ptyStart\"")) {
                    var payload = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
                    string ptyShell = payload.ContainsKey("shell") ? Convert.ToString(payload["shell"]) : "powershell";
                    string ptyCwd = payload.ContainsKey("cwd") ? Convert.ToString(payload["cwd"]) : "";
                    int cols = payload.ContainsKey("cols") ? Convert.ToInt32(payload["cols"]) : 80;
                    int rows = payload.ContainsKey("rows") ? Convert.ToInt32(payload["rows"]) : 24;
                    StartPtySession(ptyShell, ptyCwd, cols, rows);
                } else if (raw.Contains("\"ptyInput\"")) {
                    var payload = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
                    string inputData = payload.ContainsKey("data") ? Convert.ToString(payload["data"]) : "";
                    WritePtyInput(inputData);
                } else if (raw.Contains("\"ptyResize\"")) {
                    var payload = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
                    int cols = payload.ContainsKey("cols") ? Convert.ToInt32(payload["cols"]) : 80;
                    int rows = payload.ContainsKey("rows") ? Convert.ToInt32(payload["rows"]) : 24;
                    ResizePty(cols, rows);
                } else if (raw.Contains("\"ptyStop\"")) {
                    StopPtySession();
                } else if (raw.Contains("\"windowDrag\"")) {
                    if ((GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0) {
                        Point pt = Cursor.Position;
                        IntPtr lParam = (IntPtr)unchecked(((pt.Y & 0xFFFF) << 16) | (pt.X & 0xFFFF));
                        ReleaseCapture();
                        SendMessagePtr(this.Handle, WM_NCLBUTTONDOWN, (IntPtr)HT_CAPTION, lParam);
                    }
                } else if (raw.Contains("\"windowSystemMenuAtOrigin\"")) {
                    ShowSystemMenu(this.PointToScreen(new Point(ScaleForDpi(8), ScaleForDpi(36))));
                } else if (raw.Contains("\"windowSystemMenu\"")) {
                    ShowSystemMenu(Cursor.Position);
                } else if (raw.Contains("\"windowMinimize\"")) {
                    SendMessage(this.Handle, WM_SYSCOMMAND, SC_MINIMIZE, 0);
                } else if (raw.Contains("\"windowRestore\"")) {
                    SendMessage(this.Handle, WM_SYSCOMMAND, SC_RESTORE, 0);
                } else if (raw.Contains("\"windowMaximize\"")) {
                    if (this.WindowState == FormWindowState.Maximized || IsZoomed(this.Handle)) {
                        SendMessage(this.Handle, WM_SYSCOMMAND, SC_RESTORE, 0);
                    } else {
                        SendMessage(this.Handle, WM_SYSCOMMAND, SC_MAXIMIZE, 0);
                    }
                } else if (raw.Contains("\"windowClose\"")) {
                    SendMessage(this.Handle, WM_SYSCOMMAND, SC_CLOSE, 0);
                }
            } catch { }
        }

        private void OnWebResourceRequested(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
            try {
                Uri uri = new Uri(e.Request.Uri);

                // Allow direct loopback to local inference daemons (e.g. Ollama 11434, llama-server 18080) for real SSE streaming
                if ((uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                     uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) &&
                    uri.Port != 80 && uri.Port != 443) {
                    return; // Pass through to local daemon
                }

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
                e.Response = _wvEnv.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes("API requests must use the desktop bridge")), 400, "Bad Request", "Content-Type: text/plain");
            } catch (Exception ex) {
                byte[] err = Encoding.UTF8.GetBytes("{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                e.Response = _wvEnv.CreateWebResourceResponse(new MemoryStream(err), 500, "Internal Error", "Content-Type: application/json");
            }
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
            string origin = req.Headers["Origin"];
            if (origin == "https://sanctum.app" || origin == "http://127.0.0.1:" + _port) res.Headers.Add("Access-Control-Allow-Origin", origin);
            res.Headers.Add("Vary", "Origin");
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

            if (req.Headers["X-Sanctum-Auth"] != _authToken && req.Headers["Authorization"] != "Bearer " + _authToken) {
                WriteJson(res, 401, new { error = "Authentication required" });
                return;
            }

            try { if (HandleDesktopServices(req, res, path, method)) return; }
            catch (Exception ex) { LogEvent("error", "desktop", ex.Message); WriteJson(res, 500, new { error = ex.Message }); return; }

            if (path == "/api/workspace" && method == "GET") {
                lock (_toolLock) WriteJson(res, 200, new { root = _toolWorkspace, id = _workspaceId });
                return;
            }
            if (path == "/api/tools/execute" && method == "POST") {
                HandleWorkspaceTool(req, res); return;
            }

            if (path.StartsWith("/api/engine/api/")) {
                string enginePath = path.Substring("/api/engine".Length);
                if (enginePath != "/api/tags" && enginePath != "/api/ps" && enginePath != "/api/show" && enginePath != "/api/chat" && enginePath != "/api/pull" && enginePath != "/api/generate" && enginePath != "/api/embed" && enginePath != "/api/embeddings") {
                    WriteJson(res, 404, new { error = "Unsupported engine operation" }); return;
                }
                ProxyRequest(req, res, EngineBase + enginePath); return;
            }
            if (path == "/api/chat" && method == "POST") {
                ProxyRequest(req, res, EngineBase + "/api/chat"); return;
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
                ProxyRequest(req, res, "http://127.0.0.1:8000/health"); return;
            }
            if (path == "/api/audio/transcribe" && method == "POST") {
                ProxyRequest(req, res, "http://127.0.0.1:8000/transcribe"); return;
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

            if (path == "/api/memory") {
                HandleMemory(req, res);
                return;
            }

            if (path == "/api/mcp") {
                HandleMcp(req, res);
                return;
            }

            if (path == "/api/audit/logs") {
                HandleAuditLogs(req, res);
                return;
            }

            if (path == "/api/terminal/execute") {
                HandleTerminal(req, res);
                return;
            }

            if (path == "/api/reset" && method == "POST") {
                HandleReset(req, res);
                return;
            }

            WriteJson(res, 404, new { error = "Unknown API route" });
        }

        // Every model-supplied path is relative to the user-selected workspace.
        private static void RecordAuditLog(string tool, string path, string action, string scope, string decision, string reason) {
            try {
                var record = new System.Collections.Generic.Dictionary<string, object>();
                record["id"] = "audit-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 6);
                record["timestamp"] = DateTime.UtcNow.ToString("o");
                record["tool"] = tool ?? "";
                record["path"] = path ?? "";
                record["action"] = action ?? "";
                record["scope"] = scope ?? "";
                record["decision"] = decision ?? "";
                record["reason"] = reason ?? "";
                string line = new JavaScriptSerializer().Serialize(record) + Environment.NewLine;
                lock (_dataLock) {
                    if (!string.IsNullOrEmpty(_auditLogFile)) {
                        File.AppendAllText(_auditLogFile, line, Encoding.UTF8);
                    }
                }
            } catch { }
        }

        private static bool IsHardBlocked(string canonicalPath) {
            string lower = canonicalPath.ToLowerInvariant();
            string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile).ToLowerInvariant();
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData).ToLowerInvariant();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData).ToLowerInvariant();
            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows).ToLowerInvariant();
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles).ToLowerInvariant();
            string progFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86).ToLowerInvariant();

            string[] blocked = new string[] {
                windir,
                Path.Combine(windir, "system32").ToLowerInvariant(),
                Path.Combine(windir, "syswow64").ToLowerInvariant(),
                progFiles,
                progFilesX86,
                Path.Combine(home, ".ssh").ToLowerInvariant(),
                Path.Combine(home, ".aws").ToLowerInvariant(),
                Path.Combine(home, ".azure").ToLowerInvariant(),
                Path.Combine(home, ".config", "gcloud").ToLowerInvariant(),
                Path.Combine(home, ".gnupg").ToLowerInvariant(),
                Path.Combine(home, ".git-credentials").ToLowerInvariant(),
                Path.Combine(home, ".netrc").ToLowerInvariant(),
                Path.Combine(localAppData, "google", "chrome").ToLowerInvariant(),
                Path.Combine(localAppData, "microsoft", "edge").ToLowerInvariant(),
                Path.Combine(appData, "mozilla", "firefox").ToLowerInvariant(),
                Path.Combine(localAppData, "bravesoftware").ToLowerInvariant(),
                Path.Combine(appData, "sanctum", "settings.json").ToLowerInvariant()
            };

            for (int i = 0; i < blocked.Length; i++) {
                string prefix = blocked[i];
                if (lower == prefix || lower.StartsWith(prefix + Path.DirectorySeparatorChar) || lower.StartsWith(prefix + "/")) {
                    return true;
                }
            }
            return false;
        }

        // Host-side Canonical Path Resolver and Access Scope Enforcer (ADR 0105 / Coding Agent Phase 1)
        private static string ToolPath(string relative, bool allowRoot, string action) {
            if (relative == "." && allowRoot) relative = "";
            if (relative == null || relative.IndexOf('\0') >= 0)
                throw new Exception("Invalid or null path argument.");
            string trimmed = relative.Trim();
            if (trimmed.StartsWith("\\") || trimmed.StartsWith("//"))
                throw new Exception("UNC network paths are not allowed.");

            foreach (string part in trimmed.Replace('/', '\\').Split('\\')) {
                if (string.IsNullOrEmpty(part) || part == "." || part == "..") continue;
                string stem = part.Split('.')[0].ToUpperInvariant();
                if (part.EndsWith(" ") || part.EndsWith(".") || stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL" ||
                    System.Text.RegularExpressions.Regex.IsMatch(stem, "^(COM|LPT)[0-9]$")) throw new Exception("Invalid Windows path segment.");
            }

            string scope = "workspace_only";
            bool overrideHardBlocked = false;
            var allowedFolders = new System.Collections.Generic.List<string>();
            try {
                if (File.Exists(_settingsFile)) {
                    var sDict = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(File.ReadAllText(_settingsFile, Encoding.UTF8));
                    if (sDict != null) {
                        if (sDict.ContainsKey("access.scope") && sDict["access.scope"] != null)
                            scope = Convert.ToString(sDict["access.scope"]);
                        if (sDict.ContainsKey("access.overrideHardBlocked") && sDict["access.overrideHardBlocked"] != null)
                            overrideHardBlocked = Convert.ToBoolean(sDict["access.overrideHardBlocked"]);
                        if (sDict.ContainsKey("access.allowedFolders") && sDict["access.allowedFolders"] != null) {
                            object af = sDict["access.allowedFolders"];
                            if (af is System.Collections.ArrayList) {
                                foreach (object item in (System.Collections.ArrayList)af) allowedFolders.Add(Convert.ToString(item));
                            } else {
                                string afStr = Convert.ToString(af);
                                try {
                                    var parsedArr = new JavaScriptSerializer().Deserialize<string[]>(afStr);
                                    if (parsedArr != null) allowedFolders.AddRange(parsedArr);
                                } catch {
                                    string[] parts = afStr.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                                    for (int p = 0; p < parts.Length; p++) allowedFolders.Add(parts[p].Trim());
                                }
                            }
                        }
                    }
                }
            } catch { }

            string root = Path.GetFullPath(_toolWorkspace).TrimEnd(Path.DirectorySeparatorChar);
            string full;
            if (Path.IsPathRooted(trimmed)) {
                if (scope == "workspace_only")
                    throw new Exception("Absolute paths are forbidden under 'workspace_only' access scope.");
                full = Path.GetFullPath(trimmed);
            } else {
                full = Path.GetFullPath(Path.Combine(root, trimmed));
            }

            string current = full;
            while (!string.IsNullOrEmpty(current)) {
                if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                    throw new Exception("Symbolic links and junctions are not allowed in workspace tools.");
                current = Path.GetDirectoryName(current);
            }

            if (!overrideHardBlocked && IsHardBlocked(full)) {
                string reason = "Access to critical system or credential path is hard-blocked: " + full;
                RecordAuditLog("workspace_files", full, action, scope, "denied", reason);
                throw new Exception(reason);
            }

            bool isSameAsRoot = full.Equals(root, StringComparison.OrdinalIgnoreCase);
            bool isInsideRoot = full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
            bool isInWorkspace = (allowRoot && isSameAsRoot) || isInsideRoot;

            if (isInWorkspace) {
                return full;
            }

            bool isWrite = action == "create" || action == "edit" || action == "patch" || action == "mkdir" || action == "move" || action == "delete";
            string mode = isWrite ? "write" : "read";

            if (scope == "workspace_only") {
                string reason = "Path is outside the workspace under 'workspace_only' scope.";
                RecordAuditLog("workspace_files", full, action + " (" + mode + ")", scope, "denied", reason);
                throw new Exception(reason);
            }

            if (scope == "selected_folders") {
                bool matched = false;
                string lowerFull = full.ToLowerInvariant();
                foreach (string f in allowedFolders) {
                    if (string.IsNullOrEmpty(f)) continue;
                    string cf = Path.GetFullPath(f).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
                    if (lowerFull == cf || lowerFull.StartsWith(cf + Path.DirectorySeparatorChar)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    string reason = "Path is not in the granted folders allowlist for 'selected_folders' scope.";
                    RecordAuditLog("workspace_files", full, action + " (" + mode + ")", scope, "denied", reason);
                    throw new Exception(reason);
                }
                RecordAuditLog("workspace_files", full, action + " (" + mode + ")", scope, "allowed", "Matched granted allowlist folder");
                return full;
            }

            if (scope == "system_read") {
                if (isWrite) {
                    string reason = "Write operations outside the workspace are blocked in 'system_read' mode.";
                    RecordAuditLog("workspace_files", full, action + " (write)", scope, "denied", reason);
                    throw new Exception(reason);
                }
                RecordAuditLog("workspace_files", full, action + " (read)", scope, "allowed", "Permitted under 'system_read' scope");
                return full;
            }

            if (scope == "system_full") {
                RecordAuditLog("workspace_files", full, action + " (" + mode + ")", scope, "allowed", "Permitted under 'system_full' scope");
                return full;
            }

            string unkReason = "Unknown access scope: " + scope;
            RecordAuditLog("workspace_files", full, action, scope, "denied", unkReason);
            throw new Exception(unkReason);
        }

private void HandleTerminal(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                if (req.HttpMethod != "POST") {
                    WriteJson(res, 405, new { error = "Method not allowed" });
                    return;
                }
                string body;
                using (var reader = new StreamReader(req.InputStream, Encoding.UTF8)) body = reader.ReadToEnd();
                var reqDict = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(body);
                if (reqDict == null) throw new Exception("Invalid request body.");

                string action = reqDict.ContainsKey("action") ? Convert.ToString(reqDict["action"]) : "run_command";
                string command = reqDict.ContainsKey("command") ? Convert.ToString(reqDict["command"]) : "";
                string cwd = reqDict.ContainsKey("cwd") && !string.IsNullOrEmpty(Convert.ToString(reqDict["cwd"])) ? Convert.ToString(reqDict["cwd"]) : _toolWorkspace;
                string shell = reqDict.ContainsKey("shell") ? Convert.ToString(reqDict["shell"]).ToLowerInvariant() : "powershell";
                int timeoutMs = reqDict.ContainsKey("timeoutMs") ? Convert.ToInt32(reqDict["timeoutMs"]) : 30000;
                int maxOutputChars = reqDict.ContainsKey("maxOutputChars") ? Convert.ToInt32(reqDict["maxOutputChars"]) : 20000;

                string spillsDir = Path.Combine(_appDataDir, "spills");
                if (!Directory.Exists(spillsDir)) Directory.CreateDirectory(spillsDir);

                if (action == "run_command") {
                    if (string.IsNullOrEmpty(command.Trim())) throw new Exception("Command cannot be empty.");

                    string execFile = "powershell.exe";
                    string execArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command " + command;
                    if (shell == "cmd") {
                        execFile = "cmd.exe";
                        execArgs = "/d /s /c " + command;
                    } else if (shell == "wsl") {
                        execFile = "wsl.exe";
                        execArgs = "-e bash -c " + command;
                    }

                    var psi = new ProcessStartInfo {
                        FileName = execFile,
                        Arguments = execArgs,
                        WorkingDirectory = Directory.Exists(cwd) ? cwd : _toolWorkspace,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    var sw = Stopwatch.StartNew();
                    using (var proc = new Process { StartInfo = psi }) {
                        var outSb = new StringBuilder();
                        var errSb = new StringBuilder();

                        proc.OutputDataReceived += (s, e) => { if (e.Data != null) outSb.AppendLine(e.Data); };
                        proc.ErrorDataReceived += (s, e) => { if (e.Data != null) errSb.AppendLine(e.Data); };

                        proc.Start();
                        proc.BeginOutputReadLine();
                        proc.BeginErrorReadLine();

                        bool finished = proc.WaitForExit(timeoutMs);
                        if (!finished) {
                            try { proc.Kill(); } catch { }
                            throw new Exception("Command timed out after " + timeoutMs + "ms.");
                        }

                        sw.Stop();
                        string stdOut = outSb.ToString();
                        string stdErr = errSb.ToString();
                        bool truncated = false;
                        string spillPath = null;

                        if (stdOut.Length + stdErr.Length > maxOutputChars) {
                            truncated = true;
                            string taskId = "term-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 5);
                            spillPath = Path.Combine(spillsDir, taskId + ".log");
                            File.WriteAllText(spillPath, "=== COMMAND: " + command + "\r\n=== CWD: " + cwd + "\r\n\r\n--- STDOUT ---\r\n" + stdOut + "\r\n--- STDERR ---\r\n" + stdErr, Encoding.UTF8);
                            if (stdOut.Length > maxOutputChars) {
                                stdOut = stdOut.Substring(0, maxOutputChars) + "\r\n\r\n[Output truncated: full log saved to " + spillPath + "]";
                            }
                        }

                        RecordAuditLog("run_command", cwd, command, "local", proc.ExitCode == 0 ? "allowed" : "allowed", "ExitCode: " + proc.ExitCode);

                        WriteJson(res, 200, new {
                            stdout = stdOut,
                            stderr = stdErr,
                            exitCode = proc.ExitCode,
                            durationMs = sw.ElapsedMilliseconds,
                            truncated = truncated,
                            spillPath = spillPath,
                            command = command,
                            cwd = cwd
                        });
                        return;
                    }
                }

                if (action == "start_background") {
                    if (string.IsNullOrEmpty(command.Trim())) throw new Exception("Command cannot be empty.");
                    string taskId = "bg-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 5);

                    string execFile = "powershell.exe";
                    string execArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command " + command;
                    if (shell == "cmd") { execFile = "cmd.exe"; execArgs = "/d /s /c " + command; }
                    else if (shell == "wsl") { execFile = "wsl.exe"; execArgs = "-e bash -c " + command; }

                    var psi = new ProcessStartInfo {
                        FileName = execFile,
                        Arguments = execArgs,
                        WorkingDirectory = Directory.Exists(cwd) ? cwd : _toolWorkspace,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    var proc = new Process { StartInfo = psi };
                    var outputList = new System.Collections.Generic.List<string>();

                    string spillPath = Path.Combine(spillsDir, taskId + ".log");
                    proc.OutputDataReceived += (s, e) => {
                        if (e.Data != null) {
                            lock (outputList) {
                                outputList.Add(e.Data);
                                if (outputList.Count > 500) outputList.RemoveAt(0);
                            }
                            try { File.AppendAllText(spillPath, e.Data + "\r\n", Encoding.UTF8); } catch { }
                        }
                    };
                    proc.ErrorDataReceived += (s, e) => {
                        if (e.Data != null) {
                            lock (outputList) {
                                outputList.Add("[STDERR] " + e.Data);
                                if (outputList.Count > 500) outputList.RemoveAt(0);
                            }
                            try { File.AppendAllText(spillPath, "[STDERR] " + e.Data + "\r\n", Encoding.UTF8); } catch { }
                        }
                    };

                    proc.Start();
                    proc.BeginOutputReadLine();
                    proc.BeginErrorReadLine();

                    lock (_dataLock) {
                        _bgProcesses[taskId] = proc;
                        _bgOutput[taskId] = outputList;
                    }

                    RecordAuditLog("start_background", cwd, command, "local", "allowed", "Task ID: " + taskId);
                    WriteJson(res, 200, new { taskId = taskId, message = "Background task started with ID: " + taskId });
                    return;
                }

                if (action == "read_background_output") {
                    string taskId = reqDict.ContainsKey("taskId") ? Convert.ToString(reqDict["taskId"]) : "";
                    int limit = reqDict.ContainsKey("limit") ? Convert.ToInt32(reqDict["limit"]) : 100;

                    lock (_dataLock) {
                        if (!_bgProcesses.ContainsKey(taskId) && !_bgOutput.ContainsKey(taskId))
                            throw new Exception("Background task not found: " + taskId);

                        var outList = _bgOutput.ContainsKey(taskId) ? _bgOutput[taskId] : new System.Collections.Generic.List<string>();
                        var lines = new System.Collections.Generic.List<string>();
                        lock (outList) {
                            int start = Math.Max(0, outList.Count - limit);
                            for (int i = start; i < outList.Count; i++) lines.Add(outList[i]);
                        }
                        bool isRunning = _bgProcesses.ContainsKey(taskId) && !_bgProcesses[taskId].HasExited;
                        int? exitCode = (_bgProcesses.ContainsKey(taskId) && _bgProcesses[taskId].HasExited) ? (int?)_bgProcesses[taskId].ExitCode : null;

                        WriteJson(res, 200, new {
                            taskId = taskId,
                            status = isRunning ? "running" : "completed",
                            exitCode = exitCode,
                            output = string.Join("\r\n", lines.ToArray()),
                            spillPath = Path.Combine(spillsDir, taskId + ".log")
                        });
                        return;
                    }
                }

                if (action == "stop_background") {
                    string taskId = reqDict.ContainsKey("taskId") ? Convert.ToString(reqDict["taskId"]) : "";
                    lock (_dataLock) {
                        if (_bgProcesses.ContainsKey(taskId)) {
                            try { _bgProcesses[taskId].Kill(); } catch { }
                            _bgProcesses.Remove(taskId);
                        }
                    }
                    RecordAuditLog("stop_background", "", "stop", "local", "allowed", "Task ID: " + taskId);
                    WriteJson(res, 200, new { taskId = taskId, stopped = true });
                    return;
                }

                throw new Exception("Unsupported terminal action: " + action);
            } catch (Exception ex) {
                WriteJson(res, 400, new { error = ex.Message });
            }
        }

        private void HandleAuditLogs(HttpListenerRequest req, HttpListenerResponse res) {
            lock (_dataLock) {
                if (req.HttpMethod == "GET") {
                    var list = new System.Collections.Generic.List<object>();
                    if (File.Exists(_auditLogFile)) {
                        string[] lines = File.ReadAllLines(_auditLogFile, Encoding.UTF8);
                        int count = 0;
                        for (int i = lines.Length - 1; i >= 0 && count < 200; i--) {
                            string trimmed = lines[i].Trim();
                            if (string.IsNullOrEmpty(trimmed)) continue;
                            try {
                                var parsed = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(trimmed);
                                list.Add(parsed);
                                count++;
                            } catch { }
                        }
                    }
                    WriteJson(res, 200, new { entries = list, total = list.Count });
                    return;
                }
                if (req.HttpMethod == "DELETE") {
                    try { if (File.Exists(_auditLogFile)) File.WriteAllText(_auditLogFile, "", Encoding.UTF8); } catch { }
                    WriteJson(res, 200, new { cleared = true });
                    return;
                }
                WriteJson(res, 405, new { error = "Method not allowed" });
            }
        }
        private static string ToolArg(System.Collections.Generic.Dictionary<string, object> args, string key, bool required) {
            object value;
            if (!args.TryGetValue(key, out value)) { if (required) throw new Exception("Missing argument: " + key); return ""; }
            if (!(value is string)) throw new Exception("Argument must be text: " + key);
            return (string)value;
        }
        private void HandleWorkspaceTool(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                if (req.ContentLength64 < 0 || req.ContentLength64 > 2097152) throw new Exception("Request is too large.");
                string body;
                using (var reader = new StreamReader(req.InputStream, Encoding.UTF8)) body = reader.ReadToEnd();
                var request = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(body);
                lock (_toolLock) {
                    if (ToolArg(request, "workspaceId", true) != _workspaceId) throw new Exception("Workspace changed. Send the request again.");
                    if (ToolArg(request, "name", true) != "workspace_files") throw new Exception("Unknown tool.");
                    var args = request["arguments"] as System.Collections.Generic.Dictionary<string, object>;
                    if (args == null) throw new Exception("Invalid arguments.");
                    string action = ToolArg(args, "action", true);
                    string relative = ToolArg(args, "path", action != "undo");
                    if (string.IsNullOrEmpty(relative)) relative = ".";
                    object result;
                    if (action == "undo") {
                        string trashRoot = Path.Combine(_appDataDir, "tool-trash");
                        if (!Directory.Exists(trashRoot)) throw new Exception("No trashed items to restore.");
                        var dirs = new DirectoryInfo(trashRoot).GetDirectories();
                        Array.Sort(dirs, (a, b) => b.LastWriteTimeUtc.CompareTo(a.LastWriteTimeUtc));
                        string restoredRel = null;
                        foreach (var d in dirs) {
                            string metaPath = Path.Combine(d.FullName, "restore.json");
                            if (File.Exists(metaPath)) {
                                var meta = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8));
                                string orig = meta.ContainsKey("original") ? Convert.ToString(meta["original"]) : null;
                                string sav = meta.ContainsKey("saved") ? Convert.ToString(meta["saved"]) : null;
                                if (!string.IsNullOrEmpty(orig) && !string.IsNullOrEmpty(sav) && (File.Exists(sav) || Directory.Exists(sav))) {
                                    Directory.CreateDirectory(Path.GetDirectoryName(orig));
                                    if (Directory.Exists(sav)) Directory.Move(sav, orig); else File.Move(sav, orig);
                                    try { Directory.Delete(d.FullName, true); } catch { }
                                    restoredRel = orig;
                                    break;
                                }
                            }
                        }
                        if (restoredRel == null) throw new Exception("No recoverable item found in tool-trash.");
                        LogEvent("info", "tools", "undo completed");
                        WriteJson(res, 200, new { restored = restoredRel });
                        return;
                    }
                    string target = ToolPath(relative, action == "list" || action == "search", action);
                    if (action == "list") {
                        var entries = new System.Collections.Generic.List<object>();
                        foreach (string entry in Directory.EnumerateFileSystemEntries(target)) {
                            if (entries.Count >= 200) break;
                            var attributes = File.GetAttributes(entry);
                            entries.Add(new { name = Path.GetFileName(entry), directory = (attributes & FileAttributes.Directory) != 0, link = (attributes & FileAttributes.ReparsePoint) != 0 });
                        }
                        result = new { entries = entries, limit = 200 };
                    } else if (action == "read") {
                        if (new FileInfo(target).Length > 1048576) throw new Exception("Read limit is 1 MiB.");
                        result = new { content = File.ReadAllText(target, new UTF8Encoding(false, true)) };
                    } else if (action == "read_range") {
                        if (new FileInfo(target).Length > 2097152) throw new Exception("Read limit is 2 MiB.");
                        string[] lines = File.ReadAllLines(target, new UTF8Encoding(false, true));
                        int sLine = 1, eLine = Math.Min(lines.Length, 100);
                        if (args.ContainsKey("start_line")) int.TryParse(Convert.ToString(args["start_line"]), out sLine);
                        if (args.ContainsKey("end_line")) int.TryParse(Convert.ToString(args["end_line"]), out eLine);
                        sLine = Math.Max(1, sLine);
                        eLine = Math.Min(lines.Length, Math.Max(sLine, eLine));
                        var slice = new System.Collections.Generic.List<string>();
                        for (int idx = sLine - 1; idx < eLine && idx < lines.Length; idx++) slice.Add(lines[idx]);
                        result = new { path = relative, start_line = sLine, end_line = eLine, total_lines = lines.Length, content = string.Join("\n", slice.ToArray()) };
                    } else if (action == "search") {
                        string query = ToolArg(args, "query", true);
                        var matches = new System.Collections.Generic.List<object>();
                        Regex rx = null;
                        try { rx = new Regex(query, RegexOptions.IgnoreCase); } catch { rx = null; }
                        string rootNorm = Path.GetFullPath(_toolWorkspace).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                        foreach (string file in Directory.EnumerateFiles(target, "*", SearchOption.AllDirectories)) {
                            if (matches.Count >= 100) break;
                            if (file.IndexOf("\\.git\\", StringComparison.OrdinalIgnoreCase) >= 0 || file.IndexOf("\\node_modules\\", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                            try {
                                var fi = new FileInfo(file);
                                if (fi.Length > 524288 || (fi.Attributes & FileAttributes.ReparsePoint) != 0) continue;
                                string[] fLines = File.ReadAllLines(file, Encoding.UTF8);
                                string relFile = file.StartsWith(rootNorm, StringComparison.OrdinalIgnoreCase) ? file.Substring(rootNorm.Length).Replace('\\', '/') : Path.GetFileName(file);
                                for (int li = 0; li < fLines.Length; li++) {
                                    string ln = fLines[li];
                                    bool hit = rx != null ? rx.IsMatch(ln) : ln.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
                                    if (hit) {
                                        matches.Add(new { file = relFile, line = li + 1, text = ln.Length > 240 ? ln.Substring(0, 240) : ln });
                                        if (matches.Count >= 100) break;
                                    }
                                }
                            } catch { }
                        }
                        result = new { query = query, count = matches.Count, matches = matches };
                    } else if (action == "create") {
                        string content = ToolArg(args, "content", true);
                        if (Encoding.UTF8.GetByteCount(content) > 1048576) throw new Exception("Write limit is 1 MiB.");
                        using (var stream = new FileStream(target, FileMode.CreateNew, FileAccess.Write))
                        using (var writer = new StreamWriter(stream, new UTF8Encoding(false))) writer.Write(content);
                        result = new { created = relative };
                    } else if (action == "edit" || action == "patch") {
                        if (new FileInfo(target).Length > 1048576) throw new Exception("Edit limit is 1 MiB.");
                        string before = ToolArg(args, "old_text", true), after = ToolArg(args, "new_text", true);
                        string content = File.ReadAllText(target, new UTF8Encoding(false, true));
                        int at = content.IndexOf(before, StringComparison.Ordinal);
                        if (before.Length == 0 || at < 0 || content.IndexOf(before, at + 1, StringComparison.Ordinal) >= 0)
                            throw new Exception("old_text must match exactly once. Read the file first.");
                        string updated = content.Substring(0, at) + after + content.Substring(at + before.Length);
                        if (Encoding.UTF8.GetByteCount(updated) > 1048576) throw new Exception("Edit limit is 1 MiB.");
                        File.WriteAllText(target, updated, new UTF8Encoding(false));
                        result = new { edited = relative };
                    } else if (action == "mkdir") {
                        Directory.CreateDirectory(target); result = new { created = relative };
                    } else if (action == "move") {
                        string destination = ToolArg(args, "destination", true);
                        string dest = ToolPath(destination, false, "move_destination");
                        if (File.Exists(dest) || Directory.Exists(dest)) throw new Exception("Destination already exists.");
                        if (Directory.Exists(target)) Directory.Move(target, dest); else File.Move(target, dest);
                        result = new { moved = relative, destination = destination };
                    } else if (action == "delete") {
                        // Reversible deletion: move to private trash, never recursively erase.
                        string trash = Path.Combine(_appDataDir, "tool-trash", Guid.NewGuid().ToString("N"));
                        Directory.CreateDirectory(trash);
                        string saved = Path.Combine(trash, Path.GetFileName(target));
                        if (Directory.Exists(target)) Directory.Move(target, saved); else File.Move(target, saved);
                        File.WriteAllText(Path.Combine(trash, "restore.json"), new JavaScriptSerializer().Serialize(new { original = target, saved = saved }));
                        result = new { deleted = relative, recoverableAt = saved };
                    } else throw new Exception("Unsupported file action.");
                    LogEvent("info", "tools", action + " completed");
                    WriteJson(res, 200, result);
                }
            } catch (Exception ex) { WriteJson(res, 400, new { error = ex.Message }); }
        }

        private static void WriteJson(HttpListenerResponse res, int status, object value) {
            byte[] bytes = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(value));
            res.StatusCode = status;
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private void HandleListModels(HttpListenerResponse res) {
            EnsureEngineStarted();
            try {
                var request = (HttpWebRequest)WebRequest.Create(EngineBase + "/api/tags");
                request.Proxy = null;
                request.Timeout = 5000;
                using (var response = request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream())) {
                    var data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                    data["online"] = true;
                    WriteJson(res, 200, data);
                }
            } catch (Exception ex) {
                WriteJson(res, 503, new { online = false, models = new object[0], error = "Ollama is unavailable. Start Ollama, then Rescan in the Hub. " + ex.Message });
            }
        }

        private void HandleDownloadOrPull(HttpListenerRequest req, HttpListenerResponse res) {
            ProxyRequest(req, res, EngineBase + "/api/pull");
        }

        // Stream real daemon output, including failures. Binary multipart uploads retain their boundary.
        private void ProxyRequest(HttpListenerRequest req, HttpListenerResponse res, string target) {
            HttpWebRequest upstream = null;
            bool started = false;
            try {
                if (target.StartsWith(EngineBase + "/")) EnsureEngineStarted();
                upstream = (HttpWebRequest)WebRequest.Create(target);
                upstream.Proxy = null;
                upstream.Method = req.HttpMethod;
                upstream.Timeout = 600000;
                upstream.ReadWriteTimeout = 600000;
                if (req.HasEntityBody) {
                    upstream.ContentType = req.ContentType;
                    upstream.ContentLength = req.ContentLength64;
                    using (var body = upstream.GetRequestStream()) req.InputStream.CopyTo(body);
                }
                HttpWebResponse response;
                try { response = (HttpWebResponse)upstream.GetResponse(); }
                catch (WebException ex) {
                    response = ex.Response as HttpWebResponse;
                    if (response == null) throw;
                }
                using (response) {
                    LogEvent((int)response.StatusCode < 400 ? "info" : "error", "engine", req.HttpMethod + " " + req.Url.AbsolutePath + " returned " + (int)response.StatusCode);
                    res.StatusCode = (int)response.StatusCode;
                    res.ContentType = response.ContentType;
                    res.SendChunked = true;
                    res.Headers["Cache-Control"] = "no-store";
                    started = true;
                    using (var input = response.GetResponseStream()) {
                        byte[] buffer = new byte[4096];
                        int count;
                        while ((count = input.Read(buffer, 0, buffer.Length)) > 0) {
                            res.OutputStream.Write(buffer, 0, count);
                            res.OutputStream.Flush();
                        }
                    }
                }
            } catch (Exception ex) {
                if (!started) {
                    LogEvent("error", "engine", ex.Message);
                    try { WriteJson(res, 502, new { error = "Local service unavailable: " + ex.Message }); } catch { }
                }
            } finally {
                if (upstream != null) upstream.Abort();
                try { res.Close(); } catch { }
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
            ProxyRequest(req, res, EngineBase + "/v1/chat/completions");
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
                if (req.HttpMethod == "DELETE") {
                    File.WriteAllText(_settingsFile, "{}", Encoding.UTF8);
                    WriteJson(res, 200, new { status = "reset_all" });
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private void HandleMemory(HttpListenerRequest req, HttpListenerResponse res) {
            string memFile = Path.Combine(_appDataDir, "memory.json");
            lock (_dataLock) {
                if (req.HttpMethod == "GET") {
                    string data = File.Exists(memFile) ? File.ReadAllText(memFile, Encoding.UTF8) : "{\"enabled\":true,\"facts\":[],\"episodes\":[]}";
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
                        string tmp = memFile + ".tmp";
                        File.WriteAllText(tmp, body, Encoding.UTF8);
                        if (File.Exists(memFile)) File.Delete(memFile);
                        File.Move(tmp, memFile);
                    }
                    WriteJson(res, 200, new { status = "saved" });
                    return;
                }
                if (req.HttpMethod == "DELETE") {
                    if (File.Exists(memFile)) File.Delete(memFile);
                    WriteJson(res, 200, new { status = "cleared" });
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private void HandleMcp(HttpListenerRequest req, HttpListenerResponse res) {
            string mcpFile = Path.Combine(_appDataDir, "mcp_servers.json");
            lock (_dataLock) {
                if (req.HttpMethod == "GET") {
                    object servers = null;
                    if (File.Exists(mcpFile)) {
                        try { servers = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(mcpFile, Encoding.UTF8)); } catch { }
                    }
                    WriteJson(res, 200, new { servers = servers, plugins = new object[0] });
                    return;
                }
                if (req.HttpMethod == "POST") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        string tmp = mcpFile + ".tmp";
                        File.WriteAllText(tmp, body, Encoding.UTF8);
                        if (File.Exists(mcpFile)) File.Delete(mcpFile);
                        File.Move(tmp, mcpFile);
                    }
                    WriteJson(res, 200, new { status = "saved" });
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private static void WipeAppData(bool deleteModels, bool deleteWorkspace) {
            lock (_dataLock) {
                lock (_toolLock) {
                    _cachedThreads = "[]";
                    string[] files = new string[] {
                        _settingsFile, _threadsFile, _profilesFile, _downloadLedgerFile,
                        _windowStateFile, Path.Combine(_appDataDir, "memory.json"),
                        Path.Combine(_appDataDir, "mcp_servers.json"),
                        Path.Combine(_appDataDir, "tool_workspace.txt")
                    };
                    foreach (string f in files) {
                        try { if (!string.IsNullOrEmpty(f) && File.Exists(f)) File.Delete(f); } catch { }
                    }
                    string[] dirs = new string[] {
                        Path.Combine(_appDataDir, "logs"),
                        Path.Combine(_appDataDir, "tool-trash"),
                        deleteWorkspace ? Path.Combine(_appDataDir, "workspace") : null,
                        deleteModels ? _modelsDir : null
                    };
                    foreach (string d in dirs) {
                        try { if (!string.IsNullOrEmpty(d) && Directory.Exists(d)) Directory.Delete(d, true); } catch { }
                    }
                    _toolWorkspace = Path.Combine(_appDataDir, "workspace");
                    _workspaceId = Guid.NewGuid().ToString("N");
                    try {
                        Directory.CreateDirectory(_toolWorkspace);
                        Directory.CreateDirectory(_modelsDir);
                        File.WriteAllText(_profilesFile, "[]", Encoding.UTF8);
                        File.WriteAllText(_threadsFile, "[]", Encoding.UTF8);
                        File.WriteAllText(_settingsFile, "{}", Encoding.UTF8);
                        File.WriteAllText(_downloadLedgerFile, "[]", Encoding.UTF8);
                    } catch { }
                }
            }
        }

        private void HandleReset(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string body = "";
                using (var r = new StreamReader(req.InputStream, Encoding.UTF8)) body = r.ReadToEnd();
                bool deleteModels = Regex.IsMatch(body, "\"deleteModels\"\\s*:\\s*true", RegexOptions.IgnoreCase);
                bool deleteWorkspace = !Regex.IsMatch(body, "\"deleteWorkspace\"\\s*:\\s*false", RegexOptions.IgnoreCase);
                WipeAppData(deleteModels, deleteWorkspace);
                if (!IsDisposed && IsHandleCreated) {
                    try {
                        BeginInvoke((Action)(() => {
                            try { if (_wvCore != null && _wvCore.Profile != null) _wvCore.Profile.ClearBrowsingDataAsync(); } catch { }
                        }));
                    } catch { }
                }
                LogEvent("info", "reset", "Sanctum factory reset completed");
                WriteJson(res, 200, new { status = "reset_complete", deletedModels = deleteModels, deletedWorkspace = deleteWorkspace });
            } catch (Exception ex) {
                WriteJson(res, 500, new { error = ex.Message });
            }
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
            r"C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Speech\v4.0_4.0.0.0__31bf3856ad364e35\System.Speech.dll",
            "System.Web.Extensions.dll",
            "System.Management.dll",
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
        cmd.append(os.path.abspath("tools/native/DesktopServices.cs"))
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
