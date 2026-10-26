# ADR 0103: Pinned Jan v0.8.7 Upstream UI/UX Architecture & Exact Parity Implementation

- **Status**: ACCEPTED
- **Date**: 2026-10-25
- **Builds on**: ADR 0089 (Jan Study), ADR 0093 (Core Contracts), ADR 0094 (Performance Budgets), ADR 0096 (Exact UI Port), ADR 0101 (Exe Resource Budgets), ADR 0102 (Amendment 1 Interaction Lifecycle)

---

## 1. Context & Authority

The owner mandate requires exact 1:1 parity with the Jan v0.8.7 desktop UI on Windows (dark theme) as evidenced in the owner-provided reference captures (`docs/design/reference/owner/`), while embedding the app icon derived strictly from `Beta.jpg` and enforcing zero dead UI or fake controls.

Upstream release:
- **Repository**: `https://github.com/janhq/jan`
- **Release Tag**: `v0.8.7`
- **Pinned Commit SHA**: `648e8da55438150ccfab78808fa97a7a8e458c9f`
- **License**: Apache-2.0 (`docs/licenses/jan-v0.8.7-LICENSE.txt`, SHA256: `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`)
- **Root Notice**: None upstream (404 HTTP status confirmed)

---

## 2. Reference Baseline (Owner Screenshots Inventory)

Seven reference captures provided by owner under `docs/design/reference/owner/`:

1. `preview.webp` (1324×896, SHA256 `35d6ec9faf6aa8ffe784e7f15476ce9d24d012aba7be3c7b7a9435e6073888b9`):
   - **First Run (Step 1 of 3)**: Centered onboarding card "Jan needs to set up on your system" with explanation of engine and file-search embedding download, coral pill button "Let's start", and top window controls.
2. `preview (1).webp` (1425×840, SHA256 `e65156d51608705715a3bf50cda1add5f9c372fa68ea8d585b36385f7d73b570`):
   - **Model Hub**: Hugging Face search box, "Newest" sort dropdown, "Downloaded" switch, model cards with green "Fits" pill badge, "Download · Q4_K_M" coral button, parameters, description, author, download count, file count, "Tools" and "Multimodal" tag pills, "Show variants".
3. `preview (2).webp` (1400×849, SHA256 `3a84e3e97f014d4f68d7ea5ec9625075041e2800c5292b79a6abb5cc38f9bf6d`):
   - **Command Palette / Search Threads (Ctrl+K)**: Blurred dark backdrop, search input "Search threads...", "New Chat" quick action row with icon and shortcut hint, and footer navigation shortcuts (navigate, select, esc to close).
4. `preview (3).webp` (1425×840, SHA256 `3f376db6d5945ee9d641cd21b428cfdae18aad8b9861da04b78cbbd4826f780b`):
   - **Create New Project Modal**: Modal dialog with "Project Name" input, "Select an assistant (optional)" dropdown, Cancel button, and coral "Create" button.
5. `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` (1906×1120, SHA256 `45cd047bc9ec9b36cff1ed657037177273fd9a496df42d5b28e8ec741d193f2e`):
   - **Settings: General**: Left settings navigation menu, App Version, Automatic Update Check switch, Check for updates button, Language selector, Data Folder path with "Copy Path" and "Change Location", App Logs with "Show in File Explorer" and "Open Logs", Advanced with Jan CLI setup guide, Reset to Factory Settings, Spell Check switch.
6. `Screenshot 2026-10-25 190854.png` (1916×1112, SHA256 `6d99588dd3bf2115000e4b441af9cce63a5cb20a156f8e9219cc9c96586cf0f0`):
   - **Floating Left Sidebar & Navigation**: Brand wordmark "Jan" (adapted to "Sanctum"), download-manager button with circular progress ring, collapse toggle, New Chat (Ctrl+N), New Projects (Ctrl+P), Search (Ctrl+K), Hub, Settings, and projects/threads lists.
7. `186e7d53-2468-4c1c-b016-18af1233da1f.png` (790×570, SHA256 `3e8a3433390e2e6fd3a4f0988faa3a7e8825e2511dd90fa77d2800d0bebd5eaf`):
   - **Downloads Popover**: Active download item card with filename, pause and cancel action buttons, coral progress bar, percentage indicator, and byte progress ("1.72 / 2.79 GB").

---

## 3. Required Decisions & Deviations (Logged in `docs/ui-deviations.md`)

1. **Brand & Paths**: Replace all "Jan" text with "Sanctum". Default data folder is `%APPDATA%\Sanctum\data`.
2. **App Icon**: Pinned to `Beta.jpg` (SHA256: `44fbb9ec77c13b9f569be49168950a78bfbb53070dba8f551ca78e3fc82ae324`, 1150×1150 square JPEG). Generates full Windows multi-resolution icon (`app-icon.ico`) and shell assets.
3. **First-Run Engine & Model Download Consent**: Upstream downloads automatically without prompt. Sanctum bundles the CPU llama.cpp backend; any download (GPU acceleration binaries, embedding model, LLM weights) requires an explicit consent dialog naming the host and byte size.
4. **Hugging Face Hub Integration**: Live search and catalog queries routed through the consent-gated egress broker (`huggingface.co`). Offline / declined mode falls back to local models and file import.
5. **BYOK Cloud Providers**: OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, Azure, xAI, MiniMax available in Settings; keys stored in Windows Credential Manager; outbound calls gated with "Cloud" indicator and consent.
6. **Privacy Hardening**: Stripped PostHog analytics and telemetry. Replaced with real OS assurance tier and live connection monitor.
7. **Amendment 1 Integration**: Retain live request status line (`RequestStatusLine`) and interactive tokens/s counters below assistant responses as owner-authorized additions.
