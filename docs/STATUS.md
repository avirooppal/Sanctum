# Current state

- Step: H1â€“H4 housekeeping before Step 1a; Step 0 HTTP reference passed.
- Last green commit: `cf75ca9`; baseline rerun below; no phase tags.
- Blockers: held authenticated WebSocket PENDING Step 1a; T1 latency and physical audio UNVERIFIED.
- Next: measure embedding throughput; measure chat cache cost/KV reuse; Step 1-pre/1a.

| Step 0 gate | Historical measured result (details in archive) |
|---|---|
| Cancel compute p95, all five engine paths | PASS <=2s, 50 samples per mode/method |
| Storm process/FD/thread/socket/RSS recovery | PASS; worst retained RSS +13248KiB <=16384 |
| Active shutdown and repeated start/stop | PASS latest 0.759479s; 3 cycles max 1.198612s; zero survivors |
| Mixed-engine overload >=180s | PASS 181.527274s; chat/ASR/TTS p95 3.330/4.424/1.364s; queue peak 3 |
| Held authenticated WebSocket | PENDING Step 1a; prior held uploads do not satisfy this |

## Historical evidence

Entire previous status, including superseded work-in-progress statements, preserved
verbatim in [Step 0 completion archive](status-archive/2026-10-10-step0-completion.md).
Archive SHA256: `c0f45bbdba4b48772d4fa1d0a240225c814fefe958ddadece806a74de43f0922` (raw bytes; prior measurements unchanged).
Earlier archives are linked inside that archive. No historical benchmark is a fresh run.

## Continuation baseline â€” H1 acceptance

Base `cf75ca9`, existing checkout already at the latest hosted-green head. No checkout
reset or unrelated untracked file changes. Read plan.md and previous STATUS completely.

| Command this session | Observed result |
|---|---|
| Linux `python tools/check.py` using sanctum-dev-venv | PASS 138 tests; lint/format/types, 26 Python +72 frontend licenses, evals/API docs; `.sanctum/continuation-source.log` |
| Linux `CARGO_BUILD_JOBS=1 bash tools/check_rust.sh` | PASS 49 Rust tests, fmt/clippy, 74 licenses, 22 bootstrap +16 runtime/child kernel denials, startup self-test, 3 supervisor scenarios; `.sanctum/continuation-rust.log` |
| Web `npm test`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=low` | PASS 12/12, no skips; typecheck/build PASS; zero vulnerabilities |
| Linux `target/debug/sanctum-runtime --config .sanctum/runtime-dispatch.json --port 8769` | Real ready response on 8769; first background launch did not persist, then an incorrect positional-config launch started health-only and was stopped; neither counted as SDK pass |
| Linux `python evals/sdk_chat.py --base-url http://127.0.0.1:8769/v1 --token-file <state>/local.token` | PASS 8/8; chat 0.3557s; TTFT 0.3838s; 1024 dimensions; `evals/results/continuation-baseline-sdk.json` |
| GitHub runs/jobs API, run 38073566115 | PASS all 5 jobs for exact cf75ca9 SHA; [run](https://github.com/avirooppal/Sanctum/actions/runs/38073566115) |

H1 pre-edit assertion FAILED on the stale blocker as expected. Corrected current
state; old narrative and every recorded measurement retained byte-for-byte.

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

H1 correction: `7960f76` pushed, but its command wrapper continued after a trailing
blank-at-EOF warning from `git diff --check`. Remove only that current-status blank
line; archive untouched. Future check/commit commands are success-gated separately.

H2: [Decision review queue](REVIEW_QUEUE.md) indexes timeout/threshold/tolerance
and scope changes, costs and failing evidence. Setup/baseline exceptions and human
review substitution are explicitly labelled; no original ADR changed. Link/required
entry checks and raw archive SHA256 PASS after correcting Windows validation text
encoding to UTF-8 (initial decode failure was not a pass). H1 correction `017ba95` pushed.
