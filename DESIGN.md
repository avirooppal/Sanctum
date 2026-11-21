# Sanctum Agent Harness — Architecture & Migration Design (Phase 0, Rev 2)

> **Status**: Rev 2 updated with security hotfix (`278a554`) and review items 1–8. Awaiting sign-off on **§3.2 Toolchain & JSON** and **§6.4 Approval Trust Model** before starting Phase 1a.
> **Goal**: Re-architect Sanctum into a headless, model-agnostic **host-side agent harness** that owns all agent state, execution, tools, context, and security enforcement. Main window, quick-launch popup, CLI, scheduler, and local API become thin protocol clients.

---

## 1. Precondition & Security Gate Audit

Verified directly against `tools/native/DesktopHost.cs`, `DesktopWorkspaceEndpoints.cs`, `DesktopBrowserEndpoints.cs`, and `DesktopMcpEndpoints.cs`:

| Precondition | Status | Evidence |
|---|---|---|
| Host-side permission gate (`X-Sanctum-Approval`) | **Merged (Closed in `278a554`)** | Single-use tokens enforced on settings, workspace change, terminal `ask` commands, file writes/deletes, IDE open, browser sensitive actions, **and** (`278a554`) `POST /api/mcp` (`mcp_config`), `POST /api/mcp/call` (`mcp_call`), and `POST`/`DELETE /api/memory` (`memory_write`), with 403 fail-closed + audit log + 4/4 regression tests (`tests/hotfix_host_approval_gates.test.ts`). |
| Command rules (`deny`/`ask`/`allow`) | **Merged** | `EvaluateCommandRule` enforced in `DesktopHost.cs:2403` + `core/infra/security/command_matcher.ts`. |
| `ToolPath` scope & hard-blocked paths | **Merged** | `ToolPath` (`DesktopHost.cs:2170-2260`) enforces `workspace_only` default, symlink/junction (`ReparsePoint`) block, `ResolveCanonicalRealPath`, `IsHardBlocked`, and audit logging. |
| Settings merge + validation | **Merged** | `HandleSettings` (`DesktopHost.cs:3156-3228`) merges into existing JSON, runs `ValidateSetting`, writes atomically, requires `settings_write` token. |
| Zero-install / offline-first base | **Verified** | `Sanctum.exe` is `4.60 MB` (`.NET Framework 4.7.2` + WebView2 static bundle). Zero user runtime installs. |

---

## 2. Current-State Inventory (Keep / Port / Delete)

| Component | Current Location | LOC | Disposition |
|---|---|---|---|
| C# Desktop Host, Job Object, WebView2, Auth | `tools/native/DesktopHost.cs`, `DesktopServices.cs` | 3,837 | **Keep & Refactor** into host + headless harness service |
| C# Workspace, Browser, MCP Endpoints | `tools/native/Desktop{Workspace,Browser,Mcp}Endpoints.cs` | 4,204 | **Port** into Harness Tool Registry & State Services |
| Page-side Agent Loop & Tool Dispatch | `core/ai/tools/workspace_chat.ts` | 1,184 | **Port to Host -> Delete in Phase 5** |
| Tool Parsing, Scheduler, Permissions, Schema | `core/ai/tools/{parse_calls,scheduler,permission_gate,permissions,executor,schema,types}.ts` | 1,586 | **Port logic to Host**; shared JSON fixtures/oracle for CI parity |
| Security & Infra TS Modules | `core/infra/{security,checkpoints,diff,hooks,logs,storage}/*` | ~2,100 | **Keep** for Node contract/fuzz/oracle tests; host C# is single enforcement point |
| Synthetic/Duplicated Agent UI State | `src/store/slices/agentSlice.ts` (`buildFallbackSteps` fake steps!) | 548 | **Delete in Phase 5** (replace with protocol-driven view) |
| Chat & Model Zustand + `localStorage` | `src/store/slices/chatSlice.ts`, `useAppStore.ts` | 1,220 | **Rewire** as thin SSE/HTTP projection; remove `localStorage` chat/agent state in Phase 5 |
| Next.js Duplicate API Routes | `src/app/api/*` (37 routes) | ~2,800 | **Keep dev proxy** to headless harness in Phase 1–4; **Delete duplicated Node execution paths** in Phase 5 |
| Optional Packs | `packs/{browser-agent,speech,rag,research,agents}/pack.json` | — | **Keep & Formalize** under Pack Manifest schema (Phase 4) |

---

## 3. Process Model, Toolchain & Daemon Lifecycle

