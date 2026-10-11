# Current state

- Mission: [MISSION.md](MISSION.md), including Amendment1; single owner ADR0027.
- Step: U1 audit in progress on `ui-hermes-port`; no product UI copied yet.
- Last hosted-green commit: `095817e`; exact run38123085006/all5 jobs PASS.
- Blockers: none for this slice; T1/GPU/physical audio/native targets UNVERIFIED.
- Next three steps: font file admission/complete screen mapping; typed UI
  adapter and tokens/primitives; shell plus fidelity/egress/accessibility gates.

| Gate | This-session evidence |
|---|---|
| Linux source | PASS150 baseline; PASS153 with inventory tests; lint/format/types/licenses |
| Rust/denial/startup | PASS57; fmt/clippy;92 licenses;38 denial/startup probes;3 supervision scenarios/zero survivors |
| Web | PASS12 plus2 font-metric tests; typecheck/build; npm audit zero |
| Real SDK | PASS8; chat0.4156s/TTFT0.4916s/dimensions1024 |
| Incremental smoke | PASS6 stages; release_complete=false; pending release software listed |
| Step U foundation/final product | NOT DONE; no fidelity, new UI egress or release tag claimed |

## Preserved history

Previous STATUS preserved verbatim in
[WebSocket/source-pin archive](status-archive/2026-10-11-websocket-and-source-pin.md).
SHA256 `a2620d7c3a974962387b0dcd0c3e23a36d62a2befb60510b7ca7bad322f3fbc9`.
Older archives and real held/mixed/shutdown measurements remain linked there.
Archive byte preservation uses existing ADR0042 attributes; no measurement changed.

## Current slice evidence

Mission amendment appended verbatim and pushed as41c4338. Hosted exact-SHA
[run38122334255](https://github.com/avirooppal/Sanctum/actions/runs/38122334255)
observed all5 jobs completed/success. No phase or release tag created.

Before edits: WSL `python tools/check.py`, `bash tools/check_rust.sh`; web
`npm test`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=low`.
Logs .sanctum/amendment-baseline-{source,rust,sdk,smoke}.log.
Started real confined runtime with .sanctum/runtime-dispatch.json on8769;
waited for observed ready event before SDK requests. SDK raw evidence
[amendment-baseline-sdk.json](../evals/results/amendment-baseline-sdk.json).
Supervision [raw result](../evals/results/amendment-baseline-supervision.json).

Windows Git Bash `bash tools/smoke_all.sh` against the real WSL gateway PASS
chat/RAG/fileASR/fileTTS/tickets/browser. Raw logs/results are named
amendment-baseline-smoke-* in evals/results; original smoke evidence restored.
ASR8 first request4.2908896s, TTS8 first request1.1027608s; browser7/page errors0,
mobile no overflow. No physical audio or streaming voice-turn latency claim.
Smoke remains explicitly incremental, not final fresh-clone/LAN acceptance.

Inventory contract and3 tests written first: absent implementation failed,
[preserved failure](../evals/results/ui-inventory-tests-first-failure.txt), then
PASS3. Real command:
`.venv/Scripts/python.exe tools/ui_inventory.py --root .sanctum/upstream/hermes-agent --sha b30f95ac4a80d2f6dbe3aa01001b0524314f6d74 --output evals/results/ui-source-inventory.json`.
PASS4183 target files/105 recognized assets,3.55MB deterministic-format audit.
WSL-mounted scan was slow and manually terminated; Windows Python rerun completed.
No product process killed, check skipped or threshold changed. Static candidates
are not proof of runtime behavior or completed manual route/asset audit.

After changes: full Linux source PASS153/all gates, Rust PASS57/all gates,
92 Rust/26 Python/72 npm licenses,38 denial/startup and supervision3/zero survivors.
Named [source log](../evals/results/ui-inventory-source-check.txt) and
[Rust log](../evals/results/ui-inventory-rust-check.txt). New tooling is not a
product dependency. Exact MIT reference notice retained; no font binary admitted.
ADRs0052/53/54 and REVIEW_QUEUE preserve package/font/asset exclusions.
Pinned primary OFL license hashes: ui-font-license-audit.json; actual render
comparison, palette origin licenses, product primitives and in-app notices pending.

Candidate slice not yet hosted-verified; record commit/run after push. Runtime
PID1327 remains active on8769 for following UI verification; do not rebuild it
while real measurements run. Next: finish U1; no merge to main until U6 gates.

Font audit follow-up: inventory commit095817e hosted exact-SHA
[run38123085006](https://github.com/avirooppal/Sanctum/actions/runs/38123085006)
all5 jobs observed completed/success. ADR0055 records actual120 font render
comparisons with foreign requests0 and selected OFL substitutes. Specimen section
screenshots inspected; no upstream UI application/fidelity pass claimed. Metric
unit tests2 PASS, including invalid RGBA rejection; original12 web tests PASS,
typecheck/build/audit0. Full source153/Rust57/license/denial/supervision gates
rerun PASS; named ui-font-{source,rust}-check.txt and ui-font-supervision.json.
`bash tools/smoke_all.sh` rerun PASS6 current-feature stages; raw ui-font-smoke-*.

Failures retained: tests-first absent metric module, invalid-channel test first,
initial long text overflow, wrong preliminary Spectral ExtraLight selection.
Corrected Regular file and identical short text across all pairs, reran120.
No canvas, product timeout, tolerance or fidelity gate relaxed. ADR0056 records
five primary MIT palette-origin permissions and exact icon package notices;
UTF8 console inspection error corrected. No npm dependency or product font added.

Three old smoke failure files accidentally copied by a broad glob in095817e are
archived under evals/results/archive/ui-audit-imported-historical-failures/ with
provenance. They are duplicates of historical failures, NOT current-session runs.
Original files preserved; no failed measurement rewritten. Font selection still
requires actual product file admission, weight/language testing and full U6 gates.
