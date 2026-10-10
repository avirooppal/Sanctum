# Current state

- Current step: Step 0, S0-7 S0-7 cancellation/storm/repeated-shutdown gate passed; S0-8 next; Step 1 blocked by the Step 0 gate.
- Last locally/hosted green commit: `6eeed8b`; H1/H2 commit `0cc3859`.
- Open blockers: three-minute mixed-engine overload remains to verify.
  Held authenticated WebSocket remains explicitly deferred to Step 1a.
  Repeated active shutdown and sustained mixed overload remain unverified. Hosted CI is green.
- Next three steps: commit/push S0-7; run mixed-engine overload; full final regression and egress checks.

| Step 0 gate | Current result |
|---|---|
| Disconnect -> slot/compute release p95 by engine | PASS 50 per mode/method; chat 156ms, Knowledge 1327ms, reranker 1177ms, ASR 230ms, TTS 233ms actual compute p95; explicit sets also pass |
| Process/FD/thread/socket/RSS storm cleanup | PASS all five engine paths, disconnect/explicit and floods; exact role/FD/socket restoration, thread tolerance, worst RSS +13248KiB |
| Active-engine bounded shutdown | PASS latest 0.976377s active + queued; listener 0.169111s, zero survivors; three repeated cycles PASS (max 1.199s) |
| Minutes of mixed-engine overload with bounded queues | NOT MEASURED; upload-only ingress flood is insufficient |
| Held authenticated WebSocket | PENDING: re-run against the real authenticated WebSocket in Step 1a |

No Step 0 completion claim or phase tag. Step 1 has not started.

## Earlier slices this session

[Baseline, housekeeping and S0-1 through S0-6, verbatim](status-archive/2026-10-10-foundations-through-admission.md).

## S0-7 work in progress (not a gate pass)

S0-6 committed/pushed `6eeed8b`; hosted run 38056305199 completed successfully.
Resident engine restart contract ADR 0036 and failing missing-function test preceded
implementation. Bounded restart/backoff test passed. Initial real crash command
`python evals/engine_crash.py --pid 5655 --token-file <state>/local.token --output
evals/results/engine-crash-first.json` FAILED: killed stream released in 0.050995s,
but the immediate subsequent chat got 502 during reload. Kept the failed evidence.
A separate stalled-health socket test also FAILED its <500ms bound before adding
250ms health-probe deadlines. Fix under verification: new requests wait on bounded
health GETs under existing cancellation/permits, then send generation POST once.
Never replay an affected request. Independent engine continuity still needs rerun.
Crash rerun `python evals/engine_crash.py --pid 8306 --token-file <state>/local.token
--output evals/results/engine-crash.json`: PASS affected stream released 0.050580s,
independent embeddings succeeded, next chat status 200 after 7.043043s recovery,
old worker PID absent. A shared model crash can still affect every request already
inside that model process; no zero-downtime or single-request fault isolation claim.
Full storm and Step 0 gates remain open.
Stronger queued crash rerun `engine-crash-queued.json` PASS: affected stream
0.044796s, queued and next status 200, recovery 7.445975s; all role FD/socket/thread
counts returned, maximum positive RSS delta 3664KiB. Exact resources retained in JSON.