### 3.1 Runtime Choice
**(a) C# Harness Core inside `Sanctum-Desktop.exe` (`.NET Framework 4.7.2`, modular `tools/native/harness/*.cs`)** over (b) bundled Node/Bun runtime:
- Keeps `Sanctum.exe` under **5 MB** (vs ~38 MB with bundled Node/Bun), zero user install, lowest Defender/SmartScreen AV risk, ~45 MB idle RAM, and a **single in-process enforcement boundary** with `ToolPath`/`EvaluateCommandRule`/`JobObject`.

### 3.2 Toolchain & JSON Library (Revised — Item 2)
- **Compiler**: Vendor **`Microsoft.Net.Compilers.Toolset` v5.12.0** (License: **MIT**, NuGet `.nupkg` 22.3 MB) into `vendor/roslyn/` (committed for reproducible offline builds; **build-time only -> 0 bytes added to `Sanctum.exe`**). Compiles modern C# (`LangVersion=12.0` targeting `net472`) while emitting pure `.NET Framework 4.7.2` IL so end users install zero runtimes.
- **JSON Library** (`JavaScriptSerializer` is **forbidden** for protocol and session log):

| Option | Version & License | `net472` Dependencies | Raw / Compressed Impact on `Sanctum.exe` | Verdict |
|---|---|---|---|---|
| **`Newtonsoft.Json`** | **13.0.4** (MIT) | **0** (`lib/net45` self-contained) | ~712 KB raw / **+~250 KB** compressed (`4.60 MB -> ~4.85 MB`) | **RECOMMENDED** — zero binding-redirect risk, streaming `JsonTextReader`/`JsonTextWriter`, `JToken`, deterministic sorted-key canonical JSON |
| `System.Text.Json` | 11.0.0 (MIT) | **8 transitive packages** (`Microsoft.Bcl.AsyncInterfaces`, `System.IO.Pipelines`, `System.Text.Encodings.Web`, `System.Buffers`, `System.Memory`, `System.Runtime.CompilerServices.Unsafe`, `System.Threading.Tasks.Extensions`, `System.ValueTuple`) | ~1.6 MB raw / +~600 KB compressed + `app.config` binding redirects | Rejected — unnecessary DLL/redirect complexity on `net472` |
| Minimal in-house | N/A | 0 | 0 KB, ~600 LOC | Rejected — high edge-case/fuzz risk on Unicode surrogates, escaping, numbers |

### 3.3 Daemon Lifecycle (Revised — Item 7)
- **Single-instance**: Named OS mutex `Local\SanctumHarness-<userSid>`.
- **Discovery & Crash Cleanup**: Host writes `%APPDATA%\Sanctum\runtime.json` (user-only ACL) containing `{ pid, pipeName, httpPort, token, startedAt, protocolVersion }`. On startup or CLI attach: verify `pid` is alive AND `GET /v1/hello` succeeds; if either fails, atomically delete stale `runtime.json` and auto-start `Sanctum-Desktop.exe --headless`.
- **Idle Exit Policy**: When no UI window is open, no active runs, no active background tasks, and no enabled scheduled jobs exist, the daemon exits cleanly after a **60 s grace period** (unless `general.startWithWindows` / keep-resident is enabled).
- **Tray & Shutdown**: System tray icon displays active run count, pending high-risk approval badge, background task count, and Open/Quit actions. On explicit Quit: warn if runs/background tasks are active; cancel active runs, write `run_finished(interrupted)` to their logs, and terminate all child processes via the Windows Job Object.

---

## 4. Event Protocol v1 (Revised — Item 6)

- **Transports**:
  - **CLI & Native Bridge**: **Windows Named Pipe** (`\\.\pipe\SanctumHarness-<userSid>`) with user-only `PipeSecurity` ACL (OS-enforced user identity, zero TCP port exposure, no port conflicts).
  - **WebView & Documented Local API**: Loopback HTTP (`http://127.0.0.1:<port>/v1/*`) with `Authorization: Bearer <token>`, strict **`Host`** check (`127.0.0.1:<port>` or `localhost:<port>`) and strict **`Origin`** check (`https://sanctum.app` for WebView, absent for non-browser local API clients; any foreign `Origin` -> `403`) to block DNS rebinding.
- **Handshake & Capabilities**: `GET /v1/hello` returns `{ protocolVersion: 1, harnessVersion, capabilities: [...], transports: ["pipe","http"], authMode }`.
- **Idempotency**: Mutating commands (`send_message`, `approve`, `interrupt`) accept `idempotencyKey` (deduplicated per session over an LRU window of 512 keys) so reconnect retries never duplicate runs or approvals.
- **Single Writer per Session**: **Reject** with `409 Conflict` (`{ code: "run_in_progress", activeRunId }`) if a second client calls `send_message` while a run is active on that session (client must `interrupt` first or `fork`).
- **Backpressure**: Bounded per-client SSE buffer (**256 events**). If a slow client falls behind, the host closes its SSE stream cleanly with a `slow_consumer` terminal frame; the client reconnects with `GET /v1/sessions/:id/events?after=<lastSeq>` to catch up from the session log.
- **Mode vs Autonomy (Separated)**:
  - `POST /v1/sessions/:id/mode` (`set_mode`): `plan | build`.
  - `POST /v1/sessions/:id/autonomy` (`set_autonomy`): `ask_all | auto_reads | full_auto`. Raising autonomy to `full_auto` is a **high-risk action** gated by the native/TTY trust channel (§6.4).
