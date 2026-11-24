# Sanctum Harness Event Protocol v1 (`PROTOCOL.md`)

> Version: `1` (`GET /v1/hello` -> `"protocolVersion": 1`)
> Serialization: `Newtonsoft.Json` (UTF-8, no BOM). `JavaScriptSerializer` is never used.

## 1. Transports & Security

| Client | Transport | Auth & Defense |
|---|---|---|
| CLI & Native Bridge | Windows Named Pipe `\\.\pipe\SanctumHarness-<userSid>-<dirHash>` | User-only `PipeSecurity` ACL (`WindowsIdentity.GetCurrent().User`); trusted channel for high-risk actions |
| WebView & Local API | Loopback HTTP `http://127.0.0.1:<port>/v1/*` | `Authorization: Bearer <token>` (from user-ACL `runtime.json`), strict `Host` check (`127.0.0.1:<port>` / `localhost:<port>`), strict `Origin` check (`https://sanctum.app` or absent; foreign `Origin` -> `403`) |

Discovery file: `%APPDATA%\Sanctum\runtime.json` (user-only ACL):
```json
{
  "pid": 12345,
  "pipeName": "SanctumHarness-a1b2c3d4e5-12345678",
  "httpPort": 54321,
  "token": "<64-hex-chars>",
  "startedAt": "2026-11-21T16:30:00Z",
  "protocolVersion": 1
}
```

## 2. Commands

| Method & Path | Body / Params | Notes |
|---|---|---|
| `GET /v1/hello` | — | Handshake: returns `protocolVersion`, `harnessVersion`, `pid`, `capabilities`, `transports`, `authMode` |
| `GET /v1/tools` | — | Lists registered tools with JSON schema, safety class, timeout, output cap |
| `POST /v1/sessions` | `{ title?, workspace?, mode?, autonomy?, model? }` | Creates session (`201`). `autonomy` cannot be `full_auto` over HTTP bearer |
| `GET /v1/sessions` | — | Lists all sessions derived from `sessions/*.jsonl` |
| `GET /v1/sessions/:id` | — | Returns `{ session, events }` (resolving parent fork chain) |
| `POST /v1/sessions/:id/messages` | `{ content, idempotencyKey?, budgets? }` | Starts run (`202`). Rejects with `409 Conflict` (`run_in_progress`) if a run is already active on this session |
| `POST /v1/sessions/:id/interrupt` | `{ idempotencyKey? }` | Cancels active run (`CancellationTokenSource` + child process kill) |
| `POST /v1/sessions/:id/mode` | `{ mode: "plan" \| "build" }` | Updates session mode |
| `POST /v1/sessions/:id/autonomy` | `{ autonomy: "ask_all" \| "auto_reads" \| "full_auto" }` | `full_auto` requires trusted channel (Named Pipe / native dialog); HTTP bearer returns `403` (`trusted_channel_required`) |
| `POST /v1/sessions/:id/model` | `{ model }` | Switches session model |
| `POST /v1/sessions/:id/fork` | `{ forkAfterSeq, title? }` | Reference-based O(1) fork (`201`) storing `{ parentSessionId, forkAfterSeq }` |
| `GET /v1/sessions/:id/events?after=<seq>` | — | SSE stream: replays durable events `seq > after`, then streams live events. Bounded 256-event buffer; slow clients receive `event: slow_consumer` and reconnect via `?after=<lastSeq>` |
| `GET /v1/blobs/:sha256` | — | Reads offloaded large tool output (> 16 KiB, capped at 4 MiB) |
| `GET /v1/workspaces` | `?includeArchived=true` | Lists workspaces with `id`, `name`, `color`, `icon`, `rootPath`, `rootStatus`, `settingsOverrides` |
| `POST /v1/workspaces` | `{ name, rootPath?, color?, icon?, copySettingsFromId?, settingsOverrides? }` | Creates workspace (`201`); validates canonical root (`409 workspace_root_overlap` on overlap) |
| `POST /v1/workspaces/validate-root` | `{ rootPath, excludeWorkspaceId? }` | Canonicalizes path (symlinks/junctions/8.3), checks blocked roots/overlaps, returns cloud-sync warnings |
| `POST /v1/workspaces/:id/{rename,relocate,archive}` | `{ name }` / `{ rootPath }` / `{ archived }` | Updates workspace metadata or relocates missing root |
| `POST /v1/workspaces/:id/delete` | `{ confirmName }` | **Trusted channel only** + exact typed-name match; deletes only `%APPDATA%\Sanctum\workspaces\<id>`, never user folder |
| `GET/POST /v1/workspaces/:id/ui-state` | `{ activeSessionId, splitSessionId, projects, viewerTabs, ... }` | Host-persisted per-workspace UI state |
| `GET/POST/DELETE /v1/workspaces/:id/vault*` | `{ title, collection, content }` / `{ query }` | Workspace-isolated Document Vault storage & search |
| `POST /v1/workspaces/transfer` | `{ kind: "memory"\|"vault", sourceWorkspaceId, targetWorkspaceId, itemId }` | **Trusted channel only** cross-workspace transfer/share |
| `GET /v1/workspaces/:id/export` & `POST /v1/workspaces/import` | bundle JSON | Portable export/import of Sanctum data only (never user project files) |
| `GET /v1/attention` | — | Global attention inbox + per-workspace `runningCount` & `attentionCount` |

- **Workspace Ownership Enforcement**: `GET /v1/sessions` filters by `workspaceId` (defaulting to last-used workspace) unless `allWorkspaces=true` is explicitly passed. Every `/v1/sessions/:id/*` command verifies caller-supplied `workspaceId` (query, body, or `X-Sanctum-Workspace` header) against `session.workspaceId` (`403 workspace_mismatch`).

## 3. Event Envelope & Session Log Format

Every durable event in `%APPDATA%\Sanctum\sessions\<sessionId>.jsonl`:
```json
{
  "payload": { "stopReason": "completed", "elapsedMs": 12, "totalTokens": 64 },
  "runId": "r_0123456789ab",
  "seq": 9,
  "sessionId": "s_abcdef012345",
  "sha256": "<SHA256(prevSha256 + '\n' + canonicalJsonWithoutSha256)>",
  "ts": "2026-11-21T16:30:01.234Z",
  "type": "run_finished",
  "v": 1
}
```
- **Canonical JSON**: `Newtonsoft.Json` `Formatting.None`, object keys sorted lexicographically by ordinal UTF-16 code unit, UTF-8 without BOM.
- **Corruption detection**: The hash chain detects disk corruption and partial-write truncation (quarantining corrupt trailing lines to `.corrupt.<ts>.bak`); it does **not** defend against local tampering by a process with write access to `%APPDATA%\Sanctum`.
- **Delta coalescing**: `message_delta` and `reasoning_delta` stream live over SSE (`seq: 0`); periodic partial checkpoints persist every 2 s / 4 KiB, with durable `Flush(true)` on message, tool, and run boundaries.
- **Redaction**: API keys and Bearer tokens are redacted before persisting to JSONL or blobs.

## 4. CLI Usage (Phase 1a)
```bash
Sanctum-Desktop.exe --harness --data-dir <dir> [--port <n>] [--mock-script <path>]
Sanctum-Desktop.exe run "<task>" --mode plan|build --autonomy ask_all|auto_reads --workspace <path> --json
Sanctum-Desktop.exe sessions --json
Sanctum-Desktop.exe resume <sessionId>
Sanctum-Desktop.exe attach <sessionId> [--after <seq>] --json
```
