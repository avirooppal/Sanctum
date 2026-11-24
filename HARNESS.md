# Sanctum Agent Harness

Sanctum's Agent Harness is a headless, model-agnostic runtime embedded in `Sanctum-Desktop.exe` (.NET Framework 4.7.2, compiled offline with vendored Roslyn 5.12.0 + `Newtonsoft.Json` 13.0.4). It owns all agent state, tool execution, session logs, permissions, context, MCP servers, extensions, and scheduling. The desktop workspace UI, quick-launch popup, CLI, scheduler, and local API are all thin clients over Protocol v1.

## Transports & Auth
- **Trusted Channel (CLI / Native)**: User-ACL Windows Named Pipe (`\\.\pipe\SanctumHarness-<sid>-<hash>`).
- **Loopback HTTP + SSE (UI / Local API)**: `http://127.0.0.1:<port>/v1/*`, authenticated via `Authorization: Bearer <token>` (read from `%APPDATA%\Sanctum\runtime.json`, user-only ACL) with strict `Host` and `Origin` checks to block DNS rebinding.
- **Window-Close Survival**: Closing the WebView window hides it to the system tray while active runs continue in the host; reopening reattaches via `GET /v1/sessions/:id/events?after=<seq>`.

## Approval Trust Model (Single Enforcement Point)
- **Low-risk** (workspace file edits, read-class tools): resolvable over HTTP bearer or trusted channel.
- **High-risk** (non-allowlisted shell `exec`, destructive deletes, creating any persistent `permission_rules.json` rule, switching autonomy to `full_auto`, registering/enabling MCP servers, enabling workspace hooks, creating scheduled jobs): **trusted channel ONLY** (Named Pipe / CLI TTY / native dialog). HTTP bearer returns `403 trusted_channel_required`.
- **Shell Confinement Limit**: `run_command` is evaluated via the PowerShell AST (`System.Management.Automation.Language.Parser`) and runs under a per-command Windows Job Object (1 GB memory cap, 16-process limit, kill-on-close, stripped secret env vars, output cap). However, **`workspace_only` does not OS-sandbox shell commands** (Windows Sandbox / Low-Integrity token is not viable without breaking workspace writes or requiring Hyper-V); treat `full_auto` accordingly.
- **Call Binding**: approvals are single-use and bound to `(approvalId, sessionId, runId, callId, canonicalArgsSha256)`.
- **Unattended Policy**: scheduled and `unattended: true` sessions fail closed (`Ask` -> `Deny` immediately).

## CLI Commands
```powershell
# Start headless daemon (strictly local providers: ollama, openai-local, mock)
Sanctum-Desktop.exe --harness --data-dir "<dir>" [--provider ollama|openai-local|mock] [--base-url http://127.0.0.1:1234/v1] [--port 0]

# Run a task (auto-starts daemon if needed)
Sanctum-Desktop.exe run "Summarize src/" --workspace . --model qwen3:1.7b --json

# Manage and reattach to sessions
Sanctum-Desktop.exe sessions
Sanctum-Desktop.exe resume <sessionId>
Sanctum-Desktop.exe attach <sessionId> --after 0 --json
```

## Protocol v1 Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/hello` | `GET` | Version handshake & capabilities |
| `/v1/tools` | `GET` | Registered builtin + MCP tools |
| `/v1/capabilities/:model` | `GET` | Live model capabilities from provider |
| `/v1/sessions` | `GET`, `POST` | List or create sessions (`mode`, `autonomy`, `unattended`) |
| `/v1/sessions/:id` | `GET` | Session summary + full hash-chained event log |
| `/v1/sessions/:id/events?after=N` | `GET` | Replay + live SSE stream |
| `/v1/sessions/:id/messages` | `POST` | Start run (single-writer `409`, `idempotencyKey` dedupe) |
| `/v1/sessions/:id/{interrupt,mode,autonomy,model,fork,compact}` | `POST` | Run/session control (`full_auto` requires trusted channel) |
| `/v1/sessions/:id/{checkpoints,diff,rewind,tasks,todos,verify,subagents,worktree,mentions}` | `GET`/`POST`/`DELETE` | Checkpoints, unified diff, rewind, background tasks, todos, verifier, subagents, git worktrees |
| `/v1/approvals/:approvalId` | `POST` | Resolve pending call-bound approval |
| `/v1/rules` | `GET`, `POST` | List/create persistent permission rules (POST: trusted only) |
| `/v1/audit` | `GET` | Recent redacted host audit log entries |
| `/v1/agents`, `/v1/worktrees` | `GET` | Agent manager data model & active worktrees |
| `/v1/mcp/servers` | `GET`, `POST` | List/register Job-Object stdio MCP servers (POST: trusted only) |
| `/v1/mcp/servers/:id/{discover,restart}` | `POST` | Discover MCP tools (`mcp:<id>:<tool>`) or restart server |
| `/v1/extensions`, `/v1/extensions/hooks/approve` | `GET`, `POST` | Discover `.sanctum/` agents/skills/commands/hooks/packs; approve hooks (trusted only) |
| `/v1/schedules`, `/v1/schedules/:id/run` | `GET`, `POST`, `DELETE` | Manage & trigger fail-closed `unattended: true` scheduled jobs |
| `/v1/network/policy`, `/v1/network/offline`, `/v1/network/features` | `GET`, `POST` | Inspect/update host egress allowlist & global Offline mode (disabling Offline / enabling features: trusted only) |
| `/v1/network/ledger`, `/v1/network/ledger/export` | `GET` | Read & export redacted append-only non-loopback egress ledger |
| `/v1/migration/notices`, `/v1/migration/notices/dismiss` | `GET`, `POST` | One-time migration notices (e.g. cloud provider removal) |

## Workspace Extensions (`.sanctum/`)
- `AGENTS.md`, `.sanctum/AGENTS.md`, `.sanctum/rules/*.md`: auto-loaded as untrusted workspace instructions.
- `.sanctum/agents/*.md`, `.sanctum/skills/*/SKILL.md`, `.sanctum/commands/*.md`, `packs/*/manifest.json`: discovered via `/v1/extensions`.
- `.sanctum/hooks.json`: discovered disabled by default until approved via trusted channel.
