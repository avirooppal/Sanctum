# Definition of a Real Standalone Desktop App (Not a Browser Wrapper)

**Authority:** `docs/MASTER_PROMPT.md` (with Amendment 1), ADR 0093, ADR 0094, ADR 0100, ADR 0101, ADR 0104.  
**Enforcement:** Every requirement below is enforced by an automated test in [`tests/app_not_wrapper.test.ts`](file:///c:/Users/aviroop/Desktop/Sru/tests/app_not_wrapper.test.ts) and [`tools/exe-verify/verify_standalone_window.py`](file:///c:/Users/aviroop/Desktop/Sru/tools/exe-verify/verify_standalone_window.py).

---

## 1. Process and Identity
- **Requirement:** `Sanctum.exe` / `Sanctum-Desktop.exe` owns the top-level native Win32 window (`HWND`). The application **never** launches `msedge.exe`, `chrome.exe`, `brave.exe`, `firefox.exe`, or any external browser in `--app` mode as its UI.
- **Identity:**
  - Task Manager and `Alt+Tab` show `"Sanctum"` with the icon generated from `Beta.jpg` (`deploy/installer/app-icon.ico`).
  - The process calls `SetCurrentProcessExplicitAppUserModelID("Sanctum.Desktop.App.1")` (`shell32.dll`) prior to window creation so the Windows taskbar group, Jump List, and notifications carry Sanctum's explicit identity.
  - System tray (`NotifyIcon`) and native title/window icon use the `Beta.jpg` multi-resolution icon suite.
- **Automated Verification:** `verify_standalone_window.py --test=process_identity` & `tests/app_not_wrapper.test.ts` (asserts 0 external browser processes spawned; verifies top-level visible `HWND` belongs to `Sanctum-Desktop.exe` and `SetCurrentProcessExplicitAppUserModelID` is invoked).

## 2. No Browser Chrome or Accelerators
- **Requirement:** No URL bar, browser tabs, browser menu, default browser context menu, `view-source`, `save-as`, browser print dialog, browser find bar, or reload prompt.
- **Hardened WebView2 Settings (`CoreWebView2Settings`):**
  - `AreBrowserAcceleratorKeysEnabled = false` (blocks browser-level `Ctrl+P` Print, `Ctrl+N` New Window, `Ctrl+T` New Tab, `Ctrl+W` Close Tab, `F5` / `Ctrl+R` Reload, `Ctrl+F` / `Ctrl+G` / `F3` Find, `Ctrl+U` View Source, `F7` Caret Browsing, `F12` / `Ctrl+Shift+I` DevTools, `Ctrl++`/`Ctrl+-`/`Ctrl+0` Zoom, `Alt+Left`/`Alt+Right` History Navigation).
  - `AreDefaultContextMenusEnabled = false` (blocks default Edge right-click menu).
  - `AreDevToolsEnabled = false` in release builds (only enabled if `--devtools` flag is explicitly passed during development).
  - `IsStatusBarEnabled = false` (hides bottom-left link hover URL preview).
  - `IsZoomControlEnabled = false` (prevents pinch/wheel zoom scaling the application chrome).
  - `IsBuiltInErrorPageEnabled = false`, `IsPasswordAutosaveEnabled = false`, `IsGeneralAutofillEnabled = false`.
- **App Shortcut Ownership:** `Ctrl+N` (New Chat), `Ctrl+K` / `Ctrl+P` (Command & Thread Search), `Ctrl+B` (Toggle Sidebar), `Ctrl+,` (Settings), `Ctrl+Shift+Backspace` (Delete Thread), `Ctrl+Enter` (Send Message), and `Escape` (Close Modal / Stop Inference) are intercepted by the app's capture-phase shortcut engine (`src/components/jan/JanAppShell.tsx`) and are user-rebindable in **Settings > Shortcuts**.
- **Automated Verification:** `verify_standalone_window.py --test=accelerators` & `tests/shortcuts_interception.test.ts` (proves `Ctrl+P`, `Ctrl+N`, `Ctrl+K` reach the app and never open a print dialog or external browser window).

## 3. UI Is Not a Web Page Served on a Public/Local TCP Port
- **Requirement:** The application UI is loaded from bundled local assets over the embedded engine's virtual host / custom scheme mapping (`https://sanctum.app/index.html` mapped via `SetVirtualHostNameToFolderMapping` and in-process `WebResourceRequested` interception for `/api/*` and `/v1/*`).
- **Zero Default UI TCP Port:** In standard desktop mode (`localApi.enable = false`, the default), **no HTTP server listens on any TCP port**. An external browser pointing at `http://127.0.0.1:1337` cannot open the UI.
- **Optional Local API Server:** The OpenAI-compatible Local API Server (`127.0.0.1:<port>`) is a separate opt-in service controlled by **Settings > Local API Server** (`localApi.enable = true`) or the `--headless` CLI flag, authenticated by a per-launch token.
- **Automated Verification:** `verify_standalone_window.py --test=zero_ui_tcp_port` (launches `Sanctum-Desktop.exe` in desktop mode and verifies via `Get-NetTCPConnection` that its PID owns `0` listening TCP ports while serving the UI in-process).

## 4. Native Window Behavior
- **Requirement:**
  - Custom dark application frame (`#121214` / `RGB(18, 18, 20)` background brush on both the Win32 `Form` and `CoreWebView2Controller.DefaultBackgroundColor`) with DWM dark immersive title bar (`DwmSetWindowAttribute` attribute `20` = `DWMWA_USE_IMMERSIVE_DARK_MODE`).
  - Window starts hidden until `CoreWebView2.NavigationCompleted` fires on the first frame (or 800 ms safety fallback) so there is zero white flash on cold start.
  - Window geometry (`Left`, `Top`, `Width`, `Height`, `Maximized`) is persisted to `%APPDATA%\Sanctum\window_state.json` and restored across restarts, clamped to active monitor working areas (`Screen.AllScreens`) so disconnecting an external display never leaves the window off-screen.
  - Single-instance mutex (`Local\SanctumDesktopSingleInstanceMutex`): launching a second instance activates and brings the existing native window to the foreground (`ShowWindow` + `SetForegroundWindow`) and exits with code `2`.
- **Automated Verification:** `verify_standalone_window.py --test=window_lifecycle` & `verify_data_safety.py --test=single_instance`.

## 5. Native OS Integrations
- **Requirement:**
  - Native Windows file and folder dialogs (`OpenFileDialog`, `SaveFileDialog`, `FolderBrowserDialog`) invoked over the `window.chrome.webview.postMessage` bridge for model GGUF import, RAG document attachment, data folder relocation, and thread JSON export.
  - Drag-and-drop file paths validated against extension allowlists (`.gguf`, `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.png`, `.jpg`).
  - OS theme detection (`prefers-color-scheme`) synchronized with **Settings > Appearance**.
- **Automated Verification:** `tests/app_not_wrapper.test.ts` (verifies native bridge handlers for `selectFolder`, `openFile`, `saveFile`, and window state commands).

## 6. Process Lifecycle and Zero-Orphan Guarantee
- **Requirement:**
  - Starting the app initializes the embedded core; quitting the app cleanly disposes `CoreWebView2Controller` and stops any active local API or inference workers.
  - **Win32 Job Object Containment:** On startup, `Sanctum-Desktop.exe` creates a Win32 Job Object (`CreateJobObject`), configures `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (`0x00002000`), and assigns its own process (`AssignProcessToJobObject`) so the Windows kernel automatically terminates all child processes (including `msedgewebview2.exe` sub-processes and engine workers) if `Sanctum-Desktop.exe` crashes or is terminated via `taskkill /F`.
- **Automated Verification:** `verify_standalone_window.py --test=job_object_no_orphans` & `verify_resources.py --scenario=crash_loops`.

## 7. Hardened Security & Network Silence Posture
- **Requirement:**
  - Least-privilege WebView2 capabilities: `NewWindowRequested` sets `e.Handled = true`; `NavigationStarting` cancels any navigation outside `https://sanctum.app/`; `PermissionRequested` sets `e.State = CoreWebView2PermissionState.Deny`.
  - Strict Content Security Policy (`default-src 'self' https://sanctum.app; script-src 'self' 'unsafe-inline' https://sanctum.app; style-src 'self' 'unsafe-inline' https://sanctum.app; img-src 'self' data: blob: https://sanctum.app; connect-src 'self' https://sanctum.app http://127.0.0.1:*; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`).
  - WebView2 background networking suppressed via verified Chromium/Edge environment flags (`--disable-background-networking --disable-component-update --disable-domain-reliability --disable-sync --disable-translate --disable-client-side-phishing-detection --disable-default-apps --disable-breakpad --disable-crash-reporter --no-first-run --no-default-browser-check --no-pings --metrics-recording-only --disable-features=msSmartScreenProtection,Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,CertificateTransparencyComponentUpdater`).
  - Zero auto-update checks, zero crash uploads, and zero telemetry unless explicitly initiated by the user through the consent-gated egress broker.
- **Automated Verification:** `verify_standalone_window.py --test=network_silence` & `verify_security.py --test=network_egress`.

## 8. Honesty Requirement
- **Statement:** Sanctum's desktop interface is rendered inside an embedded web engine (Microsoft Edge WebView2 / Tauri 2 Wry architecture, the same architectural class used by Jan and Visual Studio Code) hosted inside Sanctum's native Win32 executable (`Sanctum.exe` / `Sanctum-Desktop.exe`). Sanctum never claims to use a native Win32/WPF/WinUI widget toolkit for its inner workspace views, and never describes performance, memory, or security properties without measured numbers alongside them.
- **Automated Verification:** `tests/app_not_wrapper.test.ts` verifies this disclosure is present in `docs/APP_NOT_WRAPPER.md`, `README.md`, and the Settings > General About view.

---

## Verification Mapping Table

| Requirement | Automated Test / Script | Manual Check (Clean Windows 10/11 VM) |
|---|---|---|
| **1. Process & Identity** | `python tools/exe-verify/verify_standalone_window.py --test=process_identity` | Open Task Manager & `Alt+Tab`: confirm `"Sanctum"` with `Beta.jpg` icon; 0 external `Microsoft Edge` browser windows |
| **2. No Browser Chrome / Accelerators** | `python tools/exe-verify/verify_standalone_window.py --test=accelerators` & `npm test` | Press `Ctrl+P`, `Ctrl+N`, `Ctrl+K`, `F5`, `F12`, right-click: confirm app handles shortcuts and no browser print/new-window/context-menu opens |
| **3. No UI TCP Listener** | `python tools/exe-verify/verify_standalone_window.py --test=zero_ui_tcp_port` | Run `Get-NetTCPConnection -OwningProcess <PID>`: confirm 0 listening TCP ports when Local API Server is off |
| **4. Native Window Behavior** | `python tools/exe-verify/verify_standalone_window.py --test=window_lifecycle` | Resize/move window, close and relaunch: confirm position restored and dark `#121214` startup without white flash |
| **5. Native OS Integrations** | `node --experimental-strip-types --test tests/app_not_wrapper.test.ts` | Click "Change Location" or "Browse" in Settings > General: confirm native Windows folder picker opens |
| **6. Lifecycle & Job Object** | `python tools/exe-verify/verify_standalone_window.py --test=job_object_no_orphans` | Kill `Sanctum-Desktop.exe` in Task Manager: confirm all child `msedgewebview2.exe` processes exit immediately |
| **7. Hardened Posture & Network Silence** | `python tools/exe-verify/verify_standalone_window.py --test=network_silence` | Inspect outbound connections over 60 s idle + active use: confirm 0 unexplained outbound connections |
| **8. Honesty Statement** | `node --experimental-strip-types --test tests/app_not_wrapper.test.ts` | Open Settings > General (About section): confirm embedded WebView2 engine architecture is stated |
