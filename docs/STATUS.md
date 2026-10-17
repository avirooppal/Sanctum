# Current state

- Step: workflow-first v1 contract/gap audit;ADR0070 baseline repairs verified.
- Last green source:6339d359e041d7d21b949b2d1b9ee77e7564b963;hosted38293273975/all5 completed success.
- Current branch:codex/workflow-alignment;edited-SHA hosted CI pending push.
- Local baseline:source157/Rust67/web73 PASS;audit0;38 denial probes;11 real smoke stages PASS.
- Journey gates:J1/J7/J8/J10 PENDING;others PARTIAL;no full journey VERIFIED.
- Blockers:simulated onboarding/privacy/purge claims;missing policy/ledger,full voice,vision,packages,LAN/crypto.
- Next3:commit canonical workflow;consistency/secret checks;real onboarding and fail-closed capability/privacy alignment.
- Main remains unchanged;no phase/release tags. Owner untracked artifacts preserved.

## Workflow baseline and first contract slice

See WORKFLOW.md v1.0.0,WORKFLOW_GAPS.md B1-B5 and ADR0070/0071.
The untouched baseline failed Rust voice_priority and real UI smoke. The full
Rust retry passed unchanged. Missing Windows Python path and Linux .venv/uv
conflict were recovered in a separate ignored Windows venv. Existing file speech
and Stop status were restored;browser fixtures use explicit light theme,exact
accessible labels and verify the existing bundled docs route. No timeouts,
thresholds or security assertions were relaxed. Every failed run stays named.

Ran:bash tools/run_source_gate.sh;bash tools/check_rust.sh;npm test/typecheck/
build/audit;bash tools/smoke_all.sh. Actual results:157/67/73 tests,38 denial
probes,audit0,11 real stages PASS;release_complete=false. Supervision release
0.56731755/0.535976329/0.566351028s,zero survivors. Full voice/physical playback,
WER/DER/visual QA,ledger reconciliation and full journey budgets are unverified.
Raw:evals/results/workflow-baseline-*. Exact edited-SHA CI follows push.

## Preserved history

Previous STATUS archived verbatim at
[pre-workflow status](status-archive/2026-10-17-before-workflow.md),SHA256
`397347a34f0f4684d9bd286e8d9c8dd24b742c96bbf21449fc7335a1ad24987f`. Previous measurements and archive links are intact.
