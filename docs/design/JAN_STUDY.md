# Jan source study — B1

Reviewed 2026-10-20, source only; Jan itself was not built or run.
Pin: `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`.
[Pinned repository](https://github.com/janhq/jan/tree/e7cbcf6d232f331313fd646b9131793ab2c5dc5c).
No Jan code, marks, logos, screenshots or UI assets enter the product.
ADR0089 records the fresh/adapt decisions before any adaptation.

## Explicit development setup and license evidence

Run only during developer setup, never at product startup or in offline checks:

```powershell
git init .sanctum/dev-references/jan
git -C .sanctum/dev-references/jan remote add origin https://github.com/janhq/jan.git
git -C .sanctum/dev-references/jan fetch --depth 1 origin e7cbcf6d232f331313fd646b9131793ab2c5dc5c
git -C .sanctum/dev-references/jan checkout --detach FETCH_HEAD
git -C .sanctum/dev-references/jan rev-parse HEAD
git -C .sanctum/dev-references/jan ls-tree -r --name-only HEAD
```

Observed checkout matches the pin; tree contains2,764 tracked paths.
No install script, package manager install or Jan binary was executed.
Raw receipt: `evals/results/b1-jan-source.json`.

| Item | Source | Exact bytes / SHA256 |
|---|---|---|
| Root LICENSE | Git blob `PIN:LICENSE`, saved as `docs/licenses/jan-e7cbcf6-LICENSE.txt` |728 / `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`|
| NOTICE | Full tracked tree searched for case-insensitive basenames NOTICE, NOTICE.txt, NOTICE.md | ABSENT; no invented empty file or hash |
| Full Apache license | [Apache primary text](https://www.apache.org/licenses/LICENSE-2.0.txt), `docs/licenses/Apache-2.0-primary.txt` |11358 / `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`|

The root LICENSE identifies Menlo Research and Apache-2.0, includes attribution
text and requests attribution in user-facing documentation where appropriate.
It is a declaration, not the full Apache text. For any later adaptation:
ship the full license; retain applicable copyright/attribution notices; identify
modified files; retain applicable NOTICE material if the chosen source supplies
it. Record source commit/path/hash, destination and changes in ui-provenance and
THIRD_PARTY_NOTICES. Apache section6 does not grant general trademark rights.
Jan's name/logo are not Sanctum branding. This review does not admit Jan's
transitive dependency tree or every separately licensed file.

## Architecture observed at the pin

Paths below are relative to the pinned source, not Sanctum implementation claims.

| Layer | Evidence inspected | Responsibility and implication |
|---|---|---|
| UI app | `web-app/package.json`, `web-app/src/routes`, `components/left-sidebar/NavMain.tsx` | Vite/React, TanStack routing/virtualization, component libraries, hooks and service abstractions. Broad dependency set is not evidence of meeting Sanctum's budget. |
| Core SDK | `core/src/index.ts`, `core/src/browser/extension.ts`, `browser/core.ts` | Exports shared types, browser bridge, event bus, filesystem/settings/model interfaces and extension base classes. |
| Extensions | `extensions/{assistant,conversational,download,llamacpp,mlx,rag,vector-db}-extension` | Domain adapters use SDK types and Tauri commands/events. `llamacpp-extension/src/index.ts` connects settings, models, inference and downloads. |
| Tauri IPC | `src-tauri/src/lib.rs` | Explicit generated invoke command list covers app config, files, server, settings, provider secrets and agents. `Cargo.toml` feature-gates desktop/mobile/headless paths. |
| Rust core | `src-tauri/src/core/mod.rs` | App/state/setup, filesystem, downloads, MCP, server, threads, system, updater and agent/CLI modules. |
| Plugins | `src-tauri/plugins` | llama.cpp, MLX, hardware, RAG, vector DB, web search and agent tools. These are bundled code, not a permission guarantee. |
| Engine worker | `plugins/tauri-plugin-llamacpp/src/engine/{worker,commands,watcher}.rs` | Separate `jan-llama-worker` crash boundary; structured startup handshake reports PID/OS-assigned port/models; per-worker random API key and watcher. A llama.cpp abort need not kill the app. |
| Shutdown | `plugins/tauri-plugin-llamacpp/src/process.rs` | Unix TERM then bounded wait/KILL; Windows implementation explicitly force-kills. This source is not evidence of Sanctum Windows containment. |
| Downloads | `core/downloads/{commands,helpers,models}.rs` | Task cancellation tokens, pause keeping partial files, cancel discarding partials, events/progress; helper includes Hugging Face mirror/fallback logic. Sanctum must use explicit broker hosts instead. |
| MCP | `core/mcp/{commands,helpers,models}.rs` | Managed server configuration/lifecycle, stdio and Streamable HTTP transport, OAuth handling. Sanctum still needs its own manifest pins, argument-bound approvals and taint enforcement. |
| API server | `core/server/{commands,proxy}.rs` | Start/stop/status; configured host, port, prefix, API key, trusted hosts, timeout and tool-execution option. Sanctum's existing API/supervisor is retained. |
| Settings/data | `core/app/{commands,settings_store}.rs`, `core/threads/{helpers,db}.rs` | Config resolves OS data location and explicit override. Desktop threads use `thread.json` and `messages.jsonl`; mobile uses SQLite `jan.db`. Do not misdescribe all Jan storage as SQLite. |
| Docs | `docs/package.json`, `docs/src` | Separate Next-based documentation project; informative only. Sanctum has no public/docs website. |

## UX observations from routes and components

The sidebar offers new chat, search, projects and thread navigation with shortcut
hints. Routes include threads, Hub, local API server, system monitor and settings.
The pinned app also has agent/cowork surfaces; these are outside Sanctum M3 scope.
Assistants are represented by an assistant settings route and switcher rather than
assuming an independent top-level page at this revision.

Settings routes include General, Interface, Hardware, Assistants, Attachments,
Providers, MCP servers, Local API Server, Privacy, Shortcuts, Web Search and
Extensions. Model selection/settings and download actions are separate containers.
General exposes the data folder and reset controls. Privacy includes an analytics
switch using PostHog; Sanctum's no-telemetry rule supersedes that design.
Source inspection establishes the controls' existence, not usability, accessibility
or performance. No rendered Jan screenshot review is claimed.

Principles to carry forward in original Sanctum designs:
stable chat navigation; discoverable model controls; scoped thread drawer;
searchable settings with keyboard hints; explicit progress/cancel; actionable
empty states. Preserve the distinction between installed, loaded and available
capabilities. Show unknown resource data honestly.

## Adapt versus fresh (ADR0089)

| Component | Decision | Reason / Sanctum consumer |
|---|---|---|
| Layout, sidebar, thread drawer | Fresh | Original tokens/markup, small measured stack; M3 |
| Markdown and protocol client | Retain Sanctum, reverified A2 | Existing safe-rendering and API contracts; M3 |
| Engine supervision/cancellation | Retain Sanctum | Existing kernel/admission tests; study worker crash boundary only; M2 |
| Models/downloads | Fresh | One explicit egress broker, hash/space/cancel/resume contract; M3/M9 |
| Settings schema and CLI | Fresh | One typed schema across global/assistant/thread/model; M2/M4 |
| Assistants | Fresh | Data-only presets with permissions; M5 |
| Local API | Retain Sanctum and extend | Preserve verified OpenAI-compatible journeys; M2/M6 |
| Tool calls/MCP | Fresh | Taint, immutable manifest identity and argument-bound approvals; M7 |
| Optional packs | Fresh boundary around retained workers | No Python in core; explicit install and lazy lifecycle; M2/M8 |
| Providers/network/ledger | Fresh | Disabled defaults, keychain/env, consent, hash chain; M9 |
| Computer use | Fresh | Sandbox-first, host gates and measured local-model suite; M10 |
| Jan updater/analytics/extensions | Do not adapt | Conflicts with no pings/telemetry/arbitrary UI code |
| Assets, names, docs site | Do not adapt | Original Sanctum identity; no website |

Zero source adaptations are authorized by this table. A later proposed copy
requires a new ADR row with exact provenance before the copy. Fresh implementations
may use documented public protocols but must not copy Jan code covertly.
Shell and UI choices remain pending B2/B3 experiments; this study chooses neither.
