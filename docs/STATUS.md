# Current state

- Mission: [MISSION.md](MISSION.md), Amendment1; single owner ADR0027.
- Step: U2 adapter implemented/tested on `ui-hermes-port`; visual port pending.
- Last hosted-green: `271d002`, run38123930947/all5 jobs PASS.
- Open blockers: none for UI; T1/GPU/physical audio/native targets UNVERIFIED.
- Next three steps: adapter push/exact hosted CI; licensed tokens/primitives/shell;
  isolated upstream reference plus fidelity/egress/accessibility gates.

| Gate | This-session evidence |
|---|---|
| Linux/Rust |153/57 PASS; lint/fmt/types/clippy;26/72/92 licenses;38 denial/startup probes |
| Supervision |3 scenarios PASS, zero survivors |
| Web |20 tests +2 metrics PASS; typecheck/build/audit0 |
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
