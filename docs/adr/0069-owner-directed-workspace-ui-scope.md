# ADR 0069: Owner-Directed Modular Workspace UI Scope & Quality Gates

## Context
The owner directed the implementation of the Sanctum Workspace UI under an exact, comprehensive specification (authorities: `plan.md`, `docs/MISSION.md` + Amendment 1, `docs/WRAPUP.md`, `docs/UI_WORKSPACE.md` Amendment 2, ADR 0027 single-user scope, ADR 0064 public website, `docs/REVIEW_QUEUE.md`).

The workspace must serve as a calm, modular, aesthetic, customisable, and UX-friendly interface for Sanctum while operating under a strict feature freeze. The interface runs entirely against the real local gateway with default-deny network egress, memory-only credentials and drafts, and data-only customisation.

This ADR records the owner-directed scope, the quality thresholds, and the resolution plan for identified debt before merge.

## Decisions

### 1. Known Debt Resolution (S0)
Before any merge into main:
1. **Isolated Upstream Reference Environment (ADR 0065)**:
   - Phase 1: Containerized `npm ci --ignore-scripts` from pinned lockfile (`30d55e0385ebfb04b2af39cf594643973264808495352648b891103cc02a5bec`) at upstream SHA `b30f95ac4a80d2f6dbe3aa01001b0524314f6d74`, with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
   - Phase 2: Offline (`--network none`, throwaway HOME, non-root) build and serve of the upstream dashboard and renderer using `tools/reference/mock_gateway.py` and `mock_electron_bridge.js`, capturing reference screenshots at 1440x900, 820x1180, and 390x844.
2. **Hermes Fidelity Gate**: Measure pixel-diff with masked branding and computed-style token comparisons across comparable screens/states/themes rather than relying solely on structural invariants.
3. **Dashboard Structure**: Transition the dashboard from a modal into full routed pages (`/dashboard/*`) mirroring the Hermes dashboard structure (Status, Models, Sessions, Resources, Config, Licenses, Docs).
4. **Documentation Accuracy**: Correct overclaiming language in `STATUS.md`, `HANDOFF.md`, and `PLAN_COVERAGE.md` to reflect only verified evidence.

### 2. Functional Scope (Exact Build List)
- **A1 App Shell & Layout Engine**: Left sidebar, central workspace, right rail, status bar. Panel resizing/collapsing, `Ctrl/Cmd+B` and `Ctrl/Cmd+J` shortcuts. Layout presets: Default, Focus, Console (registered hidden until backed), Quad mode with queue admission countdown. Responsive desktop, tablet (overlay), and mobile (drawer, single pane, bottom sheets).
- **A2 Left Sidebar**: New session, server-side full-text search across all conversations, pinned section, date-grouped history, inline rename, delete with 5s undo toast, pin/unpin.
- **A3 Tab Rail**: Multi-session tabs, `Ctrl+Tab` cycling, `Ctrl+W` closing, overflow handling.
- **A4 Chat**: Message list (unboxed ~720px measure for prose, user bubbles, bubble/document layout toggle), streaming calm indicator, virtualized transcript, stick-to-bottom with "Jump to latest", SafeMarkdown with copyable code blocks, passage-exact citation chips, working message actions (copy, retry, stop, delete), autosizing composer with configurable Enter behavior, validated Knowledge attachments, dictation toggle.
- **A5 Right Rail**: Artifacts tab (Files/Code with blob download; Links from RAG and chat) and read-only Knowledge file tree.
- **A6 Status Bar**: Live runtime health (`/healthz`), engine readiness, egress self-test badge, background jobs popover, model picker with license badge and will-it-fit estimate, real context/token usage bar.
- **A7 Settings Overlay**: Appearance (themes, light/dark/system, contrast-guarded accent picker, density, font scale 90–125%, bundled fonts, layout, code theme, motion), Layouts, Shortcuts with conflict detection, Assistant Profiles CRUD, Model role assignments, Data export (Markdown) and Full Purge (typed confirmation), Licenses/notices.
- **A8 Command Palette**: `Ctrl/Cmd+K` fuzzy search over actions, sessions, and settings.
- **A9 Onboarding**: Skippable first-run flow showing hardware tier, model status, live egress test, Knowledge folder selection, prompt suggestions.
- **A10 Routed Dashboard**: Standalone routed pages for Status, Models, Sessions, Resources, Config, Licenses, Docs.
- **A11 Website & Docs**: Reskinned with shared tokens and components; zero foreign requests.

### 3. Registered Hidden & Omitted Surfaces
- **Registered Hidden**: Tools manager, agent run tree, run output panel, safety approval prompts, vision attachments, live voice conversation with barge-in, meeting speaker labels, encrypted backup/restore, LAN/TLS settings, Privacy Ledger view, lock/unlock.
- **Omitted By Design**: Messaging channels, Nous Portal, cloud provider key forms, cron scheduling, interactive terminal/PTY, remote gateway/VPS setup.

### 4. Backend Additions (Strictly Authenticated & Schema-Validated)
- Conversation pin/unpin & server-side full-text search.
- UI preferences store (versioned JSON in SQLite via migration).
- Capability discovery endpoint (`/v1/capabilities`).
- Assistant profiles CRUD (`/v1/profiles`) & session association.
- Real token usage and context-length reporting per session/model.
- Full Purge endpoint with typed confirmation token and cancellation of in-flight work.
- Conversation Markdown export.

### 5. Verification & Acceptance
- 25 named Playwright E2E tests against the real gateway.
- UI fidelity measured against upstream reference screenshots.
- WCAG 2.2 AA contrast and keyboard accessibility.
- Zero foreign egress across all views and WebSockets.
- Performance budgets: INP < 100ms, CLS = 0, JS gzipped <= 300KB, CSS gzipped <= 30KB.

## Relaxes Gate?
No. Establishes stricter fidelity verification, formalizes debt clearance before merge, and introduces 25 real end-to-end browser tests.

## Status
Accepted.
