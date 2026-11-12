# Sanctum Code Review Fix Report

All 22 findings from `REVIEW.md` were addressed across 4 phases on `main` (`a09fefc` through `eef4fb4`).

## Verification Summary (Latest Run)

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Exit 0 | `tsc --noEmit` clean |
| `npm run lint` | Exit 0 | `python tools/check_architecture.py` — 0 architectural violations |
| `npm test` | Exit 0 | 252 tests: 236 pass, 0 fail, 16 skipped |
| `node --experimental-strip-types --test tests/desktop_host_security.test.ts` | Exit 0 | 25 tests: 25 pass, 0 fail |
| `npm run build` | Exit 0 | `next build` — 22/22 pages built cleanly |
| `python tools/compile_desktop_host.py` | Exit 0 | `deploy/installer/build_payload/Sanctum-Desktop.exe` (189,952 bytes) |
| `npm audit` | Exit 0 | 0 vulnerabilities |

---

## Finding-by-Finding Ledger

### Phase 1 — Stop Silent Code Execution & Make Settings Real
| ID | Status | Commit | Summary & Regression Tests |
| --- | --- | --- | --- |
| `SEC-06` | Fixed | `a09fefc` | Enforced `always_ask` for write/delete/exec tools, routed `executeWorkspaceToolCall` through `globalPermissionGate`, and wired blocking approval modal in `chatSlice`. Tests in `tests/workspace_tools.test.ts`. |
| `SEC-01` | Fixed | `f361f97` | Ported deny/ask command rules, `ToolPath` cwd validation, `-EncodedCommand`, and single-use `X-Sanctum-Approval` tokens to C# `HandleTerminal` / `start_background`. Tests in `tests/desktop_host_security.test.ts`. |
| `SEC-02` | Fixed | `1203915` | Fixed `HandleSettings` to merge keys on POST, validate against `_knownSettingKeys`, write atomically, and return `{ status: "success", settings }` on GET. Tests in `tests/desktop_host_security.test.ts`. |
| `SEC-03` | Fixed | `40f8217` | Canonicalized real paths via `GetFinalPathNameByHandleW` in C# `ToolPath` and hard-blocked all `%APPDATA%\Sanctum` internals. Tests cover 8.3 short names, junctions, `..\`, UNC, `\\?\`, and mixed-case paths in `tests/desktop_host_security.test.ts`. |
| `SEC-04` | Fixed | `1aea617` | Gated headless stdout token print behind `--print-token` and required `X-Sanctum-Approval` on privileged endpoints. Tests in `tests/desktop_host_security.test.ts`. |

### Phase 2 — Fix Broken Core Flows & Reliability
| ID | Status | Commit | Summary & Regression Tests |
| --- | --- | --- | --- |
| `BUG-03` | Fixed | `d186538` | Mapped shell aliases (`bash`, `sh`, `powershell`, `cmd`, `exec`) to `run_command` and extracted `proc:shell` resource in `ToolScheduler`. Tests in `tests/workspace_tools.test.ts`. |
| `REL-03` | Fixed | `65e2f5a` | Used `File.Replace` with single-writer queue, UTF-8 body decoding, 16 MiB request cap, and HTTP 500 surfacing. Tests in `tests/desktop_host_security.test.ts`. |
| `REL-02` | Fixed | `ffdb22c` | Hydrated threads and memory from C# host on startup with revision-based conflict reconciliation. Tests in `tests/core_domain.test.ts`. |
| `BUG-02` | Fixed | `e842f45` | Implemented `POST /api/workspace` in C# host with `ToolPath` + approval check. Tests in `tests/desktop_host_security.test.ts`. |
| `DES-01` | Fixed | `e842f45` | Implemented `POST /api/logs/query` in C# host with filtering and secret redaction. Tests in `tests/desktop_host_security.test.ts`. |
| `BUG-04` | Fixed | `889471d` | Kept ConPTY session alive when drawer hidden and filtered `ptyOutput`/`ptyExit` by generation token. |
| `BUG-01` | Fixed | `0659948` | Replaced manual JSON string concatenation in `RecordDownloadLedger` and `HandleProfiles` with `JavaScriptSerializer`. Tests in `tests/desktop_host_security.test.ts`. |
| `REL-01` | Fixed | `a87fa5e` | Added cross-drive move/delete/undo support and re-validated undo target path with `ToolPath`. Tests in `tests/desktop_host_security.test.ts`. |
| `SEC-08` | Fixed | `399b809` | Added Zip Slip extraction guard and `-EncodedCommand` shortcut creation in installer. |
| `REL-04` | Fixed | `399b809` | Added `finally` temp cleanup and running-process/tray handling in installer & uninstaller. |
| `SEC-05` | Fixed | `3c06e5b` | Returned HTTP `403` for blocked WebView2 egress, filtered `ws://`/`wss://`, restricted loopback ports, and added Node/C# contract test in `tests/desktop_host_security.test.ts`. |

