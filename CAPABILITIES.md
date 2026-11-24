# Sanctum Shipped & Verified Capabilities

## 1. Production Architecture
- **Production Backend**: Standalone Windows C# WebView2 host (`tools/native/DesktopHost.cs`, `DesktopServices.cs`, `DesktopWorkspaceEndpoints.cs`, `DesktopBrowserEndpoints.cs`) compiled via `tools/compile_desktop_host.py` into `Sanctum.exe` / `Sanctum-Desktop.exe`.
- **Static Frontend**: Next.js static export (`out/`) served over WebView2 virtual host `https://sanctum.app` with an authenticated loopback HTTP API (`http://127.0.0.1:<port>/api/*`) and single-use `X-Sanctum-Approval` tokens issued exclusively via native `WebMessageReceived`.
- **Host-Enforced Local-Only Egress**: Outbound HTTP is routed through a single C# `EgressHttpFactory` with a deny-by-default allowlist, append-only redacted egress ledger, WebView2 `WebResourceRequested` barrier, and a global Offline mode switch.

---

## 2. Phase 1 — File/Artifact Viewer Panel, Workspace File Tree & Checkpoints
- **Resizable Right Viewer Panel (`src/components/viewer/ArtifactViewerPanel.tsx`)**:
  - Multi-tab bar (open multiple files, close, drag-to-reorder, middle-click close, dirty/changed-on-disk dot indicator).
  - Breadcrumb (`workspace > folder > file`) + `Preview`/`Raw` toggle, refresh, copy path, reveal in Explorer, open in default app, and `Toggle sidebar`.
- **Collapsible Workspace File Tree (`src/components/viewer/WorkspaceFileTree.tsx`)**:
  - Lazy-loaded directories, file-type icons, toggleable ignored directories (`.git`, `node_modules`, `.next`, `dist`, `out`), search/filter input (`Ctrl+Shift+E`), and context menu (`Open`, `Copy Path`, `Reveal in Explorer`, `Rename`, `Delete` to recoverable `tool-trash` via approval gate).
- **File Opening & Agent Surfacing**:
  - Click in file tree, click verified workspace file paths mentioned in assistant responses, `@file` mention autocomplete in composer, drag-and-drop into chat, and `present_file(path)` agent tool.
