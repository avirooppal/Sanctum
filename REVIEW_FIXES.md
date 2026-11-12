# Sanctum Code Review — Fix Checklist

Ordered by priority group: **Must Fix Before Anyone Else Uses This** -> **Correctness** -> **Cleanup**.
*(Do not start fixing until specific finding IDs are approved.)*

---

## Must Fix Before Anyone Else Uses This
- [ ] **[SEC-06]** (`Critical`) Fix `workspace_chat.ts:298` (`permissionLevel: op.safety === "read" ? "auto_allow" : "always_ask"`), enforce `globalPermissionGate` in `executeWorkspaceToolCall`, and wire `onApprovalRequest` to a UI confirmation modal.
- [ ] **[SEC-01]** (`Critical`) Add `command_matcher` deny/ask rules and `ToolPath(cwd)` validation to C# `HandleTerminal` (`tools/compile_desktop_host.py:2039-2187`).
- [ ] **[SEC-02]** (`Critical`) Fix C# `HandleSettings` (`tools/compile_desktop_host.py:2616-2650`) to merge keys on `POST` and return `{ status: "success", settings: ... }` on `GET`.
- [ ] **[SEC-03]** (`High`) Expand Windows 8.3 short paths in C# `ToolPath` and hard-block all of `%APPDATA%\Sanctum` (`tools/compile_desktop_host.py:1875-1980`).
- [ ] **[SEC-04]** (`High`) Remove `_authToken` stdout leak in headless mode and harden `fetch`/`Headers` bridge (`tools/compile_desktop_host.py:600, 1166-1182`).

## Correctness
- [ ] **[BUG-03]** (`High`) Map `execute_command`/`run_shell`/`shell` -> `run_command` in `core/ai/tools/parse_calls.ts:65-67` and `core/ai/tools/scheduler.ts:67`.
- [ ] **[REL-03]** (`High`) Replace `File.Delete` + `File.Move` with atomic `File.Replace`, serialize `HandleThreads` writes, and force `Encoding.UTF8` (`tools/compile_desktop_host.py:2578-2703`).
- [ ] **[REL-02]** (`High`) Reconcile `threads.json`/`memory.json` with `localStorage` via `GET` on startup or use host storage as single source of truth (`chatSlice.ts:56-63`, `memory_store.ts:344-380`).
- [ ] **[DES-01]** (`High`) Port `/api/logs/query` to `DesktopServices.cs` or remove `read_logs` from desktop `workspaceTools` (`workspace_chat.ts:369-382`).
- [ ] **[BUG-02]** (`Medium`) Implement `POST /api/workspace` in C# `DesktopHost.HandleRequest` (`tools/compile_desktop_host.py:1761-1764`).
- [ ] **[BUG-04]** (`Medium`) Keep ConPTY alive when hiding terminal drawer and filter `ptyOutput`/`ptyExit` by `msg.gen` (`InteractiveTerminal.tsx:167-179, 300-313`).
- [ ] **[SEC-05]** (`Medium`) Return `403` instead of `204` for blocked egress, add `ws://`/`wss://` filters, and restrict localhost passthrough ports (`tools/compile_desktop_host.py:1197-1202, 1640-1669`).
- [ ] **[SEC-08]** (`Medium`) Add Zip Slip path-prefix check and quote-safe shortcut creation in `tools/build_installer.py:166-196, 302-312`.
- [ ] **[REL-04]** (`Medium`) Put `tempZip` cleanup in `finally` in `SanctumLauncher` and fix `Uninstall.exe` locked-file / running-process handling (`build_installer.py:314`, `compile_uninstaller.py:34-73`).
- [ ] **[BUG-01]** (`Medium`) Replace manual JSON string concatenation in `RecordDownloadLedger` and `HandleProfiles` with `JavaScriptSerializer` (`tools/compile_desktop_host.py:2492-2555`).
- [ ] **[REL-01]** (`Low`) Support cross-drive `tool-trash` moves and validate `undo` target via `ToolPath` (`tools/compile_desktop_host.py:2285-2309, 2384-2391`).

## Cleanup
- [ ] **[PERF-01]** (`High`) Move RAG document chunks/vectors out of `localStorage` and avoid synchronous re-embedding on startup (`src/store/useAppStore.ts:187, 196-214`).
- [ ] **[PERF-02]** (`Medium`) Cache embeddings on `MemoryFact` and `EpisodicMemory` instead of recomputing on every `recall()` (`core/ai/memory/memory_store.ts:201-246`).
- [ ] **[PERF-03]** (`Medium`) Add fine-grained `useAppStore` selectors and throttle `persist` writes during streaming (`chatSlice.ts:631-652`, `ChatScreen.tsx:250`).
- [ ] **[BUG-05]** (`Medium`) Remove hardcoded `run-initial` and synthetic step completions in `agentSlice.ts:210-268, 494-511`; hide/disable unbacked `CheckpointDrawer` and `SettingsMcp`.
- [ ] **[DES-02]** (`Medium`) Prune or wire unused `SETTINGS_SCHEMA` keys in C# host (`core/domain/settings_schema.ts`).
- [ ] **[DES-03]** (`Medium`) Extract `CSHARP_SOURCE` out of `tools/compile_desktop_host.py` into `tools/native/*.cs`.
- [ ] **[PRIV-01]** (`Medium`) Route `searchWikipedia`/`fetchWikipediaSummary` through `CloudEgressBroker` or remove (`core/ai/inference/engine.ts:368-408`).
- [ ] **[PRIV-02]** (`Low`) Remove hardcoded `C:\Users\aviroop` paths from `SettingsGeneral.tsx:46` and `SettingsMcp.tsx:24`.
- [ ] **[SEC-07]** (`Low`) Replace `new Function` in `safeMathEval` with a small arithmetic parser (`core/ai/tools/workspace_chat.ts:21-30`).
- [ ] **Dead Code & Tests**: Delete `AppShell.tsx`, `SanctumShell.tsx`, `core/infra/storage/persistence.ts`, `build_self_extracting_installer`, and `@playwright/test`; fix `tests/app_not_wrapper.test.ts:58` and add C# host + permission-gate tests.
