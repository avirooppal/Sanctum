# First-Time Installation and Setup Specification

**Date:** 2026-10-21  
**Status:** SPECIFICATION (Jan + Odysseus First-Run Parity)

---

## 1. Upstream Flows Inspected

### A. Upstream Jan
- **Installer (Windows):** Standard NSIS installer (`Jan-Setup-<version>-x64.exe`). Installs into `%LOCALAPPDATA%\Programs\Jan`. Prompts for installation directory and creates Start Menu and Desktop shortcuts.
- **First Launch:**
  1. Window initializes to an onboarding/welcome state (`SetupScreen.tsx`).
  2. If no models or providers are active, it prompts the user with recommended starter models.
  3. In upstream, clicking "Download" immediately contacts Hugging Face to download the default GGUF model without an egress confirmation dialog.
  4. Local data directory defaults to `%APPDATA%\Jan`.
  5. Analytics prompt requests opt-in to PostHog telemetry.

### B. Upstream Odysseus
- **Install & Setup:**
  1. Typically orchestrated via `docker-compose.yml` or native script `launch-windows.ps1` with Python virtual environment.
  2. First run prompts the user to create an initial administrative username and password.
  3. Prompts for LLM provider credentials (Ollama, OpenAI, or local server URL).
  4. Stores data under `data/` and user notes under local SQLite.

---

## 2. Sanctum Desktop Adaptation & Implementation

Sanctum reproduces the exact visual and interaction flow of upstream Jan and Odysseus while strictly honoring Sanctum's zero-egress, privacy, and reality rules.

### 1. Windows Installer (`Sanctum-Setup-<version>-x64.exe`)
- **Engine:** Permissive NSIS installer built via Tauri v2 bundler.
- **Install Location:** Default to `%LOCALAPPDATA%\Programs\Sanctum` (clean per-user install requiring zero administrator privileges).
- **Options:** License acceptance, destination folder selection, desktop/start menu shortcuts.
- **Silent Flags:** Supports standard `/S` for automated unattended installation.
- **Uninstaller:** `uninstall.exe` removes all binaries and registry keys, and explicitly displays an interactive dialog:
  > *"Do you want to delete your conversation history and downloaded models in `%APPDATA%\Sanctum`?"*
  Preserves user data unless explicitly confirmed for deletion.

### 2. First Launch Flow
- **Clean State:** On first launch with an empty data directory, Sanctum displays the exact Jan onboarding setup screen (`SetupScreen.tsx`).
- **Permitted Deviation #4 (Model Download Consent):**
  - Unlike Jan's automatic network request, clicking a recommended starter model displays an explicit consent dialog:
    > *"Download model from `https://huggingface.co` (Size: 2.1 GB)? Network egress will be recorded in the readable ledger."*
  - **Offline Import:** An "Import Local GGUF" button is prominently displayed, allowing 100% offline startup with zero network connections.
- **Single-User Workspace Pack (Odysseus):**
  - The Odysseus Workspace Pack runs in the background as a supervised child process (`python -m app`) without opening any visible console windows.
  - First-run account creation is completely automated: single-user desktop credentials are automatically established, bypassing the admin-password creation screen.
  - Model endpoint is preconfigured to point at Sanctum's local OpenAI server (`http://127.0.0.1:1337/v1`).
- **Telemetry Stripped:** PostHog telemetry prompts and update checkers are completely removed (ADR 0089, ADR 0096).