### Phase 3 — Fix Memory & Persistence Scaling
| ID | Status | Commit | Summary & Regression Tests |
| --- | --- | --- | --- |
| `PERF-01` | Fixed | `cfcb931` | Moved RAG chunks, vectors, and chat images to IndexedDB and hydrated asynchronously (`localStorage` payload reduced from 87,842 B to 173 B in benchmark). Tests in `tests/vector_store_rag.test.ts`. |
| `PERF-02` | Fixed | `e8db613` | Cached embeddings on `MemoryFact` and `EpisodicMemory` instead of recomputing in `recall()`. Tests in `tests/agent_and_features.test.ts`. |
| `PERF-03` | Fixed | `702f825` | Debounced persistence, converted store reads to Zustand selectors, memoized `MessageRow`, and windowed long threads. |

### Phase 4 — Honesty, Cleanup, and Test Stabilization
| ID | Status | Commit | Summary & Regression Tests |
| --- | --- | --- | --- |
| `BUG-05` | Fixed | `dc3d365` | Removed fake `run-initial` agent run and synthetic step completions; hid unbacked Checkpoints and MCP UI in desktop WebView2 mode. Updated `tests/agent_and_features.test.ts`. |
| `DES-02` | Fixed | `7e1ed9a` | Synced `SETTINGS_SCHEMA` with host keys (`implementedInHost`), removed dead `IsLocalApiEnabledInSettings`, and hid unimplemented settings sections (`local-api-server`, `https-proxy`, `web-search`, `claude-code`) in desktop mode. |
| `PRIV-01` | Fixed | `70ad03e` | Routed `LocalEngineClient.searchWikipedia` and `fetchWikipediaSummary` through `globalEgressBroker.assertEgressAllowed`. Tests in `tests/pipeline_p9_cloud_path.test.ts`. |
| `PRIV-02` | Fixed | `70ad03e` | Replaced hardcoded `C:\Users\aviroop\...` defaults in `SettingsGeneral.tsx` and `SettingsMcp.tsx`. |
| `SEC-07` | Fixed | `c33197e` | Replaced `new Function` in `safeMathEval` with a recursive-descent arithmetic parser. Tests in `tests/workspace_tools.test.ts`. |
| `DES-03` | Fixed | `2e811fb` | Extracted embedded C# host into `tools/native/DesktopHost.cs` + `tools/native/Sanctum.Desktop.csproj`, and deleted dead `AppShell.tsx`, `SanctumShell.tsx`, and `core/infra/storage/persistence.ts`. |
| `TEST` | Fixed | `eef4fb4` | Updated `tests/app_not_wrapper.test.ts` for `DesktopHost.cs` (`#0f0f12` / `InitializeWindowPosition`) and made `tests/multi_tool_v2.test.ts` concurrency test deterministic. |

---

## Remaining Risks & Future Work
- **Checkpoints & Diff Preview (Desktop Host)**: `CheckpointDrawer` and MCP server UI were hidden in WebView2 desktop mode (`BUG-05`) because their backend routes exist only in the Node dev/test path (`src/app/api/checkpoints`, `src/app/api/mcp`). Porting them to `DesktopServices.cs` / `DesktopHost.cs` remains future work.
- **Unimplemented Settings Sections**: `local-api-server`, `https-proxy`, `web-search`, and `claude-code` are hidden in desktop mode (`DES-02`) rather than backed by C# host services.
- **Installer Runtime Verification**: `compile_desktop_host.py` and `compile_uninstaller.py` compile cleanly, and `desktop_host_security.test.ts` exercises the headless host end-to-end, while full GUI installer/uninstaller UX on a clean Windows VM was not executed in this pass.
