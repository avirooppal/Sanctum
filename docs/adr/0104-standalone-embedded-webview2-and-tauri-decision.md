# ADR 0104: Standalone Embedded WebView2 & Tauri 2 Engine Decision (E0 Gates 1–4)

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Builds on**: ADR 0091, ADR 0093, ADR 0094, ADR 0100, ADR 0101
- **Authority**: `docs/MASTER_PROMPT.md` (with Amendment 1), `docs/APP_NOT_WRAPPER.md`

---

## 1. Context & Problem Statement

Prior to this ADR, `tools/compile_desktop_host.py` started a local HTTP server on `127.0.0.1:1337` and invoked `Process.Start("msedge.exe", "--app=http://127.0.0.1:1337/...")`. Because an external `msedge.exe` browser process owned the window:
1. Browser-level accelerators (`Ctrl+P` Print, `Ctrl+N` New Edge Window) were intercepted by Microsoft Edge's native window procedure before reaching the application.
2. Task Manager and `Alt+Tab` identified the window as `Microsoft Edge` rather than `Sanctum`.
3. The application UI was served over a local TCP port that any browser on the machine could open.

We evaluated Candidate A (**Embedded WebView2 inside native `Sanctum-Desktop.exe` / Tauri 2 Wry**) against the four mandatory E0 Engine-Decision Gates prior to full cutover.

---

## 2. E0 Engine-Decision Gate Measurements

### Gate 1: Network Silence (Hard Privacy Gate)
- **Initial Run (Failed — Preserved as Named Evidence):**
  - Evidence file: [`evals/results/exe/gate1_network_silence_initial_failure.json`](file:///c:/Users/aviroop/Desktop/Sru/evals/results/exe/gate1_network_silence_initial_failure.json)
  - With `--disable-background-networking --disable-component-update --disable-sync` alone, the embedded WebView2 Network Service child process (`msedgewebview2.exe`, PID `15632`) opened **4 outbound TCP connections** on port `443` to `13.248.169.48` and `76.223.54.146` (`a904c694c05102f30.awsglobalaccelerator.com`).
- **Root Cause & Fix:**
  - The WebView2 runtime initiates background connections or page-embedded fetches unless the Chromium `MappedHostResolver` inside the Network Service is locked to local virtual hosts.
  - We added `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE sanctum.app, EXCLUDE 127.0.0.1, EXCLUDE localhost"` along with `--disable-features=msSmartScreenProtection,msEdgeShopping,msEdgeWallet,msImplicitSignin,msAccountConsistency,msEdgeExperiments,Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,CertificateTransparencyComponentUpdater`, `EnableTrackingPrevention = false`, `AllowSingleSignOnUsingOSPrimaryAccount = false`, and `IsReputationCheckingRequired = false`.
  - All consented external model downloads and remote provider calls execute strictly through the C# core Egress Broker (`HandleDownloadOrPull`), never directly from the WebView2 renderer process.
- **Post-Fix Verification:**
  - Evidence file: [`evals/results/exe/standalone_webview2_verification.json`](file:///c:/Users/aviroop/Desktop/Sru/evals/results/exe/standalone_webview2_verification.json)
  - Outbound non-loopback connections across the entire `Sanctum-Desktop.exe` + `msedgewebview2.exe` process tree: **0**.
  - **Verdict:** **PASS**.

### Gate 2: Accelerator & Shortcut Capture
- **Configuration Verified on Live `CoreWebView2Settings`:**
  - `AreBrowserAcceleratorKeysEnabled = false`
  - `AreDefaultContextMenusEnabled = false`
  - `AreDevToolsEnabled = false` (in release builds)
  - `IsStatusBarEnabled = false`
  - `IsZoomControlEnabled = false`
- **Observed Result:**
  - Synthetic `Ctrl+P`, `Ctrl+N`, `Ctrl+K`, `F5`, and `F12` keystrokes dispatched to the native `Sanctum` `HWND` spawn **0** external browser windows or print dialogs and are routed to the DOM capture-phase shortcut engine (`src/components/jan/JanAppShell.tsx`, verified by `tests/shortcuts_interception.test.ts` 7/7 pass).
  - **Verdict:** **PASS**.

### Gate 3: Resource & Performance Budgets (vs. ADR 0094 & ADR 0101)
- **Measured Values (`evals/results/exe/standalone_webview2_verification.json`):**
  - Cold start to `NavigationCompleted` (`first_frame_ms`): **~469 ms** (budget `< 2500 ms`).
  - Host process RSS (`Sanctum-Desktop.exe`): **~49.62 MB** (budget `< 100 MB`).
  - Total process-tree RSS (`Sanctum-Desktop.exe` + 6 embedded `msedgewebview2.exe` sub-processes): **~399.38 MB** (ADR 0101 budget `< 500 MB`).
  - Installer size (`dist/Sanctum-Setup-1.0.0-x64.exe`): **2.11 MB** (budget `< 25 MB`).
  - **Verdict:** **PASS**.

### Gate 4: Licenses & Supply Chain
- **WebView2 SDK (`vendor/webview2/`):**
  - `Microsoft.Web.WebView2.Core.dll` (`1.0.2210.55`), `Microsoft.Web.WebView2.WinForms.dll` (`1.0.2210.55`), `WebView2Loader.dll` (`1.0.2210.55`).
  - License: BSD-3-Clause style Microsoft WebView2 SDK License (`vendor/webview2/LICENSE.txt`, included in `dist/LICENSE_BUNDLE.txt` and `dist/THIRD_PARTY_NOTICES.txt`).
- **Tauri 2 Configuration (`src-tauri/`):**
  - Dual-licensed MIT OR Apache-2.0.
- **Runtime Distribution Policy (Recorded in `docs/REVIEW_QUEUE.md`):**
  - Default release (`Sanctum-Setup-1.0.0-x64.exe`): Uses the pre-installed Windows 10/11 Evergreen WebView2 Runtime (`155.0.4283.62` verified on host).
  - Optional Fixed-Version offline bundle documented in `docs/REVIEW_QUEUE.md` for air-gapped environments lacking WebView2.
- **Verdict:** **PASS**.

---

## 3. Decision

Adopt **Candidate A (Standalone Embedded WebView2 / Tauri 2 architecture)**:
1. `Sanctum-Desktop.exe` / `Sanctum.exe` creates its own top-level native Win32 window (`HWND`), sets `SetCurrentProcessExplicitAppUserModelID("Sanctum.Desktop.App.1")`, binds a Win32 Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`), and hosts `CoreWebView2Controller` directly inside `this.Handle`.
2. All references to `msedge.exe --app`, `chrome.exe --app`, and `brave.exe --app` are permanently deleted.
3. The UI is served via `SetVirtualHostNameToFolderMapping("sanctum.app", _webRoot, CoreWebView2HostResourceAccessKind.Allow)` and in-process `WebResourceRequested` handlers with **0 listening TCP ports** by default.
