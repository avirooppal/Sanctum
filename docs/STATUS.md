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