- **Sandboxed Renderers (`src/components/viewer/FileContentRenderer.tsx`)**:
  - **Markdown**: Sanitized via `sanitizeUntrustedMarkdownHtml` (strips `<script>`, inline handlers, `javascript:` URIs, remote images by default), table of contents, syntax highlighting.
  - **HTML & SVG**: Rendered inside `<iframe sandbox="">` (or `sandbox="allow-scripts"` only on per-tab opt-in, **never** `allow-same-origin`) with strict CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; sandbox`.
  - **Source Code / JSON / YAML / CSV**: Line numbers, jump-to-line, collapsible JSON tree, formatted CSV table, and Raw mode editing with checkpoint creation before save.
  - **Media & Binary**: Images (zoom/fit), Video/Audio with HTTP `206 Partial Content` `Range` streaming (`GET /api/fs/raw`), PDF viewer (`pdf.worker.min.mjs`), and hex preview for binary files.
- **Live Updates & Per-Hunk Checkpoints (`tools/native/DesktopWorkspaceEndpoints.cs`, `DiffReviewModal.tsx`)**:
  - Host `FileSystemWatcher` pushes changes over `/api/fs/events`.
  - Pre-tool workspace snapshots (`GET/POST /api/checkpoints` with `create`, `diff`, `apply_hunks`, `rewind`) powering the end-of-turn `"N files changed +X -Y [Review]"` summary card, per-hunk accept/reject, and full rewind.

---

## 3. Phase 2 — Browser Agent (`browser-use` Optional Pack)
- **Pack & Attribution (`packs/browser-agent/`)**:
  - Optional pack (`id: "sanctum.agents.browser-use"`) built on [browser-use](https://github.com/browser-use/browser-use) (MIT License, Copyright © 2024 Gregor Zunic & Browser Use Contributors; full notice in `packs/browser-agent/NOTICE` and `Settings -> General -> About`).
  - Uses existing system Microsoft Edge (`msedge`) or Google Chrome (`chrome`) first, isolated venv (`%LOCALAPPDATA%\Sanctum\packs\browser-agent\venv`), and isolated browser profile (`%LOCALAPPDATA%\Sanctum\browser-profile`).
  - Telemetry hard-disabled before import (`ANONYMIZED_TELEMETRY=false`, `BROWSER_USE_CLOUD_SYNC=false`, `POSTHOG_DISABLED=1`, `DO_NOT_TRACK=1`) + `ProductTelemetry.capture` no-op monkey-patch.
- **C# Host Supervision & Security (`tools/native/DesktopBrowserEndpoints.cs`, `core/infra/security/browser_policy.ts`)**:
  - Hard-blocks `file://`, `javascript:`, `data:`, `chrome://`, `edge://`, Sanctum's own host port, Ollama port `11434`, cloud metadata `169.254.169.254`, RFC1918 private IPs (`10/8`, `172.16/12`, `192.168/16`), link-local `169.254/16`, IPv6 loopback/link-local/ULA, and DNS rebinding (`DNS_REBIND_BLOCKED`) across initial navigations and HTTP redirects.
  - Per-domain allowlist (`Allow once`, `Allow for session`, `Always allow`, `Block`) and single-use `X-Sanctum-Approval` gates for password/credit-card typing, `POST` form submissions, and downloads (`<workspace>/downloads/` via `ToolPath`).
  - Wraps all web text/DOM in `<untrusted_web_content url="...">...</untrusted_web_content>` (escaping closing-tag breakouts) with `BROWSER_PROMPT_INJECTION_SYSTEM_RULE`.
  - Live **Browser** viewer tab (`BrowserAgentTab.tsx`) with URL bar, viewport screenshot, step log, and `Pause` / `Take Over` / `Resume` / `Stop` controls.
  - 12-task benchmark & `use_vision` policy documented in `packs/browser-agent/BENCHMARK.md`.

---

## 4. Phase 3 — Supporting Workspace UX & Local STT Models
- **Composer Model + Effort Picker & Fast vs Plan Mode (`src/components/chat/WorkspaceTools.tsx`)**:
  - Local model selector (Ollama / loopback OpenAI-compatible) showing size, quantization, context window, and capability tags (`Tools`, `Vision`, `Thinking`).
  - Reasoning Effort picker (`Off`, `Low`, `Medium`, `High`) disabled with tooltip when the selected model does not support thinking.
  - **Fast** vs **Plan** execution toggle: Plan mode writes `PLAN.md` first, opens it in the right viewer panel via `present_file`, and waits for `[Approve & Execute]` before modifying source files.
- **Open IDE, Deliverables ZIP Export & Manual Update Check (`src/components/viewer/WorkspaceHeaderActions.tsx`)**:
  - Top-bar workspace folder switcher, `AccessScopeBadge`, and **Open IDE** split button (`GET /api/ide/detect`, `POST /api/ide/open` gated by `X-Sanctum-Approval` + command rules, passing workspace + focused file + line).
  - **Deliverables** popover listing files created, edited, or presented in the session with one-click **Export as ZIP** (`POST /api/fs/export-zip`).
  - Local-first manual **"Check for updates"** (`GET /api/updates/check`) in `Settings -> General` + top-bar **"Update vX.Y.Z"** pill when a newer signed release is found.
  - Keyboard shortcuts: `Ctrl+B` (left sidebar), `Ctrl+\` (right viewer panel), `Ctrl+P` (quick-open file modal), `Ctrl+W` (close active viewer tab), `Ctrl+Tab` (next viewer tab), `Ctrl+Shift+E` (focus file tree).
- **Local Speech-to-Text Models (`/api/audio/models`, `/api/audio/download`)**:
  - **Light & Accurate**: Alibaba `Qwen3-ASR-0.6B` (600M, 1.2 GB, 52 languages).
  - **Heavy & Super Accurate**: NVIDIA `Nemotron 3.5 Transcribe` (1.1B, 2.8 GB, ~5.6% WER).
