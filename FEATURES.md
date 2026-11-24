# Sanctum — Local, Private AI Workspace Feature Inventory

Sanctum is a strictly local, private AI workspace and agent harness for Windows (`tools/native/`, `tools/native/harness/`, `src/`, `core/`, `packs/`). No cloud LLM providers, no telemetry, no analytics, and no silent background network traffic.

---

## 1. Standalone Windows Desktop Architecture & Packaging
- **Single-File Distribution (`Sanctum.exe`)**: Self-extracting Windows launcher compiled by `tools/build_installer.py` bundling the WebView2 desktop host (`Sanctum-Desktop.exe`), Next.js static frontend (`resources/web`), uninstaller (`Uninstall.exe`), WebView2 DLLs, and `Newtonsoft.Json.dll`.
- **Embedded WebView2 Host (`tools/native/DesktopHost.cs`)**: Serves UI over virtual host `https://sanctum.app`, proxies `/api/*` and `/v1/*` to loopback handlers, and enforces host-level egress control via `EgressHttpFactory` plus WebView2 `WebResourceRequested`.
- **System Tray Survival (`DesktopHost.cs`)**: Closing the window while agent runs are active hides Sanctum to the Windows system tray (`NotifyIcon`) with `Open Sanctum` / `Quit Sanctum` actions while background runs keep executing.
- **First-Run Setup Orchestrator (`DesktopServices.cs`, `SetupScreen.tsx`, `/api/setup`, `/api/setup/start`, `/api/setup/cancel`)**: Auto-detects/installs local Ollama and downloads a starter model on first launch.
- **Manual Signed Update Check & Install (`DesktopWorkspaceEndpoints.cs`, `/api/updates/check`, `/api/updates/install`, `JanUpdateToast.tsx`)**: Manual-only check in `Settings -> General` (blocked when Offline mode is active).

---

## 2. Strictly Local Inference & Host Egress Control
- **Local Ollama Engine (`OllamaProvider.cs`, `core/ai/inference/engine.ts`, `/api/ollama/models`, `/api/ollama/pull`, `/api/chat`, `/v1/chat/completions`)**:
  - Loopback-only (`127.0.0.1:11434`) with `OLLAMA_NO_CLOUD=1`.
  - Live capability discovery from `POST /api/show` (`tools`, `vision`, `thinking`, context length).
  - Model Hub & downloader with live progress, pause/cancel, and per-model parameters (`temperature`, `topP`, `repeatPenalty`, `contextSize`, `gpuLayers`, `threads`, `flashAttention`, `mlock`, `numa`).
- **Loopback-Only OpenAI-Compatible Provider (`Providers.cs`, `--provider openai-local --base-url http://127.0.0.1:...`)**:
  - Connects to local llama.cpp / LM Studio servers; strictly rejects any non-loopback base URL.
- **Host-Level Egress Factory, Ledger & Global Offline Mode (`EgressHttpFactory.cs`, `SettingsNetworkActivity.tsx`, `/v1/network/*`)**:
  - All C# outbound HTTP flows through `EgressHttpFactory` with a deny-by-default allowlist (loopback always allowed; non-loopback only for explicitly enabled features and allowlisted hosts).
  - Append-only redacted egress ledger (`egress_ledger.jsonl`) with Settings -> Network Activity viewer and JSONL export.
  - Global **Offline mode** switch blocks all non-loopback egress and disables dependent network features; disabling Offline mode requires trusted-channel / host approval.

---

