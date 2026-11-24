# Sanctum Workspaces Migration Guide (`WORKSPACES_MIGRATION.md`)

## Automatic First-Run Migration
When upgrading to Sanctum with multi-workspace support, the host (`WorkspaceManager`) detects the absence of `%APPDATA%\Sanctum\workspaces.json` and runs a **reversible, backed-up migration**:

1. **Full Backup**: Existing legacy data (`tool_workspace.txt`, `sessions/`, `blobs/`, `memory.json`, `permission_rules.json`, `workspace_trust.json`, `mcp_servers.json`, `schedules.json`, `shadow-git/`) is copied to `%APPDATA%\Sanctum\backups\pre-workspaces-<timestamp>\`.
2. **Default Workspace Creation**:
   - If `tool_workspace.txt` exists and points to a valid non-system folder, Sanctum creates a **"Default"** workspace pointing to that folder.
   - Otherwise, Sanctum creates a chat-only **"Scratch"** workspace (`rootPath: null`).
3. **Zero Data Loss**: Existing sessions, blobs, memory, rules, trust state, MCP configs, schedules, and shadow-git snapshots are copied into `%APPDATA%\Sanctum\workspaces\<id>\`. Explicit user profile memories remain in the global memory tier (`%APPDATA%\Sanctum\memory.json`).
4. **State Record**: Migration metadata is written to `%APPDATA%\Sanctum\migration_state.json`.

## Rolling Back Migration
If you need to revert to the pre-workspaces single-folder layout:
```powershell
Sanctum-Desktop.exe --rollback-workspace-migration
```
This restores all backed-up files from `%APPDATA%\Sanctum\backups\pre-workspaces-<timestamp>\` and removes `workspaces.json`, `workspaces/`, and `migration_state.json`. Verified forward and backward in `tests/part_a1_workspace_registry_and_migration.test.ts`.
