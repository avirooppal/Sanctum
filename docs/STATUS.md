# Current state

- Step: Step 1-pre measurement/ADR complete locally; authenticated WebSocket next.
- Last green commit: `0404340`; all five hosted jobs verified; new slice awaiting push/CI; no phase tags.
- Blockers: held authenticated WebSocket PENDING Step 1a; T1 latency and physical audio UNVERIFIED.
- Next: implement authenticated WebSocket; run >=10min held-session/mixed gate; begin Step U source/license audit.

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

## H3a: measured embedding-batch ingestion cost

Contract `docs/contracts/embedding-cost-v1.md` and two tests preceded implementation;
initial test failed on missing module. Implemented evaluation-only historical adapter
and isolated Rust example; production one-input bound untouched. Command:

```sh
cargo build --locked --offline -p sanctum-gateway --example embedding_cost
target/debug/examples/embedding_cost .sanctum/runtime-dispatch.json \
  /home/aviroop/.local/share/sanctum-dev-venv/bin/python \
  target/debug/sanctum-runtime evals/results/embedding-cost-reference.json
```

PASS exit 0: three real repository documents (`architecture`, `threat-model`,
`profiles`), 23 structure-aware chunks, fresh SQLite catalog/vector stores,
three paired repetitions with alternating order after one warmup each. Full
parse/embed/publish timing, not embedding-only. Before = historical whole-document
HTTP batches; after = production one-input adapter. Model/config/corpus hashes,
base commit `9e09f0e`, CPU/memory and every sample in result JSON; launcher/harness
source is included in the commit containing this record.

| Variant | Measured seconds (three repetitions) | Mean documents/min | Mean chunks/s |
|---|---|---:|---:|
| Before, whole-document | 21.579137 / 22.246736 / 21.693477 | 8.243297 | 1.053310 |
| After, one-input | 22.425413 / 21.892479 / 22.577603 | 8.073704 | 1.031640 |

Throughput change **-2.057341%** on this small corpus, below ADR0004's 5%
regression threshold. Paired two-input vectors: maximum absolute difference **0.0**.
This is limited reference evidence, not a large-corpus throughput guarantee.
Existing cancel/RSS gates unchanged; no less-safe batch override added to production.

First launch using nsenter failed the child's host-Unix-socket denial check because
joining a namespace does not inherit seccomp. Preserved named failure JSON; no
samples counted. Recovery installs existing namespace/filter in the dedicated
example and uses the owned supervisor. Eight kernel checks passed before work.
Log `.sanctum/embedding-cost-isolated.log`. Gateway was stopped before the experiment.