## 3. Chat Workspace & Productivity UX
- **Independent Split View (`SplitChatPane.tsx`, `ChatScreen.tsx`)**: Open any two conversations side-by-side, resize panes, and stream independently with per-session model and sampling settings.
- **Projects / Folders & Thread Persistence (`AddProjectDialog.tsx`, `LeftSidebar.tsx`, `/api/threads`)**: Group chats by project, auto-title new chats, search threads (`SearchDialog.tsx`), fork/rewind sessions, and migrate legacy threads (`ThreadMigration.cs`).
- **Rich Message Rendering (`MarkdownRenderer.tsx`, `RequestStatusLine.tsx`)**: Syntax-highlighted code blocks, collapsible reasoning/thinking blocks, live phase/token/TPS telemetry (`reading_message` -> `searching_documents` -> `using_tool` -> `writing_answer` -> `done`), and clickable workspace file links.
- **Image & Document Attachments (`src/lib/attachments.ts`, `vaultStorage.ts`)**: Drag-and-drop or attach images (persisted in IndexedDB) and local documents (PDF, DOCX, CSV, JSON, Markdown, source code) directly into chat.
- **Keyboard Shortcuts (`SettingsShortcuts.tsx`)**: `Ctrl+B` (left sidebar), `Ctrl+\` (right viewer panel), `Ctrl+P` (quick-open file), `Ctrl+W` (close viewer tab), `Ctrl+Tab` (next viewer tab), `Ctrl+Shift+E` (focus file tree).
- **Appearance & Theme Controls (`SettingsAppearance.tsx`, `src/lib/appearance.ts`)**: Theme and visual customization.

---

## 4. Headless Agent Harness & CLI (`tools/native/harness/`)
- **Dual Transports (`HarnessServer.cs`)**:
  - **Trusted Channel**: User-ACL Windows Named Pipe (`\\.\pipe\SanctumHarness-<sid>-<hash>`).
  - **Loopback HTTP + SSE**: `http://127.0.0.1:<port>/v1/*` with `Authorization: Bearer <token>` (user-ACL `runtime.json`) and DNS-rebinding `Host` / `Origin` enforcement.
- **CLI Commands (`HarnessCli.cs`)**:
  - `Sanctum-Desktop.exe --harness --data-dir "<dir>" [--provider ollama|openai-local|mock] [--base-url <loopback>] [--port 0]`
  - `Sanctum-Desktop.exe run "<task>" --workspace . --model <model> [--mode plan|build] [--autonomy ask_all|auto_reads] [--json]`
  - `Sanctum-Desktop.exe sessions` / `resume <sessionId>` / `attach <sessionId> [--after N] [--json]`
- **Protocol v1 Session & Run Controls (`HarnessServer.cs`, `AgentLoop.cs`)**:
  - Hash-chained durable JSONL event log (`SessionLog.cs`), crash recovery on startup, large-output blob offloading (`/v1/blobs/:id`), idempotency key deduplication, single-writer `409 Conflict` guard, loop detection, step/token/wall-time budgets.
  - Endpoints: `/v1/hello`, `/v1/tools`, `/v1/network/{policy,offline,features,ledger,ledger/export}`, `/v1/migration/notices`, `/v1/capabilities/:model`, `/v1/sessions`, `/v1/sessions/:id`, `/v1/sessions/:id/events`, `/v1/sessions/:id/messages`, `/v1/sessions/:id/{interrupt,mode,autonomy,model,fork,compact,context,checkpoints,diff,rewind,tasks,todos,verify,subagents,worktree,mentions}`.
  - Data portability: `/v1/export`, `/v1/import`, `/v1/erase-all`.

---

## 5. Built-in Agent Tools & Multi-Agent Orchestration
- **Workspace File Tools (`BuiltinTools.cs`, `/api/tools/execute`)**:
  - `list_directory`, `read_file`, `read_file_range`, `search_files`, `create_file`, `edit_file`, `create_directory`, `delete_path` (soft-delete to recoverable `tool-trash`), `present_file` (opens file in right viewer panel).
- **Shell & Terminal Execution (`BuiltinTools.cs`, `InteractiveTerminal.tsx`, `/api/terminal/execute`)**:
  - `run_command` (PowerShell execution evaluated against `PermissionEngine.EvaluateCommandRule`) and background task runner (`/v1/sessions/:id/tasks`, `/v1/tasks/:id/{output,kill}`).
