# Current state

- Branch: jan-style; main unchanged. Merge timing remains the owner's decision.
- A1: five-run WSL baselines recorded in PERFORMANCE.md; native Windows unavailable.
- A1 commit efe257d: hosted run39389771024 completed/success, all5 jobs observed.
- A2: named removal audit records the HTTP/dependency coverage gaps and restorations.
- A3: six modules planned for M3; five M8-only audio helpers and11 tests removed.
- A4: full previous evidence/history archived below; no numbers discarded.
- A5: PROVISIONAL recommendation—do not merge before a usable M3 desktop exists.
- A2–A5 local gates pass:188 source/71 Rust/34 web,38 denial probes,9 smoke stages.
- Restored HTTP test found a history timeout; indexed migration fixes it (ADR0088).
- A2–A5 head37c9981: hosted run39401230501 completed/success, all5 jobs.
- B1: pinned Jan source/license study recorded (ADR0089).
- B2: shell candidate measurements recorded in ADR0091 (wry provisionally recommended); commit d8d81b8 verified hosted-green on all 5 jobs (run 39412991239).
- B3: UI stack measurements recorded in ADR0092 (Preact 10 6.86 KB vs React 19 59.93 KB gzip; Preact provisionally recommended).
- B4: core contracts established in ADR0093 (process model, pack lifecycle, typed settings, permission broker, egress broker, platform assurance).
- B5: comprehensive threat model documented in docs/THREAT_MODEL.md covering tools, MCP, and computer use with proving tests.
- B6: complete static wireframes with 2 critique iterations recorded in docs/design/wireframes/.
- B7: measured desktop performance budgets and CI enforcement established in ADR0094.
- M2: Lightweight Core implemented:
  - Typed settings engine (`services/gateway/src/settings.rs`) with schema validation, risk tiers, restart tracking, env overrides, and CLI (`sanctum config` get/set/list/export/import).
  - Pack lifecycle manager (`services/gateway/src/packs.rs`) with capability endpoint (`/api/capability`) and platform assurance reporting ("verified kernel containment" on Linux x86_64, "not verified" on Windows).
  - Cross-platform supervision and boot: native Windows execution without exit(78), unconfined fallback reporting "not verified", child process kill cleanup.
  - B7 CI budget enforcer (`tools/check_desktop_budgets.py`) wired into source gate.
  - All unit/integration tests passing (3 settings/packs Rust tests, 4 budget tests, 6 CLI config tests; full workspace and check.py green).
  - Hosted CI: commit `c4551fe` verified green across all 5 jobs in run 39432364639 (`evals/results/m2-hosted-ci.json`).
- M3: Desktop UI Assembly & Modular Components implemented:
  - Design tokens & customisation engine (`tokens.ts`) with dark/light themes, density multipliers, and WCAG AA contrast guard.
  - Typed PanelRegistry (`panels/registry.ts`) and PanelErrorBoundary (`panels/ErrorBoundary.tsx`) for capability-based panel rendering and crash isolation.
  - Modular desktop components: `Sidebar`, `Composer`, `ChatPanel` (with streaming, citations, markdown, copy action), `ModelsPanel`, `PacksPanel`, `SettingsPanel`, `StatusBar`, `CommandPalette`.
  - Desktop Shell (`Shell.tsx`) orchestrating layout, capability discovery (`/api/capability`), session management, and settings persistence.
  - Client methods for `/api/capability`, `/api/settings*`, and `/api/pack/*` added to `SanctumClient`.
  - Built bundle verified: 10.99 KB gzip (well under 50 KB Preact budget and 100 KB hard gate).
  - 47 web unit tests passing (13 new tests in `panel-registry.test.mjs`, `tokens.test.mjs`, `m2-client.test.mjs`, `strings.test.mjs`); 0 audit vulnerabilities.
  - Hosted CI: commit `4b74be4` verified green across all 5 jobs in run 39471167224 (`evals/results/m3-hosted-ci.json`).
  - D0 design specifications complete: BRIEF, TOKENS (with schema), COMPONENTS, FLOWS, MICROCOPY, and string table; commit `3d7552a` verified green across all 5 jobs in run 39474771424 (`evals/results/d0-design-hosted-ci.json`).
- Jan & Odysseus UI Replication implemented:
  - Jan-style 3-column layout with right collapsible parameter drawer (`ThreadDrawer.tsx`): Model selector, system prompt, temperature (0-2), top-p (0-1), max tokens (128-4096), stream toggle, export/delete actions.
  - Odysseus-inspired workspaces integrated:
    - Side-by-side Model Compare Arena (`ComparePanel.tsx`) with dual streaming, TTFT/tokens per sec metrics, and blind A/B evaluation.
    - Hardware-aware Cookbook (`CookbookPanel.tsx`) with real-time RAM/VRAM calculator, task categorization (Coding, General, Reasoning, Vision, Lightweight), and hardware fit badges.
    - Multi-step Deep Research (`ResearchPanel.tsx`) with breadth/depth controls, passage extraction, and structured markdown synthesis.
    - Chat & Agent mode switch with active tool chips (Knowledge RAG, Code Sandbox, Local Files, Web Search, MCP Client) and collapsible reasoning steps.
  - Native Windows executable binaries verified (`sanctum-lab-wry.exe`, `sanctum-runtime.exe`, `sanctum-foundation.exe`).
  - Gzip bundle size: 25.58 KB gzip (well under 51.2 KB target and 102.4 KB hard ceiling).
  - 47 web tests green; 188 workspace checks pass.
  - Hosted CI: commit `f10c6d7` verified green across all 5 jobs in run 39550370418 (`evals/results/odysseus-ui-hosted-ci.json`).
- No native installer, desktop performance acceptance or whole-product security claim.

Evidence: [A2–A5 commands/results](A2_A5_EVIDENCE.md), [PERFORMANCE](PERFORMANCE.md), [test audit](TEST_REMOVAL_AUDIT.md),
[module decisions](UI_MODULE_RETENTION.md), ADR0086/0087 and evals/results/a1-*.
[Previous full STATUS](status-archive/2026-10-20-before-a2-a5.md), SHA256
`d15ab35c3c79b880614b01a8087cd81a44892133b7f2418d9c069a29bdc95f50`.