- **Commands**: `create_session`, `list_sessions`, `resume`, `send_message`, `interrupt`, `approve`/`deny`, `set_mode`, `set_autonomy`, `set_model`, `fork`, `rewind`, `compact`, `start_background_task`, `list_tools`.
- **Events (append-only, replayable by `seq`)**: `session_started`, `message_delta`, `reasoning_delta`, `tool_call_requested`, `approval_requested`, `approval_resolved`, `tool_started`, `tool_output`, `tool_finished`, `file_changed`, `todo_updated`, `plan_ready`, `artifact_created`, `context_usage`, `compaction`, `error`, `run_finished` (`stopReason`: `completed | interrupted | max_steps | max_tokens | max_wall_time | loop_detected | approval_denied | error`).

---

## 5. Session Log Format & Data Ownership (Revised — Items 3 & 4)

- **Storage & ACL**: `%APPDATA%\Sanctum\sessions\<sessionId>.jsonl` + `%APPDATA%\Sanctum\sessions\blobs\<sha256>.bin`. Directory created with **user-only Windows ACL** (`WindowsIdentity.GetCurrent().User`, inheritance disabled). Included in **Erase all data** (`/api/reset`) and **Export/Import** portable archives.
- **Delta Coalescing & Flush Policy**: `message_delta` and `reasoning_delta` stream live over SSE **without** a durable write per token. The host persists periodic partial checkpoints (every 2 s or 4 KiB) and performs a durable `Flush(true)` on **message boundaries**, **tool call/result boundaries**, and **run completion/interruption**.
- **Canonical JSON & Hash Chain**: Each record is serialized with `Newtonsoft.Json` (`Formatting.None`, object keys sorted lexicographically by ordinal UTF-16 code unit, UTF-8 no BOM); `sha256 = SHA256(prevSha256 + "\n" + canonicalRecordWithoutSha256)`. **Scope**: this hash chain detects **disk corruption and partial-write truncation**; it does **not** defend against tampering by a local process that already has write access to `%APPDATA%\Sanctum`.
- **Secrets Redaction & Large Blobs**: All records and tool outputs pass through host `RedactSecrets` **before** writing. Tool outputs exceeding **16 KiB** are written to size-capped blob files (`sessions/blobs/<sha256>.bin`, hard cap 4 MiB) and referenced from the log (`{ blobRef, bytes, truncated }`); old unreferenced blobs are pruned per `sessions.blobRetentionDays` (default 30).
- **Fork (Reference-Based)**: Forking at `seq = N` creates a new session whose `session_started` record references `{ parentSessionId, forkAfterSeq: N }` (O(1) fork, zero duplicated log/blob storage). Parent logs are append-only/immutable; deleting a parent tombstones its index entry while any child references it.
- **Migration & Data Ownership (Item 4)**: From Phase 1, the **host session store** is the sole owner of all new sessions. On first run, existing `threads.json` is backed up to `%APPDATA%\Sanctum\backups\threads-<ts>.json` and imported read-only into `sessions/` (never living in two writable stores). During the temporary UI adapter period (Phase 1c–4), **host store always wins**; `localStorage` is read-only fallback only prior to migration and never receives new chat/agent writes.

---

## 6. Core Subsystems & Approval Trust Model

