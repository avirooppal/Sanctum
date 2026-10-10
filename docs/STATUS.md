# Current state

- Current step: Step 0, S0-3 cancellable engine I/O verified locally; Step 1 blocked by the Step 0 gate.
- Last locally/hosted green commit: `c38ab2a`; H1/H2 commit `0cc3859`.
- Open blockers: engine-wide admission and response throughput remain incomplete; full
  engine storm/shutdown/overload gates are unmeasured. Hosted CI blocker resolved.
- Next three steps: commit cancellable I/O; enforce response throughput; measure active-engine shutdown.

| Step 0 gate | Current result |
|---|---|
| Disconnect -> slot release p95 by engine | PASS gateway slot release: 50 samples each chat/Knowledge/ASR/TTS, p95 151/208/178/178ms; shared-engine compute stop not established |
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

## S0-2 guardian verification

Confined guardians now own worker process groups, receive parent-death signals,
escalate INT/TERM/KILL, and reap adopted descendants. First supervision test failed
on missing module before implementation. `tools/verify_supervision.py` exercises
real confined uncooperative processes. First harness prototype received the old
runtime's health record instead of fixture PIDs and failed; added strict PID-schema
validation and the confined fixture entry before rerunning. No failed run counted.

Pre-transport-fix full Rust gate: 33 tests, 74 licenses, 38 denial probes PASS;
Linux source gate 132 tests plus lint/format/types/licenses PASS. Confined fixtures
TERM/parent-death/natural exit all left zero surviving PIDs in approximately
0.57/0.54/0.57s. Final rerun numbers will be recorded before commit.

Real SDK 8/8 and browser speech 7/7 passed. Repeated mixed-dispatch verification
exposed two existing ingress close races: response lacked Connection: close (new
socket test failed before fix); overload rejected with unread body could reset TCP
before 503 was observed (Windows WinError 10053). Linux replay passed but does not
excuse the Windows failure. Response headers now explicitly forbid reuse, and
rejection half-closes then drains at most 50ms/64KiB. Reverification pending.
No retries, test deletion, skips or threshold relaxations were added.

Final `bash tools/check_rust.sh` PASS: 33 tests, 74 crate licenses, 38 kernel
denial probes, plus three process-tree scenarios (now mandatory in this script).
Log `.sanctum/supervision-close-rust.log`. `python tools/verify_supervision.py
target/debug/sanctum-runtime` measured TERM **0.565680s**, parent-death **0.528694s**,
natural exit **0.565877s**, zero surviving/zombie fixture PIDs in every scenario.
Evidence: `evals/results/process-supervision.json`. This is not a real-engine storm.

Final ingress scripts from ADR 0029: PASS 100 disconnects; header/body stalls
**1.878264/1.876041s**, FDs 5->5, threads 13->13, RSS 5120->5376KiB; health-only
shutdown 0.214233s. Three-minute upload flood: **3413 health samples**, p95
**6.473ms**, max **15.953ms**; FDs 5->5, threads 13->13, RSS 5376->14392KiB,
peak 14440KiB (within +16MiB). These remain no-engine ingress measurements.

Five consecutive final `evals/gateway_dispatch.py` runs passed two chat streams
plus ingestion and 12 overload attempts each. Across runs: health p95 <=25.686ms,
models p95 <=27.717ms, first 503 <=15.646ms. All commands used the existing
`--token-file <state>/local.token --output evals/results/supervision-dispatch-N.json`.
**Remaining transport concern:** one Windows WinError 10053 recurred after bounded
rejection draining and before these five passes. It was not counted as a pass or
silently retried. Linux replay passed. Control-packet capture of the five passing
runs found no RST; the intermittent Windows failure remains a full-storm investigation
item. No claim that five successes establish the complete S0-7/S0-8 gate.

Final real SDK: PASS 8/8, chat 0.3103s, TTFT 0.2827s, embeddings 1024. Browser speech
on supervised workers: PASS 7/7, zero page errors; physical playback unverified.
All real requests waited for runtime readiness. S0-3 onward remains incomplete.

## S0-3 cancellable engine I/O

Based on `c38ab2a`, whose hosted [run 38053769682](https://github.com/avirooppal/Sanctum/actions/runs/38053769682) passed all five jobs.
Nonblocking context-aware pipes now interrupt Knowledge reads/writes; cancelled
Knowledge workers restart on the next request without replaying mutations. Speech
cancellation terminates its owned process tree. A confined request-specific HTTP
bridge closes inference connections on cancellation without killing resident models
(ADR 0033). Additive dispatch counters expose queued/active lane counts for measurement.

Tests first: missing ContextIo/dispatch counters failed before implementation; three
real socket-pair tests cover blocked read, blocked write and partial-frame delivery.
Initial ASR harness failed to observe its engine because it scanned only the main
thread's children. Added a failing-then-passing descendant-enumeration regression
and scan all task child lists; no failed run counted as a pass.

Commands/results observed this session:

| Command | Result |
|---|---|
| Linux `bash tools/check_rust.sh` | PASS 37 tests, format/clippy, 74 licenses, 38 denial probes, three supervision scenarios |
| Linux `python tools/check.py` | PASS 133 tests, lint/format/types/licenses/evals/API docs |
| `cargo build --locked --offline -p sanctum-gateway --bin sanctum-runtime` | PASS; real configured runtime reached readiness |
| SDK command recorded above | PASS 8/8, chat 0.3443s, TTFT 0.3716s, dimensions 1024 |
| Browser speech command recorded above, after cancellation runs | PASS 7/7, zero page errors; physical playback/microphone unverified |
| `python evals/gateway_dispatch.py --token-file <state>/local.token --output evals/results/cancellable-dispatch.json` | PASS two chat streams + ingestion; health/models p95 28.551/26.778ms; first 503 15.872ms |

Linux command `python evals/cancellation_release.py --pid 55195 --token-file
/home/aviroop/.local/share/sanctum-dispatch-smoke/local.token --mode MODE --output
evals/results/cancel-MODE.json` ran 50 samples for EACH mode, sequentially, exit 0.

| Real engine mode | Disconnect -> gateway slot p95 | Maximum |
|---|---:|---:|
| chat (resident llama.cpp) | 0.151116s | 0.162824s |
| Knowledge ingestion (nested embedding/rerank) | 0.207841s | 0.210524s |
| ASR (Parakeet CLI) | 0.178409s | 0.192204s |
| TTS (Flite CLI) | 0.178116s | 0.194712s |

All meet ADR 0031 p95 <=2s/max <3s. Chat/Knowledge recovery requests succeeded;
speech CLI PIDs were absent after cancellation. This measures gateway slot release,
not complete resource-baseline recovery or proof of shared model compute cessation.
Full real-engine leak/storm, active shutdown and minutes of mixed overload remain
UNVERIFIED. Held authenticated WebSocket remains PENDING Step 1a.
Logs: `.sanctum/cancellable-final-rust.log`, `.sanctum/cancellable-source-final.log`,
`.sanctum/cancel-{chat,knowledge,asr,tts}.log`; committed JSON preserves all 200 samples.

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