Post-fix full Rust gate: PASS 43 tests, fmt/clippy, 74 licenses, 38 denial probes,
three supervision scenarios (`.sanctum/resident-recovery-rust.log`). Source gate
PASS 134 tests/all checks after adding the resource-gate regression (a later
harness-only warmup refinement passed ruff). First real storm FAILED after 50 chat disconnect attempts: chat RSS 942100 ->
981908KiB (+39808KiB), above +16384KiB; other resource counts returned. Evidence
`evals/results/engine-storms-cache-failure.json`, `.sanctum/engine-storms.log`.
Pinned llama-b11429 help, executed via `unshare --user --map-root-user --net`,
reports default RAM prompt cache 8192MiB. Disable this optional cache explicitly;
rerun the unchanged resource thresholds. No failed run counted as green.
Cache-disabled first warmup timed out before a complete response header; preserved
`.sanctum/engine-storms-bounded.log` (no pass). Single-request SDK 8/8 and three
chat cancellation checks passed afterward. Diagnostic rerun with tracing passed
chat resource comparisons, then FAILED embedding RSS 982292 -> 1038228KiB
(+55936KiB). Evidence `evals/results/engine-storms-embedding-rss-failure.json`.
Resident allocator settings are under verification; unchanged resource thresholds.
The allocator/execution refinement warmup FAILED its incidental large-embedding
header setup wait: 30.031s, zero bytes. Preserved `.sanctum/engine-storms-setup-timeout.log`.
ADR 0037 explicitly extends only this 128-input embedding setup wait to 120s;
all resource, delivery, cancellation, chat and shutdown bounds remain unchanged.
The complete Knowledge warmup then FAILED its original 60-second client setup
wait before recording a baseline. ADR 0038 adds a 240-second warmup-only setup
exception within existing worker/caller bounds; restart before rerun. No gate
threshold or storm case removed. Failed setup log preserved. First immediate
restart failed with EADDRINUSE because prior shutdown was still completing;
confirmed no old gateway remained and retried only the launch. Failure log:
`.sanctum/full-warmup-start-failure.log`; no WSL reset or flaked pass counted.
Latest storm passed chat/embedding disconnect, slow-reader and overload resource
checks (50/16/100 attempts, real engine starts 6/6/4; shed/refused attempts counted
separately). It then FAILED after 50 Knowledge cancellations: embedding RSS
931460 -> 1085324KiB (+153864KiB). Preserved `engine-storms-knowledge-rss-failure.json`.
ADR 0038 corrects the omitted Knowledge warmup with exactly one complete reference
ingestion, not repeated warmup until a result passes. All tolerances unchanged.
This threshold exception needs review; no workload/test removed.
The stronger `evals/engine_crash.py --pid 690 ... --queued --output
engine-crash-queued-first.json` FAILED: second admitted request also got 502.
New contract/test for a cancellable one-slot execution lease failed on missing
function before implementation. Pending work will remain outside the model's
opaque queue under the existing two-request admission bound. Fix awaiting rerun.
Cache-disabled crash rerun passed: affected stream 0.060385s, next request 200,
recovery 7.421056s, old PID reaped (`engine-crash-cache-bounded.json`).

Fresh-runtime complete-workload storm run PASS: chat disconnect/slow-reader/overload
and 50 cancellations each Knowledge/ASR/TTS; exact role/FD/socket counts returned,
threads within allowance, worst retained RSS +10404KiB (<16384KiB).
`evals/results/engine-storms.json` preserves every per-role snapshot and outcomes.
Direct observer smoke: chat 3/3 PASS, compute p95 0.157115s. Knowledge FAILED actual
model idle maximum >3s after gateway release (`compute-knowledge-smoke.json`).
ADR 0040 bounds embedding HTTP batches across Rust/Python; eight-input compute smoke FAILED >3s, so tighten to one input while keeping timing bounds. Failed evidence `bounded-eight-compute-failure.json`. Tests first failed
(missing Rust adapter and Python 17-input call), implementation awaiting checks.

One-input real compute smoke PASS: Knowledge disconnect 3/3, compute p95
1.086652s; explicit cancel 3/3, compute p95 1.127434s; all below unchanged two-second
bound. Owner API unauthorized/method/body/idle checks passed in the explicit run.
Crash/storage extension FAILED: failed stream saved one turn (`engine-crash-storage-first.json`).
Add verified helper exit and complete-capture persistence guard; rerun before commit.

Storage fix real rerun PASS (`engine-crash-storage.json`): affected stream
0.057408s, queued/next both 200, recovery 11.590765s, failed request saved zero turns,
all per-role resource comparisons passed. `evals/conversation_completion.py` PASS:
normal nonstream/stream each saved one completed turn. Official SDK multi-input
embedding check PASS: 17 inputs, 1024 dimensions, 1.643507s, scalar max difference
0.0, prompt/total token usage 126. No inference retry or fabricated completion.
Reranker pair-score equivalence (private namespace, three candidates) PASS max
difference 0.0. Bound its candidate subrequests too; unit test first failed on a
three-candidate request, then implemented stable descending global pair ranking.

