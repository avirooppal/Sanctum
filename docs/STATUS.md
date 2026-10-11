# Current state

- Mission: [MISSION.md](MISSION.md), Amendment1; single owner ADR0027.
- Step: U2 adapter implemented/tested on `ui-hermes-port`; visual port pending.
- Last hosted-green: `44d8be5`, run38124710606/all5 jobs PASS.
- Open blockers: none for UI; T1/GPU/physical audio/native targets UNVERIFIED.
- Next three steps: licensed tokens/primitives/shell; complete screen mapping;
  isolated upstream reference plus fidelity/egress/accessibility gates.

| Gate | This-session evidence |
|---|---|
| Linux/Rust |153/57 PASS; lint/fmt/types/clippy;26/72/92 licenses;38 denial/startup probes |
| Supervision |3 scenarios PASS, zero survivors |
| Web |23 tests +2 metrics PASS; typecheck/build/audit0 |
| Real SDK/smoke |SDK8 PASS; full incremental smoke6 stages PASS after adapter wiring |
| Real browser adapter |Models2/chat31 chars/saved turn1/WS v1 close1000/storage0; foreign HTTP origins0 |
| UI fidelity/full product |NOT DONE; speech pipelinefalse; no phase/release tags |

## Evidence and resume details

All earlier measurements/narratives preserved verbatim in
[UI audit/adapter archive](status-archive/2026-10-11-ui-audit-through-adapter.md),
SHA256 `ab6b9176cb168998fffaa0973c83d3adb60ce09897be9fac80ac0cf4660ca431`.
It links older archives, commands, commits, real measurements and failed runs.
No recorded measurement rewritten or deleted. Archive follows ADR0042.

This session: mission41c4338, inventory095817e, font research271d002 pushed;
exact hosted all5 jobs observed green for each. Inventory4183 files/105 recognized
assets; font comparisons120/no network attempts, actual specimens inspected,
OFL substitutions chosen with measured deviations. U0 manual trace/asset admission,
U4 renderer, U5 reference execution/fidelity and U6 gates remain unfinished.

Adapter contract/tests first, existing screen wired to typed same-origin client.
Native browser fetch binding failure and tests-first stalled-reader/receiver
failures retained under ui-adapter-*. Fixed, rebuilt, real browser rerun PASS;
`evals/results/ui-adapter-browser.json` and ui-adapter-{source,rust,web-tests} logs.
`python tools/check.py`, `bash tools/check_rust.sh`, npm test/typecheck/build/audit,
`node evals/browser_adapter.mjs <playwright> <token-file> <output>` and
`bash tools/smoke_all.sh` actually executed. Raw ui-adapter-smoke-* retained;
historical smoke/supervision files restored. No whole-UI/WS egress or speech claim.

ADRs0052-57/[REVIEW_QUEUE](REVIEW_QUEUE.md) record legal substitutions,2000ms
new stalled-unit-test guard and raw-evidence-only whitespace preservation.
No product gate, deadline, tolerance or phase scope relaxed. Candidate adapter
commit/hosted CI still pending. Runtime PID1327 active on8769 for next slice,
config .sanctum/runtime-dispatch.json; do not rebuild during real engine gates.

Native notice/primitive slice: contract and3 SSR tests first (missing source
FAILED, retained), then implementation and actual in-app Licenses dialog. Root
notice embedded verbatim as React text, no HTML interpretation or external fetch.
`npm test/typecheck/build`, audit low0 PASS;23 web +2 metric tests.
`node evals/browser_licenses.mjs <playwright> evals/results/ui-licenses-browser.json`
PASS at1440x900/820x1180/390x844: exact notice text,12px minimum, opacity1,
reduced-motion0s, keyboard Enter/Escape/close/focus return, page errors0,
foreign HTTP origins0 and no horizontal overflow. Actual dialog widths860/788/358,
x290/16/16 and y90/230/62. Screenshots inspected and retained.
Initial screenshot inspection found top-left placement from Preflight margin reset;
new centering test FAILED first, fixed explicit margin/inset/max-width, reran PASS.
Failure and earlier diagnostic retained;1CSS-pixel tolerance unchanged (ADR0058).

Full `python tools/check.py` PASS153 and `bash tools/check_rust.sh` PASS57,
fmt/clippy/licenses26/72/92,38 denial/startup probes and supervision3/zero survivors.
Full incremental `bash tools/smoke_all.sh` PASS6 actual stages after notice wiring;
ui-primitives-* raw logs/results preserve this run; prior measurements restored.
Bundle actual JS212.24kB/gzip67.70kB, CSS15.05kB/gzip3.98kB (diagnostic, no new
performance pass threshold claimed). No new npm/font/icon dependency. Existing
palette retained until the full theme port; U6 fidelity/axe/WS egress pending.
Candidate slice commit/hosted CI next; no merge or release tag.
