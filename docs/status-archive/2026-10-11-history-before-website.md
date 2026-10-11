# Current state

- Authority: MISSION Amendment1, WRAPUP, ADR0027; feature freeze active.
- Step: frontend history search/rename/delete committed,pushed,all5 hosted CI jobs PASS.
- Last green commit: `792080b3c5b629e8a16febd4d6cb5f7d7a19fa80`; hosted run38149612305/all5 PASS observed.
- Current slice: source157/Rust62/web36 PASS;38 denial probes;9 real smoke stages PASS;Linux WS13 PASS.
- Open failures: earlier Windows handshake<2s failure;doctor no-fit at8167555072 bytes. Neither waived.
- Open gates: remaining UI/fidelity,full voice,vision,agents/ledger,LAN,crypto,packages/soak.
- Next3: model picker with fit/license metadata;settings/status and chat controls;U6 fidelity/accessibility/egress gates.
- Main/tags: UI branch unmerged;no tags;owner untracked artifacts preserved.

## Conversation-history slice

Source: `792080b3c5b629e8a16febd4d6cb5f7d7a19fa80`, based on last green24d60dc. ADR0063/REVIEW_QUEUE records new
interface bounds and non-forensic deletion semantics. OpenAPI0.2.0 adds sessions;
legacy conversation responses remain unchanged. Populated/idempotent SQLite
migration,owner isolation,late-save rejection and invalid bounds are tested.
Frontend search/rename/confirmed delete uses real storage;HTML-looking titles
remain inert. Mobile Escape bug found by the new browser test, fixed, same test
rerun. Desktop/mobile screenshots inspected; this is not a Hermes-fidelity claim.

Commands actually run on the slice:
- `python tools/check.py`:157 tests,Ruff/format/ty/API docs;26 Python/72 npm licenses,5 font hashes PASS.
- `bash tools/check_rust.sh`:62 tests,fmt/clippy,92 crate licenses,38 denial/startup probes PASS;supervision3/zero survivors,release0.565742/0.527717/0.566518s.
- `npm test --prefix apps/web`:34+2 PASS;typecheck/build PASS;`npm audit --audit-level=low --prefix apps/web`:0 advisories.
- `bash tools/smoke_all.sh`:9 stages PASS,release_complete=false;SDK8/chat0.5694s/TTFT0.4939s/1024 dimensions (not controlled SLOs).
- `node evals/browser_sessions.mjs <Playwright> <token-file> <output>`:15 named checks PASS,zero foreign requests/page errors;mobile Escape/no-overflow included.
- WSL `python evals/realtime_transport.py --token-file <owner-token-file> --output evals/results/sessions-realtime-transport.json`:13 PASS,handshake1.872044s,partialframe1.881019s;held gate PENDING,not rerun.

Hosted exact-SHA results: evals/results/sessions-hosted-ci.json,all5 PASS.
Raw evidence: evals/results/sessions-*; full results indexed as E9 in
[PLAN_COVERAGE](PLAN_COVERAGE.md), R-UI in [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md).
Failures preserved: expected tests-first missing API;old runtime413;incorrect
Windows token path;mobile Escape timeout;WSL formatting filesystem error;
document encoding/restart command errors. No threshold/timeout changed.
Actual controlled restart stopped the previous gateway and8owned child PIDs in
1.507s/zero survivors;this is not the active-engine shutdown acceptance gate.

## Preserved history

Previous status archived verbatim at [docs-first audit](status-archive/2026-10-11-docs-first-audit.md),
SHA256 `2691f0e3d70673b7886c74bc21fda20728cb0311cb4c05155f4638ebc35ed014`. Earlier archive links and every prior measurement remain there.
