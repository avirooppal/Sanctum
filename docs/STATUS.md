# Current state

- Current step: Step 0, S0-1 cancellation contract; Step 1 blocked by the Step 0 gate.
- Last locally/hosted green commit: `24c7874`; H1/H2 commit `0cc3859`.
- Open blockers: cancellation and process supervision are unimplemented; full
  engine storm/shutdown/overload gates are unmeasured. Hosted CI blocker resolved.
- Next three steps: implement the common cancellation contract/context; implement
  owned process supervision; implement cancellable engine I/O.

| Step 0 gate | Current result |
|---|---|
| Disconnect -> slot release p95 by engine | NOT MEASURED; inference, Knowledge and speech still block |
| Process/FD/thread/socket/RSS storm cleanup | Partial: no-engine ingress only; real-engine storms pending |
| Active-engine bounded shutdown | NOT MEASURED |
| Minutes of mixed-engine overload with bounded queues | NOT MEASURED; upload-only ingress flood is insufficient |
| Held authenticated WebSocket | PENDING: re-run against the real authenticated WebSocket in Step 1a |

No Step 0 completion claim or phase tag. Step 1 has not started.

## This session: baseline and housekeeping

2026-10-10, baseline `c94ab89` already checked out, three unrelated untracked paths
preserved. Re-read plan.md and status before editing. Commands/results observed:

| Command (repository root unless noted) | Result |
|---|---|
| Linux dev-venv `python tools/check.py` | PASS 132 tests, lint/format/type/license/eval checks |
| Linux `bash tools/check_rust.sh` | PASS 26 tests, 74 crate licenses, 22 bootstrap + 16 runtime/child kernel denial probes |
| `npm test` in apps/web | PASS 12/12 |
| `npm run typecheck`; `npm run build` in apps/web | PASS |
| `npm audit --audit-level=low` in apps/web | PASS, zero vulnerabilities |
| `uv run --offline --group knowledge python evals/sdk_chat.py --base-url http://127.0.0.1:8769/v1 --token-file <state>/local.token` | PASS 8/8; chat 0.2139s; streaming TTFT 0.2652s; embedding dims 1024 |

Logs: `.sanctum/finish0-baseline-{source,rust}.log`; SDK JSON:
`evals/results/phase1-sdk.json`. These local checks do not imply hosted CI success.

H1: archived the entire preceding STATUS.md verbatim, including every measurement
and historical phase row. Verified byte-identical SHA256
`e8209abbfab681fc737ffd20c1a6f8074ea773a9ee08c4bf933b06715084489c` before replacement.
[Historical narratives, 2026-10-06 through 2026-10-10](status-archive/2026-10-06-through-10.md).
Historical records are provenance, not claims of tests rerun this session.
Git-object verification also confirms the archived blob is byte-identical to
`c94ab89:docs/STATUS.md` (SHA256
`1f09b8f8eb2762c49d0e04a24ffbbb2c0863d00245f305153eb12ef57c60e1ba`).
The preceding working-file hash includes Windows line endings.

