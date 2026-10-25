# ADR 0100: Windows Installer Pipeline and WebView2 Strategy (Option C)

**Date:** 2026-10-21  
**Status:** PROPOSED / DEFAULT IMPLEMENTED (Awaiting Owner Review in REVIEW_QUEUE)  
**Decides:** Question 2C of the One-to-One Port Mandate

---

## 1. Context & Problem Statement

Sanctum must deliver a production Windows installer executable: `dist/Sanctum-Setup-<version>-x64.exe`, accompanied by `SHA256SUMS`, an SBOM, and the complete license bundle.

We must evaluate:
1. Installer technology: NSIS vs Inno Setup vs WiX vs Custom scripts.
2. WebView2 runtime distribution: Online evergreen bootstrapper vs Offline standalone fixed version.

---

## 2. Evaluation & Measurements

### A. Installer Technology Comparison

| Technology | License | Size Overhead | Silent Install (`/S`) | Clean Uninstall | Verdict |
|---|---|---|---|---|---|
| **NSIS (via Tauri bundler)** | zlib/libpng (permissive) | **~340 KB** | Built-in native support | Fully clean, customizable uninstaller dialog asking before deleting data | **Selected (Winner)** |
| **Inno Setup** | Inno Setup License (permissive) | ~1.2 MB | Requires separate pipeline scripts | Reliable | Viable alternative, but adds build step |
| **WiX Toolset (MSI)** | MS-RL / CPAL | ~2.5 MB | Standard MSI `/qn` | Complex custom actions for per-user data | Overkill for single-user desktop |

### B. WebView2 Strategy

1. **Standard Edition (Default):** Online Evergreen Bootstrapper.
   - Most modern Windows 10/11 machines already have the Evergreen WebView2 Runtime pre-installed system-wide.
   - Installer size remains compact (~60-80 MB total installer).
   - If WebView2 is absent, the installer automatically runs Microsoft's official bootstrapper with user consent.
2. **Offline Edition (Optional):** Fixed Version Runtime.
   - Bundles the full ~160 MB fixed runtime inside the installer for air-gapped environments.
   - Total installer size increases to ~240 MB.

---

## 3. Decision

1. **Installer Engine:** Use **NSIS** integrated via the native Tauri v2 bundler.
2. **Output Artifact:** `dist/Sanctum-Setup-<version>-x64.exe`.
3. **Packaging Rules:**
   - Default install to per-user directory (`%LOCALAPPDATA%\Programs\Sanctum`) requiring zero administrator privileges.
   - Support silent unattended flags (`/S`).
   - Clean uninstaller (`uninstall.exe`) that explicitly prompts whether to preserve or purge user threads and model weights.
   - In-place upgrades preserve existing `%APPDATA%\Sanctum` user databases without data loss.