1. **Agent Loop**: `assemble_context -> provider.stream_chat(tools) -> parse_tool_calls (JSON repair) -> permission_engine.evaluate -> execute (parallel reads / serialized writes) -> observe -> repeat`, with step/token/wall-time/per-tool budgets, loop detection, real cancellation (abort HTTP + Job Object kill), `plan`/`build` modes, and child-session Subagents.
2. **Provider Layer**: `IModelProvider` (`StreamChat`, `GetCapabilities`, `CountTokens`, `Embed`) with Ollama, llama.cpp/OpenAI-compatible, Deterministic Mock, and egress-gated Cloud adapters. Capabilities queried live from engine.
3. **Tool Registry**: Single execution path for all native, MCP (Job-Object supervised, first-run full-command approval, `<untrusted_mcp_content>`), and pack tools with JSON schema, safety class, timeout, and output cap.
4. **Approval Trust Model (Revised — Item 1)**:
   - **Low-risk channel (Page / Bearer API allowed)**: File edits inside workspace, read-class network tools.
   - **High-risk channel (Native WinForms modal dialog or CLI TTY ONLY — page cannot forge)**:
     - `exec` commands not on the read-only allowlist
     - Destructive deletes
     - Creating any `"always"` allow rule
     - Widening access scope (`workspace_only` -> `selected_folders` / `system_read`)
     - Switching autonomy to `full_auto`
     - Enabling a workspace MCP server or hook
     - Changing `privacy.allowCloudEgress`
   - **Rule Creation**: Always-rules can ONLY be created via the native/TTY channel. The page may *request* a rule; the host renders the exact scope natively and asks.
   - **Host-Generated Card Text**: Approval dialog/card text is rendered exclusively by the host from the actual parsed tool arguments — never from model- or page-supplied text.
   - **Call Binding**: Every approval is cryptographically bound to `(approvalId, sessionId, runId, callId, canonicalArgsSha256)` and single-use — an approval for call A cannot be replayed for call B. Unattended/scheduler runs fail closed on anything not pre-approved.
5. **Context Engine & State Services**: Token accounting, auto-compaction preserving pinned items, hierarchical `AGENTS.md`/rules (`global < parent < workspace`), `@file`/`@folder` via `ToolPath`, repo map, Memory/Vault retrieval with citations, checkpoints/rewind, diffs, `FileSystemWatcher`, background task manager, todo, artifacts, structured traces.

---

## 7. Extension Model & Clients

- **Extensions** (`global < workspace`): `.sanctum/agents/*.md`, `.sanctum/skills/<name>/SKILL.md`, `.sanctum/commands/*.md`, `.sanctum/hooks.json` (`pre_tool_use`, `post_tool_use`, `on_stop`, `on_session_start`; bounded timeout; gated by Permission Engine; workspace hooks require native approval), `mcp_servers.json` + `.sanctum/mcp.json` (workspace MCP requires native approval), `packs/<id>/pack.json`. Malformed extensions fail visibly without crashing the harness.
- **Clients**: Main Workspace UI, Quick-Launch Popup, CLI (`sanctum run|sessions|resume|attach`), Cron Scheduler, documented loopback Local API.

---

## 8. Phased Plan, Performance Budgets & Verification Matrix (Revised — Items 5 & 8)

- **Performance Budgets**: Session create `< 100 ms`; first SSE event to UI `< 50 ms`; idle host RSS `< 65 MB`; UI render `O(visible window)`.
- **Phase 1a**: Vendor Roslyn + `Newtonsoft.Json`, protocol + event types (`/v1/hello`, idempotency, single-writer `409`, backpressure), named pipe + loopback HTTP (`Host`/`Origin` guards + bearer auth), session log (coalescing, canonical JSON hash chain, redaction, blobs, user-only ACL, reference fork), deterministic mock provider, agent loop (budgets, cancellation), CLI (`run`/`sessions`/`resume`/`attach`). **No UI, no Ollama.** Golden-transcript tests + crash-kill recovery test + 2-client test + protocol/log fuzz tests.
- **Phase 1b**: Ollama provider with live capability queries, ported tools (file/shell/memory/vault/calculator) behind minimal deny-by-default Permission Engine matching today's host rules, model tool-call parser verified against a **shared JSON fixture corpus** generated from the TS oracle (`core/ai/tools/parse_calls.ts`: Qwen XML, Llama block, OpenAI, malformed JSON) in CI.
- **Phase 1c**: Temporary UI adapter in `chatSlice.ts` (**removal scheduled in Phase 5**), first-run read-only `threads.json` migration with backup, window-close survival and live reattach.
- **Phase 2**: Full rule-based Permission Engine + native WinForms/TTY high-risk trust channel (with page-bypass & replay-rejection tests, shared C#/TS table-driven rules tests), checkpoints/rewind, diffs, background tasks, audit log, secrets redaction, untrusted-content injection suite (files, web, MCP, clipboard, logs).
- **Phase 3**: Context engine (compaction, `AGENTS.md`/rules, repo map, `@mentions`), `plan`/`build` modes, todo, verifier, subagents, parallel worktree sessions, agent manager data model.
- **Phase 4**: Job-Object MCP client (first-run full-command approval), `.sanctum/` agents/skills/commands/hooks, pack manifests (browser-agent, speech), fully protocol-driven Workspace UI + Popup, Scheduler, Local API docs (`PROTOCOL.md`, `HARNESS.md`).
- **Phase 5**: Delete `core/ai/tools/workspace_chat.ts`, `agentSlice.ts`, dead Next.js duplicate execution routes, and `localStorage` chat/agent state; reversible migration test; final benchmark & deviation report.
