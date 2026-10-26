# Embedded Web Engine Security & Patch Policy (T8)

**Authority:** `docs/MASTER_PROMPT.md`, ADR 0100, ADR 0101, ADR 0104.

---

## 1. Engine Architecture & Components

Sanctum Desktop embeds Microsoft Edge WebView2 (`CoreWebView2Controller` / Tauri 2 Wry) inside the native `Sanctum-Desktop.exe` Win32 process:
- **Pinned Interop SDK (`vendor/webview2/`):**
  - `Microsoft.Web.WebView2.Core.dll`: `1.0.2210.55` (SHA256: `A8AF1E567C08D28C354A99EE27B9455AED61A0AD13A5F1C0EFA0655778932460`)
  - `Microsoft.Web.WebView2.WinForms.dll`: `1.0.2210.55` (SHA256: `1E9D4556AC04856FD87C928A19072DBCB15D0050501298EE1E06D01824D3CB75`)
  - `WebView2Loader.dll`: `1.0.2210.55` (SHA256: `4B429FEF1C9B112CDD103E6E4CE56732F65D2F5729B9B6127AEB895673C551F3`)
- **System WebView2 Runtime:**
  - Standard Edition uses the OS-managed Evergreen WebView2 Runtime (`C:\Program Files (x86)\Microsoft\EdgeWebView\Application\<version>\msedgewebview2.exe`), serviced automatically through Windows Update.

---

## 2. Vulnerability Monitoring & Update Cadence

1. **Automated CI Advisory Audit:**
   - Every push and pull request runs `npm audit --omit=dev` and `python tools/exe-verify/verify_security.py --test=audit_licenses`.
   - WebView2 SDK assemblies in `vendor/webview2/` are hash-pinned and verified against Microsoft security advisories (MSRC) prior to each release tag.
2. **Critical Chromium / WebView2 CVE Response:**
   - For Evergreen runtime deployments: Windows Update patches the underlying `msedgewebview2.exe` binary at the OS level without requiring a Sanctum binary rebuild, while Sanctum's in-process isolation (`--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE sanctum.app, EXCLUDE 127.0.0.1, EXCLUDE localhost"`, `NewWindowRequested` block, `NavigationStarting` origin lock, `PermissionRequested` default deny) prevents remote content execution even prior to OS patching.
   - For SDK / Loader advisories (`WebView2Loader.dll` / `Microsoft.Web.WebView2.Core.dll`) or Fixed-Version offline bundles: a patched release tag (`exe-v1.0.x`) must be built, verified through all 8 suites in `tools/exe-verify/run_all_verification.py`, and published within **72 hours** of upstream patch availability.

---

## 3. Defense-in-Depth Mitigations Always Active

Even if an unpatched Chromium renderer vulnerability exists:
1. **Zero Untrusted Remote Origins:** `NavigationStarting` cancels any navigation outside `https://sanctum.app/` and `about:blank`.
2. **Network Silence Lock:** The WebView2 Network Service runs with `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE sanctum.app, EXCLUDE 127.0.0.1, EXCLUDE localhost"`, preventing renderer/network sub-processes from resolving or connecting to external hosts.
3. **Zero UI TCP Socket:** In default desktop mode (`localApi.enable = false`), no HTTP server listens on any TCP port (`ui_tcp_listener_active = false`).
4. **Win32 Job Object Containment:** All WebView2 child processes run inside a Win32 Job Object configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