## S0-7 measured cancellation and resource gate

Command: Linux `python evals/engine_storms.py --pid 689 --token-file
/home/aviroop/.local/share/sanctum-dispatch-smoke/local.token --runtime-config
.sanctum/runtime-dispatch.json --output evals/results/engine-storms-verified.json`.
PASS, exit 0, 500 real cancellations total; each engine/method 50 samples. Model
slot counters verify chat/embedding/reranker computation idle; speech CLI PID absence
verifies speech job cleanup. Every stage returned exact persistent process-role,
FD and socket counts; threads within +2, retained RSS worst +13248KiB (<16384).
No vanished/malformed counter treated as idle. Logs `.sanctum/engine-storms-verified.log`.

| Engine path / cancellation | Gateway p95 s | Compute p95 s | Compute max s |
|---|---:|---:|---:|
| chat disconnect | 0.135734 | 0.156058 | 0.159783 |
| chat explicit | 0.047779 | 0.072492 | 0.082843 |
| Knowledge disconnect | 0.194241 | 1.326519 | 1.379578 |
| Knowledge explicit | 0.123515 | 1.292092 | 1.405114 |
| reranker disconnect | 0.214538 | 1.177047 | 2.566670 |
| reranker explicit | 0.137529 | 1.098733 | 1.299330 |
| ASR disconnect | 0.224239 | 0.230192 | 0.268458 |
| ASR explicit | 0.156287 | 0.165230 | 0.168652 |
| TTS disconnect | 0.227064 | 0.232941 | 0.245985 |
| TTS explicit | 0.149767 | 0.157321 | 0.165192 |

All meet unchanged ADR 0031 p95 <=2s/max <3s. JSON
`engine-storms-verified-<mode>-<method>.json` preserves every sample.
Flood cases: 50 disconnect attempts (6 started, 44 shed), 16 slow readers
(7 started, 9 shed), 100 overload attempts (4 started, 67 shed, 29 connection
refusals). Refusals counted separately, never as HTTP 503. Per-stage maximum
retained RSS deltas 128/9728/10368KiB, all within the original tolerance.

Latest `python evals/active_shutdown.py --pid 689 --token-file <state>/local.token
--output evals/results/final-active-shutdown.json`: PASS active [1,1,2,1], queued
[0,0,1,0], actual Parakeet job and slow upload; listener closure 0.169111s,
shutdown 0.976377s, all 13 child PIDs plus gateway absent. Repeated-cycle script
is running; no pass claim for it or S0-8 yet. No Step 1 or phase tags.

Current code gates: full Rust 48 tests + fmt/clippy + 74 licenses + 38 denial
probes/supervision PASS; Linux source 138 tests + all source gates PASS. Further
harness/doc changes will be checked before commit.

## S0-7 repeated start/stop and regression completion

`python evals/repeated_shutdown.py --binary target/debug/sanctum-runtime --config
.sanctum/runtime-dispatch.json --output evals/results/repeated-shutdown.json`:
PASS three independent start/active-stop cycles, exit 0. Each had actual engine
work, active lanes [1,1,2,1], queued [0,0,1,0], and slow upload. Shutdown times
**1.198612/0.805526/0.854771s**; listener closures
**0.184407/0.184068/0.177636s**. Zero surviving owned PIDs; launchers reaped gateways.
Every process and its FD/thread/socket/RSS resources vanished at each stop.
Evidence in repeated-shutdown.json and the three numbered result files.

Fresh web `npm test`: PASS 12/12, no skips. `npm run typecheck`; `npm run build`:
PASS. `npm audit --audit-level=low`: PASS, zero vulnerabilities. Full source/Rust commands
remain 138/48 passing tests plus licenses/denial probes. S0-8 remains unmeasured,
so the aggregate Step 0 gate is NOT complete and Step 1 has not started.

Earlier same-session narratives archived verbatim with SHA256
`dc43f9838ed19ddd92550680be4536b83f4523736baa75b8c5df4f97319768ee`;
all previous measurements and failures retained.

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

S0-4 final SDK command recorded above: PASS 8/8, chat 0.3484s, TTFT 0.4335s, dimensions 1024.