- **Planning, Verification & Multi-Agent Tools (`AgentOrchestration.cs`, `agent_workflows.ts`, `WorkspaceTools.tsx`)**:
  - **Auto vs Plan Mode**: Plan mode writes `PLAN.md`, opens it via `present_file`, and pauses for `[Approve & Execute]` (`WorkspacePendingPlanBanner`).
  - **Auto-Verify**: Infers safe local verification commands for modified `.py`, `.js`, `.mjs`, `.cjs`, `.ts` scripts (`/v1/sessions/:id/verify`).
  - **Subagents & Git Worktrees**: `spawn_subagent` runs scoped child sessions (`/v1/sessions/:id/subagents`, `/v1/agents`) with optional isolated per-session git worktrees (`WorktreeManager`, `sanctum/wt-<id>`, `/v1/worktrees`).
  - **Structured Context & Planning**: `todo_write`, `todo_read`, `repo_map`, `@file` mention resolution (`ContextEngine.cs`), and context compaction (`/v1/sessions/:id/compact`).
- **Memory, Vault & Utility Tools (`BuiltinTools.cs`, `memory_store.ts`, `/api/memory`)**:
  - `memory_save`, `memory_recall` (2-tier core + episodic memory scoped by workspace), `vault_search`, `calculator`, `datetime`.

---

## 6. Workspace File Viewer, Checkpoints & IDE Handoff
- **Artifact Viewer Panel (`ArtifactViewerPanel.tsx`, `FileContentRenderer.tsx`)**:
  - Multi-tab bar (reorder, middle-click close, dirty indicator), breadcrumb, `Preview`/`Raw` toggle, live edit + save with automatic checkpoint.
  - Sandboxed renderers: sanitized Markdown with TOC + syntax highlighting, `<iframe sandbox="">` HTML/SVG with strict CSP (no `allow-same-origin`), line-numbered source code, collapsible JSON tree, formatted CSV table, images (zoom/fit), HTTP `206 Range` audio/video streaming (`/api/fs/raw`), PDF viewer (`pdf.worker.min.mjs`), binary hex preview.
- **Workspace File Tree (`WorkspaceFileTree.tsx`, `/api/fs/{tree,read,raw,write,events,reveal,open-external}`)**:
  - Lazy-loaded directories, filter input, toggleable ignored dirs, live `FileSystemWatcher` updates over `/api/fs/events`, context menu (`Open`, `Copy Path`, `Reveal in Explorer`, `Rename`, `Delete` to `tool-trash`).
- **Checkpoints, Per-Hunk Diff Review & Rewind (`CheckpointDrawer.tsx`, `DiffReviewModal.tsx`, `DiffPreviewModal.tsx`, `/api/checkpoints`)**:
  - Pre-tool workspace snapshots, unified diffs, per-hunk accept/reject, full workspace rewind, and conversation+workspace rewind.
- **Workspace Header Actions (`WorkspaceHeaderActions.tsx`, `ComposerWorkspacePicker.tsx`, `AccessScopeBadge.tsx`)**:
  - Folder switcher (`/api/workspace`), active scope badge, **Open IDE** split button (`/api/ide/detect`, `/api/ide/open` with workspace/file/line handoff), and **Deliverables** popover with one-click **Export as ZIP** (`/api/fs/export-zip`).

---

## 7. Sandboxed Browser Agent (`packs/browser-agent/`, `DesktopBrowserEndpoints.cs`)
- **Optional `browser-use` Pack**: Uses system Microsoft Edge or Google Chrome in an isolated profile (`%LOCALAPPDATA%\Sanctum\browser-profile`) and isolated Python venv with telemetry hard-disabled.
- **Live Browser Viewer Tab (`BrowserAgentTab.tsx`, `/api/browser/{status,pack,domain,control,action}`)**:
  - Live URL bar, viewport screenshots, step log, and interactive `Pause` / `Take Over` / `Resume` / `Stop` controls.
- **Network & Prompt-Injection Security (`browser_policy.ts`, `DesktopBrowserEndpoints.cs`)**:
  - Hard-blocks `file://`, `javascript:`, `data:`, `chrome://`, `edge://`, Sanctum/Ollama ports, cloud metadata `169.254.169.254`, RFC1918 private IPs, IPv6 loopback/link-local/ULA, and DNS rebinding across redirects.
  - Per-domain allowlist (`Allow once`, `Allow for session`, `Always allow`, `Block`), explicit localhost port allowlist, single-use `X-Sanctum-Approval` gates for password/card typing, `POST` form submits, and downloads (`<workspace>/downloads/`), plus `<untrusted_web_content>` isolation.