H3 initial hosted result: [run 38051628648](https://github.com/avirooppal/Sanctum/actions/runs/38051628648),
commit `c94ab89`: Linux source PASS, Rust PASS, web PASS; macOS FAIL (two Knowledge
retrieval tests: `sqlite3.Connection` lacks `enable_load_extension`); Windows
CANCELLED by matrix fail-fast. Full macOS log retrieved as authenticated account
`avirooppal`, saved at `.sanctum/ci-macos-failure.log`. Repair pending; no checks skipped.

H3 repair `24c7874`: require uv-managed Python 3.12; disable matrix fail-fast so all
platforms report results. No checks weakened. [Hosted run 38051917489](https://github.com/avirooppal/Sanctum/actions/runs/38051917489)
completed with **all five jobs PASS**: source Linux, source Windows, source macOS,
Rust foundation and web. Observed through the GitHub jobs API this session.

## Phase table

## S0-1 context foundation slice — partial propagation

Contract `cancellation-v1.md` and ADR 0031 precede implementation; tests first failed
on absent cancellation module and ingress context lookup. Four context/compatibility
tests and one real TCP disconnect/association-cleanup test now pass. Context clones
flow through ingress, dispatch, inference, Knowledge/ingestion and speech Rust entry
points. Legacy send remains compatible. In-flight blocking calls and nested Python
engine work still need S0-2/S0-3; this is NOT measured engine cancellation.

Fresh final `bash tools/check_rust.sh`: PASS 31 tests, 74 licenses, 38 denial probes;
log `.sanctum/cancellation-context-rust-final.log`. Linux `python tools/check.py`:
PASS 132 tests plus formatting/lint/types/licenses/evals, log
`.sanctum/cancellation-context-source.log`. `python evals/ingress_limits.py --binary
target/debug/sanctum-runtime --output evals/results/ingress-limits.json`: PASS,
100 disconnects; header/body release 1.878433/1.875964s, FDs 5->5, threads 13->13,
RSS 5120->5248 KiB; health-only shutdown 0.015968s. No engine-release claim.

Updated runtime reached readiness before real tests. Initial restart command failed
shell parsing; corrected separate TERM/start commands succeeded. No WSL recovery or
test exemption needed. SDK command from baseline: PASS 8/8, chat 0.4126s, TTFT
0.4872s, dims 1024. Browser command `SANCTUM_BASE_URL=http://127.0.0.1:8769 node
evals/browser_speech.mjs <playwright-package> <token-file> .sanctum/speech-smoke/jfk.wav
asr-parakeet-q4k-reference tts-flite-slt-reference tts-flite-slt-reference`: PASS 7/7,
zero page errors; physical audio/microphone unverified. `python evals/gateway_dispatch.py
--token-file <state>/local.token --output evals/results/gateway-dispatch.json`: PASS,
two real chat streams plus ingestion; health/models p95 25.527/28.627ms; overload
503 in 17.683ms. Initial held HTTP upload times out; no held-session claim.

ADR 0032 proposes resident speech workers for Step 1b/1c, with bounded confined IPC,
health/restart/cancel behavior and proposed T0/T1 residency budgets. Budgets are
design limits, not measured model footprints; implementation deferred as requested.

## Phase table (scope and historical evidence)

These scope-limited phase records retain the historical evidence; only the session
baseline above was rerun today. Step 0 is the current hardening prerequisite to
continuing Phase 3 speech work, not a reset of the original Phase 0 roadmap.

| Phase | State | Gate / evidence |
|---|---|---|
| 0 Foundations | done for Linux x86_64 reference | Doctor/profile and real containment probes; other runtime platforms fail closed |
| 1 Chat | reference implemented | Historical offline install 50.6005s (later 31.7311s); SDK freshly 8/8; downloads/build excluded |
| 2 Knowledge | done under ADR 0014 scope | Historical synthetic v6 vector/hybrid recall@5 0.60/1.00, judge 0.60/1.00; no independent human audit |
| 3 Speech | in progress | Real T1 end-of-speech-to-first-audio p95 <800ms and corpus WER remain UNVERIFIED |
| 4 Vision | not started | Measurable visual QA lift UNVERIFIED |
| 5 Agents | not started | Red-team suite and zero unexpected ledger egress UNVERIFIED |
| 6 Single-owner hardening and packaging | not started | ADR 0027: install -> doctor -> answer per claimed package; offline signed-bundle chat/speech/cited RAG; tamper rejection; encryption wrong-key/canary/rotation/backup tests; concurrent voice/chat/ingest/agent soak >=1 hour with FD/process/memory monitoring and latency degradation reported. UNVERIFIED |
| 7 Ecosystem | not started, optional | Remaining polish only after prior gates |

Phase 6 team/SSO/Postgres/pgvector/Helm/multi-user quotas and 20-user load gate:
**Out of scope by decision**, [ADR 0027](adr/0027-single-user-scope.md).
