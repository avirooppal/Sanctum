using System;
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

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern uint GetLongPathNameW(string lpszShortPath, StringBuilder lpszLongPath, uint cchBuffer);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern SafeFileHandle CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern uint GetFinalPathNameByHandleW(SafeFileHandle hFile, StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);

        private const uint FILE_SHARE_ALL = 0x00000007;
        private const uint OPEN_EXISTING = 3;
        private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;

        private static string ResolveRealExistingPath(string existingPath) {
            using (SafeFileHandle handle = CreateFileW(existingPath, 0, FILE_SHARE_ALL, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero)) {
                if (!handle.IsInvalid) {
                    var sb = new StringBuilder(32768);
                    uint len = GetFinalPathNameByHandleW(handle, sb, (uint)sb.Capacity, 0);
                    if (len > 0 && len < sb.Capacity) {
                        string finalPath = sb.ToString();
                        if (finalPath.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) {
                            throw new Exception("UNC network paths are not allowed.");
                        }
                        if (finalPath.StartsWith(@"\\?\", StringComparison.Ordinal)) {
                            finalPath = finalPath.Substring(4);
                        }
                        return Path.GetFullPath(finalPath);
                    }
                }
            }
            var longSb = new StringBuilder(32768);
            uint longLen = GetLongPathNameW(existingPath, longSb, (uint)longSb.Capacity);
            if (longLen > 0 && longLen < longSb.Capacity) {
                return Path.GetFullPath(longSb.ToString());
            }
            return Path.GetFullPath(existingPath);
        }

        private static string ResolveCanonicalRealPath(string rawFullPath) {
            string cur = Path.GetFullPath(rawFullPath);
            if (File.Exists(cur) || Directory.Exists(cur)) {
                return ResolveRealExistingPath(cur);
            }
            var trailing = new Stack<string>();
            while (!string.IsNullOrEmpty(cur) && !File.Exists(cur) && !Directory.Exists(cur)) {
                string name = Path.GetFileName(cur);
                string parent = Path.GetDirectoryName(cur);
                if (string.IsNullOrEmpty(parent) || parent == cur) break;
                if (!string.IsNullOrEmpty(name)) trailing.Push(name);
                cur = parent;
            }
            string resolved = (!string.IsNullOrEmpty(cur) && (File.Exists(cur) || Directory.Exists(cur)))
                ? ResolveRealExistingPath(cur)
                : Path.GetFullPath(rawFullPath);
            while (trailing.Count > 0) {
                resolved = Path.Combine(resolved, trailing.Pop());
            }
            return Path.GetFullPath(resolved);
        }

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
        private class ApprovalTokenEntry {
            public string Tool;
            public DateTime ExpiresAtUtc;
        }
        private static readonly Dictionary<string, ApprovalTokenEntry> _approvalTokens = new Dictionary<string, ApprovalTokenEntry>();
        private static readonly object _approvalLock = new object();

        private static string MintApprovalToken(string toolName, string explicitToken = null) {
            string token = explicitToken;
            if (string.IsNullOrEmpty(token)) {
                byte[] bytes = new byte[16];
                using (var rng = new RNGCryptoServiceProvider()) rng.GetBytes(bytes);
                token = BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
            }
            lock (_approvalLock) {
                DateTime now = DateTime.UtcNow;
                var expired = new List<string>();
                foreach (var kv in _approvalTokens) {
                    if (kv.Value.ExpiresAtUtc <= now) expired.Add(kv.Key);
                }
                foreach (string k in expired) _approvalTokens.Remove(k);
                _approvalTokens[token] = new ApprovalTokenEntry {
                    Tool = toolName ?? "*",
                    ExpiresAtUtc = now.AddSeconds(120)
                };
            }
            return token;
        }

        private static bool ConsumeApprovalToken(string token, string expectedTool) {
            if (string.IsNullOrEmpty(token)) return false;
            lock (_approvalLock) {
                ApprovalTokenEntry entry;
                if (!_approvalTokens.TryGetValue(token, out entry)) return false;
                _approvalTokens.Remove(token);
                if (entry.ExpiresAtUtc <= DateTime.UtcNow) return false;
                return entry.Tool == "*" || string.Equals(entry.Tool, expectedTool, StringComparison.OrdinalIgnoreCase);
            }
        }

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
            bool printToken = false;
            var seedApprovalTokens = new List<string>();

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
                } else if (args[i] == "--print-token") {
                    printToken = true;
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
                } else if (args[i] == "--seed-approval-token" && i + 1 < args.Length) {
                    seedApprovalTokens.Add(args[++i]);
                }
            }

            if (headless && seedApprovalTokens.Count > 0) {
                foreach (string sat in seedApprovalTokens) {
                    if (!string.IsNullOrEmpty(sat)) MintApprovalToken("*", sat);
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
                Console.WriteLine("Sanctum running in headless mode on http://127.0.0.1:" + app._port + (printToken ? " with auth token " + _authToken : ""));
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
                _wvCore.AddWebResourceRequestedFilter("ws://*", CoreWebView2WebResourceContext.All);
                _wvCore.AddWebResourceRequestedFilter("wss://*", CoreWebView2WebResourceContext.All);
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
                PtyPost(new { type = "ptyStarted", gen = gen });
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
                            string candidate = ResolveCanonicalRealPath(dlg.SelectedPath);
                            if (IsHardBlocked(candidate)) {
                                MessageBox.Show(this, "That folder cannot be used as a workspace because it is a protected system or Sanctum internal directory.", "Restricted Folder", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                                return;
                            }
                            lock (_toolLock) {
                                _toolWorkspace = candidate;
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
                } else if (raw.Contains("\"requestApprovalToken\"")) {
                    var payload = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
                    string reqId = payload != null && payload.ContainsKey("requestId") ? Convert.ToString(payload["requestId"]) : "";
                    string toolName = payload != null && payload.ContainsKey("toolName") ? Convert.ToString(payload["toolName"]) : "*";
                    string tok = MintApprovalToken(toolName);
                    string resp = new JavaScriptSerializer().Serialize(new { type = "approvalTokenIssued", requestId = reqId, token = tok });
                    if (_wvCore != null) _wvCore.PostWebMessageAsJson(resp);
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

                // Allow direct loopback only to our host API (_port), local inference engine (_enginePort), and speech server (8000)
                if ((uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                     uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) &&
                    (uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) || uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)) &&
                    (uri.Port == _port || uri.Port == _enginePort || uri.Port == 8000)) {
                    return; // Pass through to local daemon
                }

                if (!uri.Host.Equals("sanctum.app", StringComparison.OrdinalIgnoreCase)) {
                    e.Response = _wvEnv.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes("Blocked External Egress")), 403, "Forbidden", "Content-Type: text/plain");
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
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Sanctum-Auth, X-Sanctum-Approval, Range");
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
            if (path == "/api/workspace" && method == "POST") {
                if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "workspace_change")) {
                    WriteJson(res, 403, new { error = "User approval token required to change workspace." });
                    return;
                }
                try {
                    string body = ReadRequestBodyUtf8(req, 65536);
                    var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body);
                    string nextRoot = payload != null && payload.ContainsKey("root") ? Convert.ToString(payload["root"]).Trim() : "";
                    if (string.IsNullOrEmpty(nextRoot)) {
                        WriteJson(res, 400, new { error = "Missing root path" });
                        return;
                    }
                    if (nextRoot.IndexOf('\0') >= 0 || nextRoot.StartsWith("\\\\") || nextRoot.StartsWith("//")) {
                        WriteJson(res, 403, new { error = "Invalid or UNC workspace path." });
                        return;
                    }
                    if (!Directory.Exists(nextRoot)) {
                        WriteJson(res, 400, new { error = "Workspace directory does not exist." });
                        return;
                    }
                    string curCheck = Path.GetFullPath(nextRoot);
                    while (!string.IsNullOrEmpty(curCheck)) {
                        if (Directory.Exists(curCheck) && (File.GetAttributes(curCheck) & FileAttributes.ReparsePoint) != 0) {
                            WriteJson(res, 403, new { error = "Symbolic links and junctions are not allowed as workspace root." });
                            return;
                        }
                        curCheck = Path.GetDirectoryName(curCheck);
                    }
                    string resolved = ResolveCanonicalRealPath(nextRoot);
                    if (IsHardBlocked(resolved)) {
                        WriteJson(res, 403, new { error = "Protected system or Sanctum internal directory cannot be used as workspace." });
                        return;
                    }
                    lock (_toolLock) {
                        _toolWorkspace = resolved;
                        _workspaceId = Guid.NewGuid().ToString("N");
                        EnqueueAtomicWrite(Path.Combine(_appDataDir, "tool_workspace.txt"), _toolWorkspace);
                        WriteJson(res, 200, new { root = _toolWorkspace, id = _workspaceId });
                    }
                } catch (Exception ex) {
                    WriteJson(res, 400, new { error = ex.Message });
                }
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
            string resolved = ResolveCanonicalRealPath(canonicalPath);
            string lower = resolved.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string home = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string appData = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string localAppData = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string windir = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.Windows)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string progFiles = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string progFilesX86 = ResolveCanonicalRealPath(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();

            string defaultSanctumDir = Path.Combine(appData, "sanctum");
            string activeDataDir = !string.IsNullOrEmpty(_appDataDir)
                ? ResolveCanonicalRealPath(_appDataDir).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant()
                : defaultSanctumDir;

            string[] sanctumDirs = new string[] { defaultSanctumDir, activeDataDir };
            foreach (string sDir in sanctumDirs) {
                if (string.IsNullOrEmpty(sDir)) continue;
                string safeWs = Path.Combine(sDir, "workspace");
                bool insideSafeWs = lower == safeWs || lower.StartsWith(safeWs + Path.DirectorySeparatorChar);
                if (!insideSafeWs && (lower == sDir || lower.StartsWith(sDir + Path.DirectorySeparatorChar))) {
                    return true;
                }
            }

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
                Path.Combine(localAppData, "bravesoftware").ToLowerInvariant()
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

            string root = ResolveCanonicalRealPath(_toolWorkspace).TrimEnd(Path.DirectorySeparatorChar);
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

            full = ResolveCanonicalRealPath(full);

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
                    string cf = ResolveCanonicalRealPath(f).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
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

        private static bool EvaluateCommandRule(string command, out string action, out string reason) {
            string trimmed = (command ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed)) {
                action = "deny";
                reason = "Empty command string.";
                return false;
            }

            string[] denyPatterns = new string[] {
                @".*(format\s+[a-zA-Z]:|diskpart|bcdedit|vssadmin|mkfs).*",
                @".*(rmdir\s+/[sS]\s+/[qQ]\s+[c-zC-Z]:\\|del\s+/[fF]\s+/[sS]\s+/[qQ]\s+[c-zC-Z]:\\).*",
                @".*(rm\s+-(rf|fr|r)\s+(/|/\*|[a-zA-Z]:\\)).*",
                @".*Remove-Item\s+.*([a-zA-Z]:\\).*",
                @".*(:\(\)\s*\{.*:\|:&|:\|:&).*"
            };
            foreach (string pat in denyPatterns) {
                if (Regex.IsMatch(trimmed, pat, RegexOptions.IgnoreCase)) {
                    action = "deny";
                    reason = "Command blocked by security policy: " + pat;
                    return false;
                }
            }

            bool hasChaining = trimmed.IndexOf("&&", StringComparison.Ordinal) >= 0 ||
                trimmed.IndexOf("||", StringComparison.Ordinal) >= 0 ||
                trimmed.IndexOf(';') >= 0 ||
                trimmed.IndexOf('|') >= 0 ||
                trimmed.IndexOf('`') >= 0 ||
                trimmed.IndexOf("$(", StringComparison.Ordinal) >= 0 ||
                trimmed.IndexOf('>') >= 0;

            if (!hasChaining) {
                string[] allowPatterns = new string[] {
                    @"^git\s+(status|diff|log|branch|show|rev-parse|tag|remote|describe)(\s+.*)?$",
                    @"^(dir|ls|pwd|echo|type|cat|head|tail|where|which)(\s+.*)?$",
                    @"^(node\s+-v|npm\s+-v|python\s+--version|git\s+--version|tsc\s+-v|dotnet\s+--version|cargo\s+--version|rustc\s+--version|go\s+version)(\s+.*)?$"
                };
                foreach (string pat in allowPatterns) {
                    if (Regex.IsMatch(trimmed, pat, RegexOptions.IgnoreCase)) {
                        action = "allow";
                        reason = "Command matches pre-approved read-only pattern.";
                        return true;
                    }
                }
            }

            action = "ask";
            reason = "Standard command execution requires user approval.";
            return false;
        }

        private static bool IsExecutionPolicyBypassEnabled() {
            try {
                if (File.Exists(_settingsFile)) {
                    var sDict = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(File.ReadAllText(_settingsFile, Encoding.UTF8));
                    if (sDict != null && sDict.ContainsKey("terminal.allowExecutionPolicyBypass") && sDict["terminal.allowExecutionPolicyBypass"] != null) {
                        return Convert.ToBoolean(sDict["terminal.allowExecutionPolicyBypass"]);
                    }
                }
            } catch { }
            return false;
        }

        private static void BuildShellProcessArgs(string shell, string command, out string execFile, out string execArgs) {
            if (shell == "cmd") {
                execFile = "cmd.exe";
                execArgs = "/d /s /c \"" + command + "\"";
            } else if (shell == "wsl") {
                execFile = "wsl.exe";
                execArgs = "-e bash -c \"" + command.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
            } else {
                execFile = "powershell.exe";
                string b64 = Convert.ToBase64String(Encoding.Unicode.GetBytes(command));
                string bypass = IsExecutionPolicyBypassEnabled() ? "-ExecutionPolicy Bypass " : "";
                execArgs = "-NoProfile -NonInteractive " + bypass + "-EncodedCommand " + b64;
            }
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
                string rawCwd = reqDict.ContainsKey("cwd") && !string.IsNullOrEmpty(Convert.ToString(reqDict["cwd"])) ? Convert.ToString(reqDict["cwd"]) : ".";
                string shell = reqDict.ContainsKey("shell") ? Convert.ToString(reqDict["shell"]).ToLowerInvariant() : "powershell";
                int timeoutMs = reqDict.ContainsKey("timeoutMs") ? Convert.ToInt32(reqDict["timeoutMs"]) : 30000;
                int maxOutputChars = reqDict.ContainsKey("maxOutputChars") ? Convert.ToInt32(reqDict["maxOutputChars"]) : 20000;

                string spillsDir = Path.Combine(_appDataDir, "spills");
                if (!Directory.Exists(spillsDir)) Directory.CreateDirectory(spillsDir);

                if (action == "run_command") {
                    if (string.IsNullOrEmpty(command.Trim())) throw new Exception("Command cannot be empty.");

                    string cwd;
                    try {
                        cwd = ToolPath(rawCwd, true, "terminal_cwd");
                    } catch (Exception ex) {
                        RecordAuditLog("run_command", rawCwd, command, "terminal", "denied", ex.Message);
                        WriteJson(res, 403, new { error = ex.Message });
                        return;
                    }
                    if (!Directory.Exists(cwd)) {
                        WriteJson(res, 400, new { error = "Working directory does not exist: " + cwd });
                        return;
                    }

                    string ruleAction, ruleReason;
                    EvaluateCommandRule(command, out ruleAction, out ruleReason);
                    if (ruleAction == "deny") {
                        RecordAuditLog("run_command", cwd, command, "terminal", "denied", ruleReason);
                        WriteJson(res, 403, new { error = ruleReason });
                        return;
                    }
                    if (ruleAction == "ask") {
                        string approvalToken = req.Headers["X-Sanctum-Approval"];
                        if (!ConsumeApprovalToken(approvalToken, "run_command")) {
                            RecordAuditLog("run_command", cwd, command, "terminal", "denied", "Missing or invalid single-use approval token.");
                            WriteJson(res, 403, new { error = "User approval token required for non-allowlisted command." });
                            return;
                        }
                    }

                    string execFile, execArgs;
                    BuildShellProcessArgs(shell, command, out execFile, out execArgs);

                    var psi = new ProcessStartInfo {
                        FileName = execFile,
                        Arguments = execArgs,
                        WorkingDirectory = cwd,
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

                    string cwd;
                    try {
                        cwd = ToolPath(rawCwd, true, "terminal_cwd");
                    } catch (Exception ex) {
                        RecordAuditLog("start_background", rawCwd, command, "terminal", "denied", ex.Message);
                        WriteJson(res, 403, new { error = ex.Message });
                        return;
                    }
                    if (!Directory.Exists(cwd)) {
                        WriteJson(res, 400, new { error = "Working directory does not exist: " + cwd });
                        return;
                    }

                    string ruleAction, ruleReason;
                    EvaluateCommandRule(command, out ruleAction, out ruleReason);
                    if (ruleAction == "deny") {
                        RecordAuditLog("start_background", cwd, command, "terminal", "denied", ruleReason);
                        WriteJson(res, 403, new { error = ruleReason });
                        return;
                    }
                    if (ruleAction == "ask") {
                        string approvalToken = req.Headers["X-Sanctum-Approval"];
                        if (!ConsumeApprovalToken(approvalToken, "start_background")) {
                            RecordAuditLog("start_background", cwd, command, "terminal", "denied", "Missing or invalid single-use approval token.");
                            WriteJson(res, 403, new { error = "User approval token required for background command." });
                            return;
                        }
                    }

                    string taskId = "bg-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 5);

                    string execFile, execArgs;
                    BuildShellProcessArgs(shell, command, out execFile, out execArgs);

                    var psi = new ProcessStartInfo {
                        FileName = execFile,
                        Arguments = execArgs,
                        WorkingDirectory = cwd,
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
        private static void CopyDirectoryRecursive(string srcDir, string dstDir) {
            Directory.CreateDirectory(dstDir);
            foreach (string file in Directory.GetFiles(srcDir)) {
                File.Copy(file, Path.Combine(dstDir, Path.GetFileName(file)), false);
            }
            foreach (string sub in Directory.GetDirectories(srcDir)) {
                CopyDirectoryRecursive(sub, Path.Combine(dstDir, Path.GetFileName(sub)));
            }
        }

        private static void MovePathSafe(string src, string dst) {
            try {
                if (Directory.Exists(src)) Directory.Move(src, dst);
                else File.Move(src, dst);
            } catch (IOException) {
                if (Directory.Exists(src)) {
                    CopyDirectoryRecursive(src, dst);
                    Directory.Delete(src, true);
                } else {
                    File.Copy(src, dst, false);
                    File.Delete(src);
                }
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

                    string expectedApprovalTool = null;
                    if (action == "create") expectedApprovalTool = "create_file";
                    else if (action == "edit") expectedApprovalTool = "edit_file";
                    else if (action == "patch") expectedApprovalTool = "apply_patch";
                    else if (action == "mkdir") expectedApprovalTool = "create_directory";
                    else if (action == "move") expectedApprovalTool = "move_path";
                    else if (action == "delete") expectedApprovalTool = "delete_path";
                    else if (action == "undo") expectedApprovalTool = "undo_last_action";

                    if (expectedApprovalTool != null) {
                        string approvalToken = req.Headers["X-Sanctum-Approval"];
                        if (!ConsumeApprovalToken(approvalToken, expectedApprovalTool)) {
                            RecordAuditLog("workspace_files", relative, action, "approval", "denied", "Missing or invalid single-use approval token.");
                            WriteJson(res, 403, new { error = "User approval token required for mutating workspace operation." });
                            return;
                        }
                    }

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
                                    string rootCheck = ResolveCanonicalRealPath(_toolWorkspace).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                                    string origResolved = ResolveCanonicalRealPath(orig);
                                    string checkArg = origResolved.StartsWith(rootCheck, StringComparison.OrdinalIgnoreCase)
                                        ? origResolved.Substring(rootCheck.Length)
                                        : origResolved;
                                    string validatedOrig = ToolPath(checkArg, false, "create");
                                    Directory.CreateDirectory(Path.GetDirectoryName(validatedOrig));
                                    MovePathSafe(sav, validatedOrig);
                                    try { Directory.Delete(d.FullName, true); } catch { }
                                    restoredRel = validatedOrig;
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
                        MovePathSafe(target, dest);
                        result = new { moved = relative, destination = destination };
                    } else if (action == "delete") {
                        // Reversible deletion: move to private trash, never recursively erase.
                        string trash = Path.Combine(_appDataDir, "tool-trash", Guid.NewGuid().ToString("N"));
                        Directory.CreateDirectory(trash);
                        string saved = Path.Combine(trash, Path.GetFileName(target));
                        MovePathSafe(target, saved);
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
                    var serializer = new JavaScriptSerializer();
                    var entries = new List<object>();
                    if (File.Exists(_downloadLedgerFile)) {
                        try {
                            var existing = serializer.Deserialize<List<object>>(File.ReadAllText(_downloadLedgerFile, Encoding.UTF8));
                            if (existing != null) entries = existing;
                        } catch { }
                    }
                    entries.Add(new { timestamp = DateTime.UtcNow.ToString("o"), model = name ?? "", url = url ?? "", status = "verified" });
                    EnqueueAtomicWrite(_downloadLedgerFile, serializer.Serialize(entries));
                } catch { }
            }
        }

        private void HandleChatCompletions(HttpListenerRequest req, HttpListenerResponse res) {
            ProxyRequest(req, res, EngineBase + "/v1/chat/completions");
        }

        private void HandleProfiles(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                var serializer = new JavaScriptSerializer();
                string method = req.HttpMethod.ToUpperInvariant();
                if (method == "GET") {
                    object data = new object[0];
                    lock (_dataLock) {
                        if (File.Exists(_profilesFile)) {
                            try {
                                var parsed = serializer.DeserializeObject(File.ReadAllText(_profilesFile, Encoding.UTF8));
                                if (parsed != null) data = parsed;
                            } catch { }
                        }
                    }
                    WriteJson(res, 200, new { data = data });
                    return;
                }

                if (method == "POST") {
                    string body = ReadRequestBodyUtf8(req, 1048576);
                    var payload = serializer.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
                    string profId = payload.ContainsKey("id") && !string.IsNullOrEmpty(Convert.ToString(payload["id"]))
                        ? Convert.ToString(payload["id"])
                        : "prof-" + (DateTime.UtcNow.Ticks / 10000);
                    string profName = payload.ContainsKey("name") && payload["name"] != null
                        ? Convert.ToString(payload["name"])
                        : "Assistant";

                    var newEntry = new Dictionary<string, object> {
                        { "id", profId },
                        { "name", profName },
                        { "scope", "user" },
                        { "updated_at", DateTime.UtcNow.Ticks / 10000000 }
                    };

                    lock (_dataLock) {
                        var list = new List<object>();
                        if (File.Exists(_profilesFile)) {
                            try {
                                var existing = serializer.Deserialize<List<object>>(File.ReadAllText(_profilesFile, Encoding.UTF8));
                                if (existing != null) list = existing;
                            } catch { }
                        }
                        list.Add(newEntry);
                        EnqueueAtomicWrite(_profilesFile, serializer.Serialize(list));
                    }

                    WriteJson(res, 200, new { id = profId });
                    return;
                }
                res.StatusCode = 405;
                res.Close();
            } catch (Exception ex) {
                LogEvent("error", "profiles", ex.Message);
                WriteJson(res, 500, new { error = ex.Message });
            }
        }

        private static string _cachedThreads = null;
        private void HandleThreads(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                if (req.HttpMethod == "GET") {
                    string data;
                    lock (_dataLock) {
                        data = _cachedThreads ?? (File.Exists(_threadsFile) ? File.ReadAllText(_threadsFile, Encoding.UTF8) : "[]");
                    }
                    byte[] bytes = Encoding.UTF8.GetBytes(data);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }
                if (req.HttpMethod == "POST") {
                    string body = ReadRequestBodyUtf8(req);
                    EnqueueAtomicWrite(_threadsFile, body);
                    lock (_dataLock) {
                        _cachedThreads = body;
                    }
                    WriteJson(res, 200, new { status = "saved" });
                    return;
                }
                res.StatusCode = 405;
                res.Close();
            } catch (Exception ex) {
                if (ex.Message == "PAYLOAD_TOO_LARGE") {
                    WriteJson(res, 413, new { error = "Request payload exceeds 16 MiB limit." });
                } else {
                    LogEvent("error", "threads", ex.Message);
                    WriteJson(res, 500, new { error = ex.Message });
                }
            }
        }

        private static readonly HashSet<string> _knownSettingKeys = new HashSet<string>(StringComparer.Ordinal) {
            "general.language", "general.autoUpdateCheck", "general.spellCheck", "general.dataFolder",
            "appearance.theme", "appearance.fontSize", "appearance.showTokenSpeed", "appearance.coloredUserBubble",
            "assistants.defaultModel", "assistants.systemPrompt", "assistants.temperature", "assistants.topP",
            "assistants.maxTokens", "assistants.sttMode", "assistants.sttModel", "assistants.sttEndpoint",
            "attachments.enable", "attachments.maxFileSizeMB", "attachments.chunkSize", "attachments.chunkOverlap", "attachments.topK",
            "localApi.enable", "localApi.host", "localApi.port", "localApi.apiKeyRequired", "localApi.corsEnabled",
            "httpsProxy.enable", "httpsProxy.url", "httpsProxy.bypass",
            "webSearch.enable", "webSearch.provider", "webSearch.endpoint",
            "shortcuts.newChat", "shortcuts.newProject", "shortcuts.search",
            "hardware.cpuThreads", "hardware.gpuLayers", "hardware.contextLength",
            "access.scope", "access.allowedFolders", "access.overrideHardBlocked",
            "terminal.shell", "terminal.timeoutMs", "terminal.maxOutputChars", "terminal.rules", "terminal.allowExecutionPolicyBypass",
            "agent.mode", "agent.requireHunkApproval", "agent.enableCheckpoints", "agent.postEditHook", "agent.runPostEditHook",
            "privacy.diagnosticOptIn", "privacy.strictConsentPrompt",
            "developer.inspectRequests", "developer.traceContentCapture", "developer.traceRetention"
        };

        private static void ValidateSetting(string key, object val) {
            if (!_knownSettingKeys.Contains(key)) {
                throw new Exception("Unknown setting key: " + key);
            }
            if (key == "access.scope") {
                string s = Convert.ToString(val);
                if (s != "workspace_only" && s != "selected_folders" && s != "system_read" && s != "system_full") {
                    throw new Exception("Invalid access.scope value: " + s);
                }
            }
        }

        private static string ReadRequestBodyUtf8(HttpListenerRequest req, int maxBytes = 16777216) {
            if (req.ContentLength64 > maxBytes) {
                throw new InvalidOperationException("PAYLOAD_TOO_LARGE");
            }
            using (var ms = new MemoryStream()) {
                byte[] buf = new byte[8192];
                int read;
                long total = 0;
                while ((read = req.InputStream.Read(buf, 0, buf.Length)) > 0) {
                    total += read;
                    if (total > maxBytes) throw new InvalidOperationException("PAYLOAD_TOO_LARGE");
                    ms.Write(buf, 0, read);
                }
                return Encoding.UTF8.GetString(ms.ToArray());
            }
        }

        private static readonly Queue<Action> _writeQueue = new Queue<Action>();
        private static readonly object _writeQueueLock = new object();
        private static Thread _writeThread;

        private static void EnsureWriteWorker() {
            lock (_writeQueueLock) {
                if (_writeThread != null && _writeThread.IsAlive) return;
                _writeThread = new Thread(() => {
                    while (true) {
                        Action job = null;
                        lock (_writeQueueLock) {
                            while (_writeQueue.Count == 0) Monitor.Wait(_writeQueueLock);
                            job = _writeQueue.Dequeue();
                        }
                        try { job(); } catch { }
                    }
                }) { IsBackground = true, Name = "SanctumSingleWriter" };
                _writeThread.Start();
            }
        }

        private static void EnqueueAtomicWrite(string targetPath, string content) {
            EnsureWriteWorker();
            Exception writeErr = null;
            using (var done = new ManualResetEventSlim(false)) {
                lock (_writeQueueLock) {
                    _writeQueue.Enqueue(() => {
                        try {
                            WriteAtomicText(targetPath, content);
                        } catch (Exception ex) {
                            writeErr = ex;
                        } finally {
                            done.Set();
                        }
                    });
                    Monitor.Pulse(_writeQueueLock);
                }
                done.Wait();
            }
            if (writeErr != null) {
                LogEvent("error", "persistence", "Write failed for " + targetPath + ": " + writeErr.Message);
                throw writeErr;
            }
        }

        private static void WriteAtomicText(string targetPath, string content) {
            string dir = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
            string tempFile = targetPath + ".tmp";
            File.WriteAllText(tempFile, content, new UTF8Encoding(false));
            if (File.Exists(targetPath)) {
                File.Replace(tempFile, targetPath, targetPath + ".bak", true);
            } else {
                File.Move(tempFile, targetPath);
            }
        }

        private void HandleSettings(HttpListenerRequest req, HttpListenerResponse res) {
            lock (_dataLock) {
                var serializer = new JavaScriptSerializer();
                var current = new Dictionary<string, object>();
                if (File.Exists(_settingsFile)) {
                    try {
                        var parsed = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(_settingsFile, Encoding.UTF8));
                        if (parsed != null) current = parsed;
                    } catch { current = new Dictionary<string, object>(); }
                }

                if (req.HttpMethod == "GET") {
                    string key = req.QueryString["key"];
                    if (!string.IsNullOrEmpty(key)) {
                        object val = current.ContainsKey(key) ? current[key] : null;
                        WriteJson(res, 200, new { key = key, value = val });
                        return;
                    }
                    WriteJson(res, 200, new { status = "success", settings = current });
                    return;
                }
                if (req.HttpMethod == "POST") {
                    if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "settings_write")) {
                        WriteJson(res, 403, new { error = "User approval token required to modify settings." });
                        return;
                    }
                    try {
                        string body;
                        using (var r = new StreamReader(req.InputStream, Encoding.UTF8)) body = r.ReadToEnd();
                        var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                        if (payload == null) throw new Exception("Invalid settings JSON.");

                        if (payload.ContainsKey("key") && payload.ContainsKey("value")) {
                            string k = Convert.ToString(payload["key"]);
                            object v = payload["value"];
                            ValidateSetting(k, v);
                            current[k] = v;
                        } else {
                            foreach (var kv in payload) {
                                if (kv.Key.StartsWith("_")) continue;
                                ValidateSetting(kv.Key, kv.Value);
                                current[kv.Key] = kv.Value;
                            }
                        }
                        current["_version"] = 2;
                        current["_updatedAt"] = DateTime.UtcNow.ToString("o");
                        WriteAtomicText(_settingsFile, serializer.Serialize(current));
                        WriteJson(res, 200, new { status = "updated" });
                        return;
                    } catch (Exception ex) {
                        WriteJson(res, 422, new { error = ex.Message });
                        return;
                    }
                }
                if (req.HttpMethod == "DELETE") {
                    if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "settings_write")) {
                        WriteJson(res, 403, new { error = "User approval token required to reset settings." });
                        return;
                    }
                    string key = req.QueryString["key"];
                    if (!string.IsNullOrEmpty(key)) {
                        current.Remove(key);
                        WriteAtomicText(_settingsFile, serializer.Serialize(current));
                        WriteJson(res, 200, new { status = "reset", key = key });
                        return;
                    }
                    WriteAtomicText(_settingsFile, "{}");
                    WriteJson(res, 200, new { status = "reset_all" });
                    return;
                }
            }
            res.StatusCode = 405;
            res.Close();
        }

        private void HandleMemory(HttpListenerRequest req, HttpListenerResponse res) {
            string memFile = Path.Combine(_appDataDir, "memory.json");
            try {
                if (req.HttpMethod == "GET") {
                    string data;
                    lock (_dataLock) {
                        data = File.Exists(memFile) ? File.ReadAllText(memFile, Encoding.UTF8) : "{\"enabled\":true,\"facts\":[],\"episodes\":[]}";
                    }
                    byte[] bytes = Encoding.UTF8.GetBytes(data);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }
                if (req.HttpMethod == "POST") {
                    string body = ReadRequestBodyUtf8(req);
                    EnqueueAtomicWrite(memFile, body);
                    WriteJson(res, 200, new { status = "saved" });
                    return;
                }
                if (req.HttpMethod == "DELETE") {
                    EnqueueAtomicWrite(memFile, "{\"enabled\":true,\"facts\":[],\"episodes\":[]}");
                    WriteJson(res, 200, new { status = "cleared" });
                    return;
                }
                res.StatusCode = 405;
                res.Close();
            } catch (Exception ex) {
                if (ex.Message == "PAYLOAD_TOO_LARGE") {
                    WriteJson(res, 413, new { error = "Request payload exceeds 16 MiB limit." });
                } else {
                    LogEvent("error", "memory", ex.Message);
                    WriteJson(res, 500, new { error = ex.Message });
                }
            }
        }

        private void HandleMcp(HttpListenerRequest req, HttpListenerResponse res) {
            string mcpFile = Path.Combine(_appDataDir, "mcp_servers.json");
            try {
                if (req.HttpMethod == "GET") {
                    object servers = null;
                    lock (_dataLock) {
                        if (File.Exists(mcpFile)) {
                            try { servers = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(mcpFile, Encoding.UTF8)); } catch { }
                        }
                    }
                    WriteJson(res, 200, new { servers = servers, plugins = new object[0] });
                    return;
                }
                if (req.HttpMethod == "POST") {
                    string body = ReadRequestBodyUtf8(req);
                    EnqueueAtomicWrite(mcpFile, body);
                    WriteJson(res, 200, new { status = "saved" });
                    return;
                }
                res.StatusCode = 405;
                res.Close();
            } catch (Exception ex) {
                if (ex.Message == "PAYLOAD_TOO_LARGE") {
                    WriteJson(res, 413, new { error = "Request payload exceeds 16 MiB limit." });
                } else {
                    LogEvent("error", "mcp", ex.Message);
                    WriteJson(res, 500, new { error = ex.Message });
                }
            }
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