---

## 8. Offline Documents, Hybrid RAG & Local OCR
- **Local Hybrid RAG (`core/ai/rag/vectorStore.ts`, `ingest.ts`, `retrieval.ts`, `ragSlice.ts`)**:
  - Local document collections with Hybrid Dense + BM25 Reciprocal Rank Fusion (RRF) retrieval injected into chat when enabled.
- **Offline OCR (`core/ai/ocr/ocr_engine.py`, `ocr_server.py`, `OcrModelSelector.tsx`, `/api/ocr`, `/api/ocr/models`, `/api/ocr/download`)**:
  - Automatic Windows built-in offline OCR fallback for scanned PDFs plus optional local `PaddleOCR-VL-1.6` sidecar model downloader.

---

## 9. Local Speech-to-Text (Voice Dictation)
- **Local STT Models (`core/ai/speech/stt_download.py`, `whisperx_server.py`, `SttModelSelector.tsx`, `/api/audio/{models,download,whisperx,transcribe}`)**:
  - Built-in Windows dictation + downloadable local models: **Qwen3-ASR-0.6B** (light/multilingual) and **NVIDIA Nemotron 3.5 Transcribe** (high accuracy), plus custom OpenAI-compatible STT endpoint option.

---

## 10. MCP Servers, Extensions & Scheduled Jobs
- **MCP Server Integration (`Extensibility.cs`, `DesktopMcpEndpoints.cs`, `SettingsMcp.tsx`, `McpQuickToggle.tsx`, `/v1/mcp/servers`, `/api/mcp`)**:
  - Windows Job-Object supervised stdio MCP servers (auto-killed on exit, zero orphan processes) with JSON-RPC 2.0 `initialize`, `tools/list` (`mcp:<id>:<tool>`), `tools/call`, restart, and trusted-channel first-run approval.
  - Also supports remote/hosted MCP connectors and quick toggle from chat.
- **Workspace Extensions (`.sanctum/`, `Extensibility.cs`, `/v1/extensions`, `/v1/extensions/hooks/approve`)**:
  - Auto-loads `AGENTS.md`, `.sanctum/AGENTS.md`, `.sanctum/rules/*.md` into system context.
  - Discovers `.sanctum/agents/*.md`, `.sanctum/skills/*/SKILL.md`, `.sanctum/commands/*.md`, `packs/*/manifest.json`.
  - Discovers `.sanctum/hooks.json` disabled by default until approved via trusted channel.
- **Unattended Scheduler (`Extensibility.cs`, `/v1/schedules`, `/v1/schedules/:id/run`)**:
  - Scheduled agent jobs running fail-closed (`unattended: true`, `Ask` -> `Deny` immediately); job creation/deletion gated by trusted channel.

---

## 11. Security, Permissions, System Monitor & Diagnostics
- **Single-Enforcement-Point Permission Engine (`PermissionEngine.cs`, `ToolApprovalModal.tsx`, `/v1/approvals/:id`, `/v1/rules`)**:
  - Single-use approvals cryptographically bound to `(approvalId, sessionId, runId, callId, canonicalArgsSha256)`.
  - High-risk operations (non-allowlisted shell `exec`, destructive deletes, persistent permission rules, `full_auto` autonomy, MCP server registration, workspace hooks, scheduled jobs, disabling Offline mode, enabling network features) enforce trusted channel or native `X-Sanctum-Approval` tokens.
  - Path traversal/symlink escape protection (`ResolveToolPath`) and untrusted content wrapping (`UntrustedContent.Wrap`, `/v1/untrusted/wrap`).
- **System Monitor (`SettingsMonitor.tsx`, `DesktopServices.cs`, `/api/system`)**: Live Windows CPU, RAM, and GPU telemetry.
- **Audit & Diagnostic Logs (`SettingsLogs.tsx`, `/v1/audit`, `/api/audit/logs`, `/api/logs`, `/api/logs/query`, `/api/logs/diagnose`, `/api/reset`)**: Redacted host audit log, searchable JSONL diagnostic logs, capability live-test runner (`/api/capabilities/test`), and factory reset.
