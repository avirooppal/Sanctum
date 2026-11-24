# Part A Design Doc — Sanctum Workspaces (`WORKSPACES_DESIGN.md`)

> Status: **Proposed (awaiting approval before implementation)**  
> Scope: C# host + harness (`tools/native/`), Next.js static UI (`src/`), CLI (`Sanctum-Desktop.exe`), Protocol v1 (`PROTOCOL.md`).

---

## 1. Precondition Audit & Reality Check
All required preconditions are **verified in source**:
- **Single chat path & harness-owned sessions**: `SessionLogStore` (`sessions/*.jsonl`) + `streamHarnessChat` (`tests/phase3_one_chat_path.test.ts`).
- **Trusted-channel approvals**: User-ACL Named Pipe + `MutatingRouteRegistry` + call-bound single-use approvals (`tests/phase2_trusted_channel_audit.test.ts`).
- **Egress ledger & Offline mode**: `EgressHttpFactory` + `/v1/network/*` (`tests/phase1_egress_ledger_and_offline.test.ts`, `tests/phase1_offline_proof.test.ts`).

**Corrections against prompt assumptions:**
1. **No existing quick-launch popup window**: `DesktopHost.cs` has only the main `Form` + `NotifyIcon` tray (no `RegisterHotKey` popup yet). Part A updates window title + tray menu and ships a reusable `WorkspaceChip` component; no phantom popup claim.
2. **Vault currently lives in client IndexedDB (`sanctum-vault-db`)**: To enforce host-layer isolation (Rule 2), canonical vault collections/documents move to host storage `%APPDATA%\Sanctum\workspaces\<id>\vault\` exposed via `/v1/workspaces/:id/vault/*`, with one-time reversible migration from `ragSlice`/IndexedDB.
3. **Command palette is `SearchDialog.tsx` (`Ctrl+K`)**: Workspace switch/create entries integrate into `SearchDialog.tsx`; new non-conflicting shortcut is **`Ctrl+Shift+W`** (existing: `Ctrl+N`, `Ctrl+P`, `Ctrl+K`, `Ctrl+B`, `Ctrl+,`, `Ctrl+\`), exposed in `SettingsShortcuts.tsx`.
4. **Canonical path resolver**: `GetFinalPathNameByHandleW` exists in `DesktopHost.cs`, while `PermissionEngine.ResolveToolPath` currently uses `Path.GetFullPath` + `ReparsePoint`. Part A unifies both into `PermissionEngine.CanonicalizePath` (resolves junctions, symlinks, 8.3 short names).

---

## 2. Conceptual Model (Resolving Overload)
- **Workspace (Top-Level Isolation Boundary)**: Identified by immutable GUID `ws_<guid>` (never a path; logs emit `workspaceId` only). Owns optional `rootPath` (or `null` = chat-only), `name`, `color`, `icon`, `archived`, `pinned`, `lastOpenedAt`, `settingsOverrides` (`defaultModel`, `autonomyCeiling`, `a2uiMode`), and all scoped data below.
- **Projects (Optional Chat Folders Inside a Workspace)**: Existing `projects` become lightweight chat folders stored inside `%APPDATA%\Sanctum\workspaces\<id>\ui_state.json`. Keeps user muscle memory without competing with workspace isolation.
- **Global (Shared Across All Workspaces)**: App settings (`settings.json`), installed models/packs, `egress_ledger.jsonl`, `network_policy.json` (Offline mode), shortcuts/feed settings, and an explicit **Global Memory tier** (`%APPDATA%\Sanctum\memory.json`, e.g., user's name) that users opt into sharing.

---

## 3. Storage Layout & Crash Recovery
```text
%APPDATA%\Sanctum\
├── workspaces.json                      # schemaVersion: 1, atomic write + .bak recovery, lastUsedWorkspaceId
├── memory.json                          # Global memory tier (opt-in cross-workspace facts)
├── workspaces\
│   └── ws_<guid>\
│       ├── manifest.json                # id, name, color, icon, rootPath, overrides, archived, pinned
│       ├── sessions\*.jsonl             # Hash-chained session logs (owner workspaceId in header)
│       ├── blobs\                       # Offloaded large tool outputs
│       ├── memory.json                  # Workspace-scoped memory tier
│       ├── vault\                       # Workspace-scoped RAG collections & chunks
│       ├── rules.json                   # Permission/command rules + access scope
│       ├── trust.json                   # .sanctum/* & AGENTS.md content-hash trust state
│       ├── mcp.json                     # Per-workspace MCP enablement & server bindings
│       ├── schedules.json               # Workspace-owned scheduled jobs
│       ├── shadow-git\                  # Shadow-git checkpoints for this workspace
│       └── ui_state.json                # Active thread, viewer tabs, projects, tree expansion, split view
```
- **Missing/Moved Root**: On load or tool call, if `rootPath != null && !Directory.Exists(rootPath)`, workspace enters `rootStatus: "missing"`. UI shows `"Folder missing: Locate / Remove"`. All file/shell/verify/checkpoint tools fail closed (`409 workspace_root_missing`); chat-only history remains readable, nothing crashes.

---

## 4. Root Validation Rules (`WorkspacePathValidator`)
Using unified `PermissionEngine.CanonicalizePath` (resolves symlinks, junctions, 8.3 names):
- **Reject**: Drive roots (`C:\`), user profile root (`%USERPROFILE%`), `C:\Windows`, `Program Files`, `Program Files (x86)`, `ProgramData`, `%APPDATA%\Sanctum` (and parents/children), UNC/device paths (`\\?\`, `\\.\`) as roots.
- **Reject Overlap**: Equal to, nested inside, or parent of any existing non-archived workspace root -> returns `409 workspace_root_overlap` with `existingWorkspaceId` so UI offers `"Open existing workspace"`.
- **Warn (non-blocking)**: Network drives (`DriveType.Network`) or cloud-synced folders (`OneDrive`, `Dropbox`, `Google Drive`, `iCloudDrive`) return `warnings: [...]` shown in wizard.

---

## 5. Host-Layer Isolation & Protocol v1 Changes
- **Data-layer filtering**: Every store (`SessionLogStore`, `HostMemoryService`, `VaultService`, `PermissionEngine`, `WorkspaceTrustManager`, `HarnessMcpManager`, `HarnessScheduler`, `CheckpointService`, `BackgroundTaskManager`, `A2uiService`) resolves strictly under `workspaces\<workspaceId>\`.
- **Mandatory ownership verification**: Every `/v1/sessions/:id/*` command accepts `workspaceId` (query/header/body); host verifies `session.workspaceId == workspaceId` -> `403 workspace_mismatch` on mismatch. `GET /v1/sessions` requires `?workspaceId=<id>` (or explicit `?allWorkspaces=true` for global attention inbox only).
- **Subagents & Forks**: Inherit parent `workspaceId` immutably.
- **A2UI `FileCard`**: Resolves paths strictly against the session's `workspace.rootPath` (never global `_toolWorkspace`).
- **Cross-workspace actions (Trusted Channel)**:
  - `POST /v1/workspaces/:id/delete` (typed-name confirmation + trusted channel; deletes only `%APPDATA%\Sanctum\workspaces\<id>`, never user folder).
  - `POST /v1/workspaces/transfer` (move/copy thread, share memory/vault collection across workspaces -> trusted channel if widening exposure).
  - `POST /v1/erase-all` wipes all `workspaces\*`, `workspaces.json`, global stores, and profiles.
- **Client View State & Instant Switch (< 150 ms)**:
  - Active workspace is per-client (UI holds `activeWorkspaceId`, CLI passes `--workspace`). Switching swaps in-memory view state from `GET /v1/workspaces/:id/ui-state` without page reload or interrupting active runs.
  - Attention inbox: `GET /v1/attention` aggregates pending approvals, running sessions, and unread items across all workspaces. Every approval card & native dialog displays `workspaceName` + `rootPath` (or `Chat-only`).

---

## 6. CLI, UI & Migration Plan
- **CLI**: `sanctum workspaces list|create|rename|remove|export|import` and `sanctum run --workspace <id|name|path>` (unknown path fails closed unless `--create`).
- **UI**: Sidebar top dropdown switcher (search, color/icon, recent, pinned, per-workspace running/attention badges), New Workspace wizard (folder or chat-only, optional settings-only copy), Archive/Delete/Export/Import, `SearchDialog` (`Ctrl+K`) + `Ctrl+Shift+W`, window title + tray menu workspace label, global Attention Inbox.
- **Reversible Migration**:
  1. Snapshot `%APPDATA%\Sanctum` into `%APPDATA%\Sanctum\backups\pre-workspaces-<ts>\`.
  2. Read `tool_workspace.txt`: if valid folder, create `"Default"` workspace with that root; else create chat-only `"Scratch"` workspace.
  3. Move existing `sessions/`, `blobs/`, `memory.json` (copy user profile facts to global), `rules`, `trust`, `schedules`, `shadow-git` into `workspaces\<defaultId>\` and record `migration_state.json`.
  4. Provide CLI rollback (`sanctum workspaces rollback-migration`) tested forward and backward.

---

## 7. Implementation Phases (1 Commit per Item + Regression Tests)
- **A1**: Unified `CanonicalizePath` + `WorkspaceRegistry` + root validator + crash-safe storage + reversible migration + forward/backward tests.
- **A2**: Host-layer isolation across sessions, memory (workspace + global), vault, checkpoints, rules, trust, MCP, schedules, tasks, A2UI `FileCard`, and `workspaceId` ownership enforcement + isolation & prompt-injection tests.
- **A3**: Cross-workspace attention inbox, workspace-labeled approval cards/dialogs, transfer/delete trusted-channel endpoints, export/import, `erase-all` coverage, and CLI (`workspaces *`, `run --workspace`).
- **A4**: UI Switcher dropdown, New Workspace wizard, missing-root banner, `ui_state.json` host persistence (< 150 ms switch), `Ctrl+Shift+W` + `SearchDialog` + `SettingsShortcuts`, window title + tray menu.
- **A5**: Scale benchmark (20 workspaces, 1000 sessions, measured switch latency), log-ID hygiene test (no paths in logs), `PROTOCOL.md` / `HARNESS.md` / `THREATS.md` / `FEATURES.md` / `docs/WORKSPACES_MIGRATION.md` updates.
