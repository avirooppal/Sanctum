# Sanctum A2UI Rich Replies (`A2UI.md`)

Sanctum supports experimental rich native UI replies (tables, forms, file cards, diff summaries, todo lists, code blocks, citations, terminal output) via a strictly local, version-pinned **A2UI v0.9.1** declarative subset.

## 1. Pinned Version & Adapter Boundary
- **Pinned version**: `0.9.1` (Apache-2.0 specification from `a2ui-project/a2ui`).
- **Single adapter**: [src/lib/a2ui/adapter.ts](src/lib/a2ui/adapter.ts) (UI) and [tools/native/harness/A2uiService.cs](tools/native/harness/A2uiService.cs) (Host).
- Every stored `a2ui_surface` event records `a2uiVersion: "0.9.1"` so older threads degrade cleanly to `markdownFallback` if the renderer version ever changes.

## 2. Allowed Sanctum Catalog (UI as Data, Never Code)
Allowed component types (15):
- **Standard**: `Column`, `Row`, `Card`, `Text`, `Button`, `TextField` (non-password only), `Checkbox`, `Select`
- **Sanctum**: `Table`, `FileCard`, `DiffSummary`, `TodoList`, `CodeBlock`, `Citations`, `TerminalOutput`

### Deliberately Excluded (and Why)
- **Approvals / Security Chrome**: Approval cards, workspace trust prompts, permission prompts, and egress notices are NEVER A2UI — always host-owned native components outside the `"Agent-generated UI"` frame.
- **Bidirectional RPC (`v1.0` `callRendererFunction` / `callAgentFunction`)**: Excluded so untrusted model output can never invoke host functions or tools directly.
- **Iframes / WebViews / Raw HTML / `<script>`**: Excluded to prevent XSS and sandbox escapes.
- **Remote Images / Media / Fonts (`http://` / `https://`)**: Excluded to prevent tracking pixels and network egress (local-only policy).
- **Password / Secret Input Fields**: Excluded to prevent credential phishing inside agent-generated UI.
- **Charts**: Excluded unless strictly offline inline-data; skipped in this pass.

## 3. Limits & Validation (Host Defense-in-Depth)
- Max payload size: `64 KB`
- Max components per surface: `50`
- Max nesting depth: `8`
- Max string length: `4096` chars
- Max data model size: `32 KB`
- Max inline `data:` URI: `16 KB`
- `FileCard` / `DiffSummary` paths are validated against `PermissionEngine.ResolveToolPath`; out-of-scope or missing paths render disabled (`pathValid: false`).

## 4. Protocol Events & Actions
- **`a2ui_surface`**: Persisted in the hash-chained session log (`{ a2uiVersion, surfaceId, summaryText, valid, surface, markdownFallback }`), replayable by `seq`.
- **`a2ui_user_action`** (`POST /v1/sessions/:id/a2ui-action`): Clicking a button or submitting a form ONLY emits an untrusted event (`{ idempotencyKey, surfaceId, componentId, actionName, data, untrusted: true }`). It **never** runs tools, edits settings, or deletes files directly (`toolsExecuted: false`).

## 5. Fallback Matrix
| Failure Mode | Behavior |
|---|---|
| JSON parse error / schema error | Drop bad surface only; keep text answer; show `"Couldn't render interactive view, showing text"` + `"View raw"` |
| Unknown / disallowed component (e.g. `ApprovalCard`, `Iframe`) | Rejected by host & UI; `fallbackToText: true` |
| Unsupported A2UI version | Renders stored `markdownFallback` |
| React render exception | Caught by per-surface `SurfaceErrorBoundary`; chat stays intact |
| CLI / headless / export / copy / search | Deterministic `FlattenToMarkdown` output |
| 3 consecutive failures in session | `shouldEnableRichReplies` auto-disables A2UI for the session |

## 6. Rich Replies Mode & Measured Local Validity
- Modes: **Off** (default — Experimental), **Auto** (enables only when model's measured A2UI validity on this machine `>= 70%`), **Always**.
- **Measured on this machine** ([docs/design/A2UI_DESIGN.md](docs/design/A2UI_DESIGN.md)):
  - `smollm2:135m`: 0% across all approaches (stays disabled in Auto).
  - `qwen3:1.7b`: 50% (`render_ui` tool) / 75% (structured output).
  - `qwen3:4b`: >25s/turn timeout on this host.

## 7. How to Add a Component
1. Add component type name to `AllowedComponents` in `tools/native/harness/A2uiService.cs` and add its Markdown flattener case in `FlattenToMarkdown`.
2. Add component type name to `SANCTUM_A2UI_CATALOG` in `src/lib/a2ui/adapter.ts`.
3. Add the native React 19 renderer case in `src/components/a2ui/A2uiSurfaceRenderer.tsx` (zero network, ARIA-accessible, theme-tokenized).
4. Add validation, XSS, and fallback tests to `tests/phase3b_a2ui_host.test.ts` and `tests/phase3b_a2ui_ui_and_model.test.ts`.
