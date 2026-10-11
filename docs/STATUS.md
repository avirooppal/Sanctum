# Current state

- Step: H3 ingestion/cache cost measurements before Step 1a; Step 0 HTTP reference passed.
- Last green commit: `21077ec`; all five hosted jobs verified; no phase tags.
- Blockers: held authenticated WebSocket PENDING Step 1a; T1 latency and physical audio UNVERIFIED.
- Next: gate chat slot-only policy; warm-worker ADR; authenticated WebSocket.

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