H3b cache-on/off six-turn TTFT and actual per-slot KV reuse remain **PENDING**.
Inspection of pinned [upstream arguments](https://github.com/ggml-org/llama.cpp/blob/b11429/common/arg.cpp)
and [prefix reuse](https://github.com/ggml-org/llama.cpp/blob/b11429/tools/server/server-context.cpp)
shows `--no-cache-prompt` controls prefix reuse separately from `--cache-ram 0`.
Do not assert current per-slot reuse; measure current and proposed configurations
and rerun unchanged leak tolerances before adopting any alternative. No Step 1 code.

H4 current committed head `9e09f0e`: [run 38074564003](https://github.com/avirooppal/Sanctum/actions/runs/38074564003),
jobs API observed all five jobs completed successfully. Later commit needs its own
hosted verification. No prior gate measurement rewritten or new phase tag.

H3a post-change gates: Linux `python tools/check.py` PASS **140 tests**, lint,
format, types, licenses, eval/API docs (`.sanctum/h3-source.log`). Linux
`bash tools/check_rust.sh` PASS **49 tests**, fmt/clippy, 74 licenses,
38 kernel denial probes/startup self-test and three supervisor scenarios
(`.sanctum/h3-rust.log`); separate all-target clippy PASS including example.
Final process inventory found no embedding_cost/runtime/llama-server processes.
Current-state heading encoding corrected without modifying archive bytes.
Next slice: H3b six-turn cache comparison, KV reuse, and unchanged resource gates.

## H3b experiment in progress (not an acceptance pass)

Contract/tests first: missing-module test failed, then tests for content-only TTFT
and actual integer cache counters passed. First real cache-off trial FAILED because
process lookup matched both supervisor and engine aliases. Named failed result
retained; no conversation samples claimed. Added guardian-exclusion regression
(failed missing helper before implementation, then PASS three tests). Isolated
launcher supports only three explicit evaluation variants; production flags unchanged.
Corrected cache-off experiment running, then cache-on and RAM0/slot-reuse variant.
Source gate initially PASS142; after regression test requires rerun. Rust gate PASS49
with 38 denial probes, licenses/clippy/fmt and supervision; `.sanctum/h3b-rust.log`.
No Step 1 or new phase tags. H3a commit `53681c9` pushed; [hosted run 38104426653](https://github.com/avirooppal/Sanctum/actions/runs/38104426653)
verified all five jobs successful. Full H3b result and resource gate still pending.

## H3b measured cache cost (production adoption gate pending)

Command for each sequential variant:
```sh
target/debug/examples/embedding_cost .sanctum/runtime-dispatch.json \
  /home/aviroop/.local/share/sanctum-dev-venv/bin/python \
  target/debug/sanctum-runtime evals/results/chat-cache-VARIANT.json VARIANT
```
VARIANT `cache-off`, `cache-on`, `slot-only` (raw files use off/on/slot-only).
Each exit0: three six-turn growing-prefix real OpenAI chat conversations,18 turns,
temperature0/max16, pinned b11429/Qwen reference, context/threads/hardware in JSON.
Engine HTTP TTFT excludes gateway equally; not a voice-turn latency measurement.

| Flags | TTFT p50 / p95 s | Actual repeated-prompt reuse | Preliminary RSS delta KiB |
|---|---:|---|---:|
| Current RAM0/no-cache-prompt | 2.511719 / 3.103626 | 0 ->0; chat cache_n always0 | +19072 FAIL <=16384 |
| RAM8192/cache-prompt | 0.357319 / 1.889318 | 0 ->220 | +60704 FAIL <=16384 |
| Proposed RAM0/cache-prompt | 0.385307 / 1.871570 | 0 ->220 | +12800 within16384 |

Short-warmup snapshots are preliminary, not the complete warmed storm gate.
No RSS tolerance changed. Fixed slot reuse with RAM cache off is verified in the
proposed configuration; current production flags do NOT reuse slot prefixes.
[ADR0044](adr/0044-bounded-slot-prefix-reuse.md) proposes the bounded alternative;
adoption pending full unchanged cancellation/storm/shutdown/mixed-load measurements.

Counter mistake preserved: off/on raw `slot_reuse_observed` was derived from final
slot-state `tokens_cached`. Source inspection established `timings.cache_n` as actual
reuse; regression first FAILED then PASS. Separate `chat-cache-analysis.json`
references raw SHA256 and actual counters; raw files untouched. OpenAI usage/timings
independently show reuse. No inference retry/discarded sample or kernel modification.

Post-fix Linux `python tools/check.py`: PASS143 tests/all source gates
(`.sanctum/h3b-source-counter-fix.log`). Full Rust/security PASS49/38 denial probes,
fmt/clippy/licenses/supervision (`.sanctum/h3b-rust.log`). Production unchanged.
Next: candidate chat-only slot policy contract/test and full real-engine gate rerun;
then warm-worker ADR and authenticated WebSocket. No phase tags.

## Candidate slot policy and ingress ordering (under verification)

Base `21077ec`; hosted run38104976909 all five jobs PASS, observed jobs API.
Candidate cache policy contract/test first: compile FAILED missing cache_policy,
then implementation keeps RAM0 and enables only chat slot prefixes. No candidate
production commit until unchanged real gates pass. Full Rust run FAILED existing
ingress disconnect-removal assertion (named failure JSON retained). The idle relay
published Disconnect before RAII cleanup removed its association. Fix removes the
association before publishing that reason; original ingress tests PASS5/5, unchanged
bounds. Full Rust/security rerun underway; no pass claim yet. Step1 remains pending.

Ingress correction verification: original `cargo test -p sanctum-gateway --test
ingress` PASS5/5; full Linux `bash tools/check_rust.sh` PASS50, fmt/clippy,74 licenses,
38 kernel probes/startup self-test and three supervisor scenarios. Log
`.sanctum/slot-policy-rust-fixed.log`. Count50 includes the uncommitted candidate
cache-policy test; the ingress correction itself changes no cache flags or tests.
Candidate binary build PASS; live real-engine gates next, with no binary rebuild
while helpers run. No failing run counted green or threshold changed.

Candidate real-feature checks: SDK8/8 PASS (chat0.4439s, TTFT0.4355s, dims1024),
Knowledge upload/ACL retrieval/cited amber answer/empty abstention PASS4/4. Named
`slot-policy-sdk.json` and `slot-policy-knowledge.json` preserve current results;
original historical result files restored. One complete20-sensor rerank warmup
PASS20 hits, exactly one repetition, before the unchanged representative storm
baseline. Full `engine_storms.py --pid 690 --runtime-config .sanctum/runtime-dispatch.json
--token-file <state>/local.token --output evals/results/slot-policy-storms.json`
running; no storm pass claim yet. No runtime binary rebuild while it runs.
Ingress fix `16c2b46` pushed; run38105565622 observed all five hosted jobs PASS.

## Candidate slot-policy real storm gate

Same recorded `engine_storms.py` command: PASS exit0,500 real cancellations,
50 per engine/method. Exact process-role/FD/socket restoration, threads within+2,
worst retained per-role RSS **+13312KiB <=16384** after10s. No tolerance changed.
Model slot observation for chat/embedding/rerank; actual CLI PID absence for speech
job cleanup. This is not warm speech, real microphone playback or voice-turn latency.

| Engine / method | Gateway p95 s | Compute/job release p95 s | Maximum s |
|---|---:|---:|---:|
| chat disconnect | 0.134418 | 0.169226 | 0.175269 |
| chat explicit | 0.046148 | 0.075398 | 0.083065 |
| Knowledge disconnect | 0.199744 | 1.668214 | 1.967204 |
| Knowledge explicit | 0.150642 | 1.685517 | 1.768396 |
| reranker disconnect | 0.223562 | 1.318714 | 2.459583 |
| reranker explicit | 0.151957 | 1.482941 | 1.533082 |
| ASR disconnect | 0.247569 | 0.260113 | 0.349928 |
| ASR explicit | 0.155074 | 0.172100 | 0.189335 |
| TTS disconnect | 0.240726 | 0.251654 | 0.255964 |
| TTS explicit | 0.162599 | 0.173585 | 0.187457 |

All unchanged absolute bounds pass: p95<=2s/max<3s. Floods:50 disconnect attempts
(6 started,44 shed),16 slow readers(6 started,10 shed),100 overload attempts
(4 started,66 shed,30 closed/refused), with resource comparisons passing each.
Refusals distinct from HTTP503. Every sample/snapshot retained in
`slot-policy-storms.json` and `slot-policy-storms-<mode>-<method>.json`.

Sustained180s mixed gate running via `mixed_engine_overload.py --pid 690
--runtime-config .sanctum/runtime-dispatch.json --seconds 180 --token-file
<state>/local.token --output evals/results/slot-policy-mixed-overload.json`.
Then active/repeated shutdown. No full candidate gate/pass or production commit yet.

## Candidate mixed-load failure and voice-accounting experiment

Old-timer candidate mixed run FAILED after183.030373s: ASR p95 **6.597817s >5s**.
Health/models0.015382/0.016322s, chat4.042272s, TTS2.064679s, voice-admission0.123684s;
no foreground errors;12326 background503s. Named failed JSON preserved. Failure
occurred before final resource-gate evaluation; do not infer that it passed.
Five idle real ASR files:2.585663/2.522443/2.460029/2.618517/2.346713s, identical
transcripts (`slot-policy-idle-asr.json`). Contention diagnosis, not a gate rerun.

ADR0045/REVIEW_QUEUE before implementation. Regression first FAILED:700ms prior
engine wait left only1.806128s voice protection. Correct accounting charges actual
voice-blocked intervals to the unchanged2500ms allowance; caller deadline unchanged.
Original continuous-voice/background tests retained; targeted suite PASS2/2. Full
Rust gate PASS51, fmt/clippy,74 licenses,38 kernel probes/startup and supervision
(`.sanctum/voice-accounting-rust.log`). Candidate build PASS; restarting for new
mixed gate, then rerun complete storms and shutdown with this final code if it passes.

Before rebuilding: real active shutdown PASS0.983114s, listener0.184754s, zero
survivors (`slot-policy-active-shutdown-before-scheduling-fix.json`). No main
production-policy commit or phase tag; cache/timer changes remain candidates.

Corrected-timer mixed run FAILED183.519277s: ASR p95 **8.550405s >5s**, chat4.727241s,
health/models0.013919/0.013831s, TTS2.006524s, voice-admission0.082992s, no foreground
errors;12615 background503s. Failed named raw result retained. Correct timer
accounting is contract-verified but did not solve the load tail. No adoption/pass.
Active shutdown on that code PASS0.832423s, listener0.193139s, zero survivors.
ADR0046/REVIEW_QUEUE predeclare diagnostic inference threads2 versus4 using existing
config, ASR6 unchanged. Original config/profile unchanged. New runtime starting,
then same180s workload; no threshold change or automatic rerun-until-pass.

Two-thread inference diagnostic runtime ready on8769, PID676. Same mixed harness
now running with `.sanctum/runtime-dispatch-inference-threads2.json`,180s, output
`evals/results/slot-policy-mixed-overload-inference-threads2.json`. Original4-thread
config/profile unchanged; ASR6. No gate/pass claim before observed completion.

Two-thread diagnostic mixed run PASS exit0:182.050947s; health/models p95
0.007744/0.006122s (2916 samples each), chat3.121071s(157), ASR2.552289s(55),
TTS0.870216s(54), voice admission0.066722s(109).12971 background503s, no foreground
errors; queue peak2, process peak14, owned RSS peak3416240KiB. Exact role/FD/socket
return, thread allowance and retained per-role RSS worst+14116KiB <=16384 PASS.
Raw `slot-policy-mixed-overload-inference-threads2.json`. Original4-thread config
remains unchanged; this is a candidate, not yet an adopted default.

One complete20-candidate rerank warmup PASS before final fresh storm baseline;
then unchanged500-cancellation `engine_storms.py --pid 676 --runtime-config
.sanctum/runtime-dispatch-inference-threads2.json --token-file <state>/local.token
--output evals/results/slot-policy-final-storms.json` running. All caller/resource
bounds unchanged. After that: shutdown/repeated cycles and measured ingestion cost
for the smaller CPU budget, then policy/profile adoption only if all gates pass.

Final2-thread storm PASS exit0:500 cancellations and all floods; worst retained
per-role RSS+7376KiB <=16384, exact process/FD/socket return, threads+2.
Named `slot-policy-final-storms*.json` preserve every sample and comparison.
Fresh SDKchat8/8 PASS (chat0.2989s, TTFT0.3560s); batch17x1024 PASS1.381675s,
scalar difference0.0, usage126; Knowledge4/4 PASS. ASR/TTS SDK8/8 each PASS,
first file ASR2.236245s, TTS1.491144s (speech suites also exercised serialized
concurrent voice requests). Physical playback/voice-turn SLO explicitly unverified.
Final active/queued/slow-body shutdown PASS0.701486s, listener0.189984s, zero
survivors. Named results retained; original fixed-path historical files restored.

Now measuring same3-document/23-chunk paired ingestion with inference2 config;
no gateway running, no other model load test concurrently. Repeated active start/stop
next; profile/policy adoption still pending these checks.

Smaller-budget ingestion cost experiment PASS: same3 real docs/23 chunks,3 paired
repetitions, raw `embedding-cost-inference-threads2.json`, vector difference0.0.
Two-thread whole/one means10.145243/9.923005 documents/min,1.296337/1.267940 chunks/s.
One-input versus whole cost-2.190560% on that config; one-input versus original
four-thread one-input throughput **+22.905242%**. All samples preserved (including
20.699542s first measured scalar run); no selection of only the fastest results.
Small-corpus evidence only. Three repeated active start/stop cycles now running
with the tested2-thread config (`slot-policy-final-repeated-shutdown.json`); no
pass claim yet. Source baseline being rerun before reference-profile adoption.

Three repeated active start/stop cycles PASS exit0: shutdown1.007190/0.770481/
0.850773s, listener0.163524/0.176209/0.181616s, no survivors in every cycle; actual
chat/ingest/ASR/queued work/slow body. All owned process resources vanished.
Raw `slot-policy-final-repeated-shutdown.json` plus numbered result files.

Adopt combined ADR0044-0046 only after these real gates: chat fixed-slot reuse with
RAM snapshots0; stateless embedding/rerank; actual voice-blocked budget2500ms;
CPU reference inference2/ASR6. Public reference profile now2; original ignored4-thread
config preserved under explicit filename, operator smoke config updated to tested2.
Source baseline PASS143 before profile edit. Final source/Rust checks now running;
no production commit until those pass. No Step1/phase tags or T1/held-WS claim.

Final post-adoption source `python tools/check.py` PASS143/all checks and Rust
`bash tools/check_rust.sh` PASS51, fmt/clippy,74 licenses,38 denials/startup and
supervision (`.sanctum/h3-adoption-final-{source,rust}.log`). Web12/typecheck/build/
audit0 passed this session; no frontend changes. H3 cost/gates complete for the
Linux CPU reference; H4 hosted verification will follow the code push. Named
config provenance records original hashes/model/engine artifacts and2/4 threads.
No claim of real authenticated held-WS, warm speech, WER or T1 voice latency.

## Housekeeping completion checkpoint

Code/profile/evidence commit `820e3d8` pushed to origin/main. Hosted
[run38112629060](https://github.com/avirooppal/Sanctum/actions/runs/38112629060)
observed all five jobs successful for exact820e3d8 SHA: Rust, web, Linux/Windows/macOS
source. H1-H4 complete; all original measurements/failures retained. No phase tags.

Step1-pre next: extend proposed ADR0032 with verified upstream library/server
capabilities, measured resident memory and Flite spawn cost; do not assume a warm
wrapper can avoid CLI reload. Then1a contract/authenticated WebSocket on guarded
listener, ticket/Origin/frame/deadline/cancellation tests, actual >=10min held
sessions and mixed gate. Held WS remains PENDING;1b-1e andStep2 not started.

## Master completion baseline and Step 1-pre (2026-10-11)

Read plan and STATUS; checkout already at0404340, no destructive reset. GitHub
run38112869927 exact SHA observed all five jobs completed/success.
Fresh baseline before editing: Linux `python tools/check.py` PASS143 tests,
lint/format/types,26 Python/72 npm licenses and eval/API docs; Linux
`CARGO_BUILD_JOBS=1 bash tools/check_rust.sh` PASS51 tests,fmt/clippy,74 licenses,
38 denial/startup probes and3 supervisor scenarios with zero survivors. Web
`npm test`,typecheck,build,audit low PASS12/12/zero vulnerabilities.
Logs `.sanctum/completion-baseline-{source,rust}.log`. Initial source launch lacked
python on PATH; preserved launch failure and reran explicit interpreter, not a pass.
Real runtime configured8769 ready; official SDK PASS8,chat0.2873s/TTFT0.3584s/1024dims
(`completion-baseline-sdk.json`). Active shutdown with real lanes[1,1,2,1], queued
chat1 and slow upload PASS1.111996s/listener0.192273s/zero survivors. First shutdown
invocation rejected unsupported --runtime-config; no test ran on that attempt.

Step1-pre contract/tests first: missing module FAILED, then2 tests PASS. Native
probe compiled against pinned upstream; confined launcher verified8 denial checks.
`target/debug/examples/speech_residency target/debug/sanctum-runtime
<dev-venv>/bin/python --probe .sanctum/speech-residency-probe --model
/opt/sanctum-speech/parakeet-q4_k.bin --audio .sanctum/speech-smoke/jfk.wav
--flite /opt/sanctum-speech/flite/bin/flite --output
evals/results/speech-residency-reference.json` PASS exit0.
One model load0.393086s/RSS421024KiB; three real resident decodes
1.035570/0.938416/0.855571s; peak507168KiB. Thirty Flite version launches
p50/p95 0.002845489/0.004290530s; short synthesis0.016095147/0.017940378s.
All samples, hashes and native transcript logs preserved. No physical/T1/voice SLO.
ADR0032/REVIEW_QUEUE updated: library adapter for Parakeet, CLI Flite retained;
existing proposed caps unchanged, actual cap enforcement pending Step1b.
Offline runnable script `tools/measure_speech_residency.sh` includes compilation.

Failed Flite-version check=True run preserved named result; pinned source returns1
for version, now exact-code+output validated. Source rerun first FAILED unreviewed
cloudpickle inherited via PYTHONPATH; removed inherited path, reran unchanged scan.
Post-change full source PASS145/all gates; Rust PASS51/all gates and containment/
supervision, `.sanctum/speech-residency-{source,rust}.log`. No new dependencies.
Final inventory no runtime/engine/probe survivors. Held WS remains PENDING; Step1a
and entire later roadmap unfinished. No tag. Slice commit and hosted CI below.
