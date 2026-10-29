import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Standalone Desktop App (Not a Browser Wrapper) Gate", () => {
  const hostPy = fs.readFileSync(path.join(ROOT, "tools", "compile_desktop_host.py"), "utf-8");
  const tauriConf = JSON.parse(fs.readFileSync(path.join(ROOT, "src-tauri", "tauri.conf.json"), "utf-8"));
  const tauriCap = JSON.parse(fs.readFileSync(path.join(ROOT, "src-tauri", "capabilities", "default.json"), "utf-8"));
  const appNotWrapperDoc = fs.readFileSync(path.join(ROOT, "docs", "APP_NOT_WRAPPER.md"), "utf-8");
  const settingsGeneral = fs.readFileSync(path.join(ROOT, "src", "components", "jan", "SettingsGeneral.tsx"), "utf-8");

  it("1. Process & Identity: never spawns msedge.exe/chrome.exe/brave.exe with --app=", () => {
    assert.equal(hostPy.includes("--app="), false, "compile_desktop_host.py must NOT contain --app= browser wrapper flags");
    assert.equal(hostPy.includes("FindChromiumAppBrowser"), false, "compile_desktop_host.py must NOT search for external browsers");
    assert.equal(hostPy.includes("msedge.exe"), false, "compile_desktop_host.py must NOT reference msedge.exe");
    assert.equal(hostPy.includes("chrome.exe"), false, "compile_desktop_host.py must NOT reference chrome.exe");
    assert.equal(hostPy.includes("brave.exe"), false, "compile_desktop_host.py must NOT reference brave.exe");
    assert.ok(
      hostPy.includes('SetCurrentProcessExplicitAppUserModelID("Sanctum.Desktop.App.1")'),
      "Host must set explicit AppUserModelID for Taskbar and Alt+Tab identity"
    );
  });

  it("2. No Browser Chrome or Accelerators: disables WebView2 browser accelerator keys, context menu, status bar, zoom, and DevTools in release", () => {
    assert.ok(hostPy.includes("AreBrowserAcceleratorKeysEnabled = false"), "Must disable browser accelerator keys (Ctrl+P, Ctrl+N, F5, F12)");
    assert.ok(hostPy.includes("AreDefaultContextMenusEnabled = false"), "Must disable default browser context menu");
    assert.ok(hostPy.includes("AreDevToolsEnabled = _enableDevTools"), "Must disable DevTools in release builds");
    assert.ok(hostPy.includes("IsStatusBarEnabled = false"), "Must disable status bar URL preview");
    assert.ok(hostPy.includes("IsZoomControlEnabled = false"), "Must disable browser zoom controls");
  });

  it("3. UI uses a virtual host and an authenticated loopback streaming API", () => {
    assert.ok(
      hostPy.includes("SetVirtualHostNameToFolderMapping") && hostPy.includes('"sanctum.app"'),
      "Must serve UI via SetVirtualHostNameToFolderMapping('sanctum.app')"
    );
    assert.ok(
      hostPy.includes('AddWebResourceRequestedFilter("https://sanctum.app/api/*"'),
      "Must reject unbridged API calls"
    );
    assert.ok(
      hostPy.includes('req.Headers["X-Sanctum-Auth"] != _authToken'),
      "The streaming API must require per-launch authentication"
    );
    assert.ok(hostPy.includes("EXCLUDE 127.0.0.1"), "The UI must be able to reach the loopback API");
    assert.ok(hostPy.includes('ProxyRequest(req, res, "http://127.0.0.1:11434/api/chat")'));
    assert.ok(hostPy.includes('ProxyRequest(req, res, "http://127.0.0.1:11434/api/pull")'));
    assert.ok(!hostPy.includes("SANCTUM_MODEL_WEIGHTS_DATA"));
    assert.ok(!hostPy.includes("Local inference loopback active. Ready for instructions."));
  });

  it("4. Native Window Behavior: dark #121214 background, DWM dark mode, persistent window bounds, single-instance lock", () => {
    assert.ok(hostPy.includes("Color.FromArgb(18, 18, 20)"), "Must set dark #121214 background to prevent white flash");
    assert.ok(hostPy.includes("DWMWA_USE_IMMERSIVE_DARK_MODE"), "Must enable DWM dark title bar");
    assert.ok(hostPy.includes("RestoreWindowBounds()"), "Must restore window bounds across restarts");
    assert.ok(hostPy.includes("SaveWindowBounds()"), "Must save window bounds on exit");
    assert.ok(hostPy.includes("SanctumDesktopSingleInstanceMutex"), "Must enforce single-instance mutex");
  });

  it("5. Native OS Integrations: handles native folder/file dialogs over WebMessageReceived", () => {
    assert.ok(hostPy.includes("FolderBrowserDialog"), "Must provide native FolderBrowserDialog");
    assert.ok(hostPy.includes("OpenFileDialog"), "Must provide native OpenFileDialog");
    assert.ok(settingsGeneral.includes("selectFolder"), "SettingsGeneral must invoke native folder dialog bridge");
  });

  it("6. Process Lifecycle: binds Win32 Job Object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE", () => {
    assert.ok(hostPy.includes("JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE"), "Must configure Job Object to kill child processes on close");
    assert.ok(hostPy.includes("AssignProcessToJobObject"), "Must assign process to Win32 Job Object");
  });

  it("7. Hardened Posture & Network Silence: suppresses WebView2 background networking and blocks popups/external navigation/permissions", () => {
    assert.ok(hostPy.includes("--disable-background-networking"), "Must pass --disable-background-networking");
    assert.ok(hostPy.includes("--disable-component-update"), "Must pass --disable-component-update");
    assert.ok(hostPy.includes("msSmartScreenProtection"), "Must disable SmartScreen background feature");
    assert.ok(hostPy.includes("NewWindowRequested"), "Must block new window requests");
    assert.ok(hostPy.includes("CoreWebView2PermissionState.Deny"), "Must deny web permissions by default");
    assert.ok(tauriConf.app.security.csp.includes("object-src 'none'"), "Tauri CSP must disallow object-src");
    assert.ok(Array.isArray(tauriCap.permissions) && tauriCap.permissions.length > 0, "Least-privilege capabilities defined");
  });

  it("8. Honesty Statement: explicitly discloses embedded WebView2 engine architecture in docs and About view", () => {
    assert.ok(
      appNotWrapperDoc.includes("embedded web engine (Microsoft Edge WebView2"),
      "docs/APP_NOT_WRAPPER.md must state embedded WebView2 architecture"
    );
    assert.ok(
      settingsGeneral.includes("Standalone desktop app (embedded WebView2 engine, same class as Jan and VS Code)"),
      "Settings > General About section must state embedded WebView2 architecture"
    );
  });
});
