# Implementation status

Updated: 2026-10-10. Source of truth: ../plan.md. Phase 0 complete; Phase 1 reference implemented.
Phase 1 starts after the Phase 0 completion commit below. Placeholder service directories are not implementations.

| Phase | State | Exit criteria / evidence |
|---|---|---|
| 0 Foundations | done (Linux x86_64) | Doctor tier/profile passes; real isolated HTTP ingress, exec inheritance and egress startup probes pass. Other runtime platforms fail closed. |
| 1 Chat | done (Linux reference) | Offline clean-rootfs install to answer 50.6005s; official SDK 8/8. Downloads/build excluded; native macOS/Windows unverified. |
| 2 Knowledge | done (v6, user-directed reviewer) | Vector/hybrid recall@5 0.60/1.00 (gain +0.40); MRR 0.60/1.00. Hybrid exact citation and expected-answer inclusion 1.00; abstention passed; calibrated local judge 30/30 supported. Vector-only answer/citation/judge rates 0.60. Codex checked 4/4 hybrid cases against frozen sources at the user's direction (ADR 0014); no independent human audit. |
| 3 Speech | in progress (contract and eval plan) | T1 end-of-speech to first audio <800 ms; plan.md does not numerically specify a WER threshold (ADR 0015). T1 hardware unavailable on this host; both metrics unverified. |
| 4 Vision | not started | Measurable visual QA lift: unverified; dataset/threshold pending. |
| 5 Agents | not started | Red team passes and zero unexpected ledger egress: unverified. |
| 6 Team | not started | 20 concurrent users meet reference SLO; verified air-gapped install: unverified. |
| 7 Ecosystem | not started (optional) | Installer, SDK and ecosystem polish deferred. |

## Phase 0 checklist

- [x] Preserve full plan, section 13 layout, ADR template and phase/slice plan.
- [x] OpenAPI request envelope (user/workspace/data_class/trace_id/policy_context).
- [x] Model registry schema requiring permissive license, source, revision and hash.
- [x] Hardware doctor prints tier and config-selected profile; no model names in code.
- [x] Local lint, formatting, CLI typecheck, unit/contract tests and license gate.
- [x] CI definition on Linux, Windows and macOS; hosted runs **unverified** (not pushed).
- [x] Early evaluation harness with measured foundation baseline and regression rejection.
- [x] Early Linux isolated startup self-test exercised under WSL2.
- [x] Two-process Rust bootstrap with inherited IPC and per-process kernel denial tests.
- [x] HTTP health ingress and exec/thread-compatible runtime egress isolation on Linux x86_64.
- [ ] Native engine execution verification is the next Phase 1 integration gate.
- [ ] Native Windows/macOS containment (unverified/unsupported; no services start).
- [ ] Complete GPU/VRAM/CPU-feature/NPU support matrix; real Apple/NVIDIA checks.
- [x] Rust toolchain, envelope contracts and executable supervisor/worker foundation.

## Measured results for slice 1

Host: Windows AMD64, Python 3.12.13; local date 2026-10-08.

| Check | Observed result |
|---|---|
| `uv run --offline python tools/check.py` | PASS |
| CLI/contract tests | 14/14 pass |
| Isolation/evaluation tests | 7/7 pass |
| Ruff lint + format | Pass; 13 Python files formatted |
| ty CLI type checking | Pass |
| Installed package license metadata | 9/9 match permissive reviewed registry |
| Profile evaluation | 8/8 correct; accuracy 1.0; false-ready count 0 |
| Windows doctor | 12 logical CPUs, 15.70 GiB RAM, Intel Iris Xe, T0 / t0-cpu |
| WSL Ubuntu 22.04 doctor (Python 3.10.12) | 7.61 GiB RAM, CPU flags detected; no matching profile, exit 2 as designed |
| Dedicated Intel VRAM, NPU, Windows CPU features | Unknown/unverified; no guessed values |
| WSL2 Linux isolated startup | 4/4 IPv4/IPv6 TCP/UDP probes denied, child executed |
| Native Windows isolated launch | Refused; child not executed |
| WSL host namespace bypass (`--inside`) | Refused before probes; child not executed |

Baseline artifact: ../evals/results/foundation-baseline.json. This uses deterministic
hardware fixtures, **not model/RAG/audio benchmarks**. Default regression threshold:
5%; zero tolerance for security (ADR 0004). No tokens/sec or latency estimates claimed.

## Limits and next slice

Doctor does not attest runtime containment; it always reports egress unverified and
service_start_allowed=false. The Rust bootstrap has inherited local IPC, but no product
HTTP/gRPC adapter or engine-compatible confinement. Neither diagnostic is a hostile
code sandbox; neither establishes production privacy. No ACL, injection,
container, GPU/audio, SDK, load or application E2E tests exist yet. They remain gated
requirements for their owning phases, not passing placeholders.

Next: production HTTP/gRPC adapter over brokered transport, startup health contract,
and engine-compatible Linux isolation before starting Phase 1. Revisit the conservative
15.70 GiB -> T0 decision after model fit measurements. ADRs 0001–0005 record choices; no approval
is required to reproduce this slice. Phase 1 stays blocked until Phase 0 is complete.

## Slice 2 evidence

Rust 1.99.0 installed in WSL Ubuntu 22.04 (Linux x86_64, kernel 6.6.87.2).
Dependencies fetched only during explicit development setup; all verification below
uses offline/locked builds. Native Windows/macOS Rust containment remains unsupported.

| Check | Observed result |
|---|---|
| `bash tools/check_rust.sh` in WSL | PASS |
| Rust contract/integration/unit tests | 10/10 pass |
| Rust fmt and Clippy (`-D warnings`) | Pass |
| Resolved Rust crates | 12/12 permissive licenses and cached archive SHA-256 verified |
| Separate supervisor + worker | 11 EPERM checks each; 22/22 pass; envelope/trace round trip succeeds |
| Prohibited operations | IPv4/IPv6 TCP/UDP sockets, Unix socket, file open, exec, namespace, connect, descriptor passing, io_uring |
| Invalid request/transport tests | Missing workspace, zero trace, cloud enabled, unknown fields, empty user, invalid class, malformed JSON, oversized stdin/frame, wrong stdio: rejected |
| Python source gate after Rust integration | 25/25 tests, lint/format/typecheck and nine Python dependency checks pass |
| Existing profile evaluation | 8/8 correct; false-ready count 0 (unchanged) |
| Hosted Rust CI | Configured; execution unverified (not pushed) |

Measured response: ../evals/results/containment-linux.json; schema validated by the
Python contract suite. These kernel checks do not measure inference, RAG, or latency.
ADR 0005 scopes the bootstrap protocol and containment limitations. Phase 0 remains
in progress until actual product-service startup uses an enforceable supported profile.

## Phase 0 completion evidence (slice 3)

ADR 0006 defines Linux x86_64 as the verified initial runtime; other operating
systems remain unsupported, not silently unconfined. Doctor's configured tier/profile
exit passes on the Windows host. Partial accelerator discovery remains documented.

Rust tests: 13/13 pass; formatting/Clippy pass. All 17 resolved crate licenses and
archive hashes pass. The actual host-to-isolated-gateway HTTP request succeeds;
16/16 runtime/exec-child denial probes pass. Existing strict bootstrap probes remain
22/22. Python suite: 26/26 plus formatting, lint, typecheck and license checks pass.
Evidence: evals/results/runtime-linux.json. Hosted CI remains unverified.

Phase 0 is complete for this support scope. Engine-specific real inference, model
licenses, auth, persistence, UI, SDK compatibility and clean-install timing are
Phase 1 work; no Phase 1 exit claim is made. Historical slice limitations above
remain as provenance, superseded only by this completion record and ADR 0006.

## Phase 1 completion evidence

- [x] Hash-verified official Apache-2.0 chat/embedding GGUFs and MIT llama.cpp.
- [x] Explicit logged download/import; estimates report unmeasured speed honestly.
- [x] Rust loopback-only adapter, OpenAI streaming/tools/schema/embeddings/models.
- [x] Local bearer auth, SQLite history, React/Tailwind model picker and chat.
- [x] Official SDK: 8/8 real tests; 0.4787s chat, 0.4714s streaming TTFT,
  1024-dimensional embedding (single CPU run, not a quality/performance guarantee).
- [x] Clean Linux rootfs offline bundle copy to first answer: 50.6005s <300s.
- [x] 31 Python tests; 16 Rust tests; formatting, Clippy, typecheck, web build pass.
- [x] 22 Python, 73 Rust and 145 frontend dependency license entries checked.
- [x] Browser login, real streamed response, saved conversation restoration verified.
- [x] Runtime/child denial probes 16/16; strict bootstrap probes 22/22.
- [ ] Hosted CI, MLX/Apple and native Windows runtime: unverified.

Evidence: evals/results/phase1-sdk.json, phase1-clean-install.json, phase1-web.png.
The clean-rootfs harness requires Docker's default capabilities during namespace
creation, then the application drops all capabilities and applies its own filter.
Outer Docker seccomp must allow namespace setup; outer network is disabled. The
first cap-drop-ALL attempt failed closed (EPERM). Docker is test-only, not required
for solo operation. This is an unsigned local bundle, not the Phase 6 air-gap release.
ADRs 0007–0008 document model/reference scope and reproducible frontend build pin.

## Phase 2 slice 1

Seven new tests pass for workspace membership, per-document ACL prefilters and
revocation, dedup/versioning, stale-parent denial, structural Markdown chunks,
real sqlite-vec prefiltering, RRF and exact quote validation. Total Python tests 38.
This is a library slice, not an exposed Knowledge service or a completed RAG system.
Parser and vector adapter deviations are recorded in ADRs 0009 and 0010 after
transitive license checks rejected Docling/certifi and LanceDB/tqdm respectively.

## Phase 2 slice 2

Confined Knowledge worker is wired through the isolated Rust gateway. Its startup
checks the Linux loopback-only namespace and inherited seccomp before opening its
SQLite state or making requests to local OpenAI-compatible engines. Profile selects
the model IDs, hashes, paths and ports. API contract includes authenticated workspace
listing, upload, search and ask. The real integration smoke passed: upload, ACL-filtered
retrieval, exact cited answer and empty-evidence abstention. Evidence:
`evals/results/phase2-smoke.json`.

Python source gate passed (38 tests total including 7 Knowledge tests), Ruff format,
lint, typecheck, and 26 installed Python / 145 frontend reviewed license checks.
Rust offline/locked check passed: 16 integration/unit tests, fmt/Clippy, 73 reviewed
crate licenses, 22 two-process kernel denial checks, and 16 runtime/exec-child denial
checks; the isolated HTTP health contract also passed.
Full frozen 30-question retrieval/citation benchmark completed on WSL2 CPU in 1759.045s.
Dense recall@5 1.00, hybrid recall@5 1.00, absolute gain 0.00 (required >=0.05), MRR
1.00 for both, exact citation support 1.00, expected-answer containment 1.00, and
unsupported-query abstention passed. Because dense retrieval is saturated, the recall
exit criterion failed; per the eval plan, a separately versioned harder set is required
before tuning. The questions/corpus are synthetic, so this is pipeline evidence only.
No no-faithfulness-regression result is available (only hybrid answers were judged).
Folder watch, local judge and human faithfulness review remained outstanding at that
time. The later v6 separately versioned challenge below resolves the saturated recall
problem; Phase 3 remains gated on all Phase 2 exit criteria.

## Phase 2 slice 3

V2's zero scores were invalid: expected quotes included heading metadata absent from
child citation text. The runner now validates every frozen expected quote against the
real parser output before making API calls. V3 is a valid 30-question opaque-key suite;
it completed with dense/hybrid recall@5 1.00/1.00, MRR 0.708/0.783, exact citation
support 0.567, and abstention passed. No faithfulness comparison was performed.

Those records exposed that embeddings, BM25, reranking, and answer generation omitted
structural heading context. The pipeline now embeds and lexically indexes parent text,
reranks with parent context, and gives the answer model context while restricting quotes
to child text. A recoverable SIGALRM deadline handler prevents slow inference from
terminating the worker; the eval runner resumes only matching hash-verified checkpoints.
Knowledge tests: 10/10; full Python source/license gate passes. V4 is an independent
30-question/two-register challenge with 60 parsed passages. It completed on the confined
WSL2 CPU runtime (resumed segment 764.355s): dense/hybrid recall@5 1.00/1.00 (gain
0.00; required >=0.05), MRR 1.000/0.983, exact citation support 0.867 (required >=0.95),
expected-answer containment 0.867, and unsupported-query abstention passed. Raw evidence:
`evals/results/knowledge-needle-v4.json`; suite SHA-256 is recorded there. Dense baseline remains
saturated, so the retrieval gate fails. No faithfulness regression comparison, local judge, or
human spot-check is available; folder watching was not yet implemented in slice 3. V4 is synthetic pipeline
evidence, not a customer-corpus benchmark. Phase 3 remains gated.


## Phase 2 slice 4

The v5 challenge expands to 480 parsed passages (30 opaque-key targets and 450
near-duplicate decoys). A retrieval-only comparison completed against a single indexed
workspace: dense/hybrid recall@5 remained 1.00/1.00, gain 0.00. Raw evidence is
`evals/results/knowledge-needle-v5-retrieval-only.json`; answers were not part of this
ablation. The retrieval gain gate remains failed; increasing this synthetic corpus did
not resolve saturation.

Small-model quote handling now falls back to the selected child passage verbatim when
its quote is paraphrased, and rejects unknown chunk IDs. Folder polling ingestion is
implemented as an opt-in local-only client using the existing upload contract. It skips
hidden files and symlinks, permits only Markdown/text PDFs up to 10 MiB, and does not
propagate file deletion (ADR 0011). The 30-question v5 answer run completed: exact citation support 1.00, expected-answer
inclusion 1.00, unsupported-query abstention passed; dense/hybrid recall@5 stayed 1.00/1.00
(gain 0.00). Evidence is `evals/results/knowledge-needle-v5-citation.json`. Watcher integration
smoke passed initial upload, unchanged skip, changed upload and retrieval (`evals/results/folder-watch-smoke.json`).
All 15 Knowledge tests passed on Linux (including symlink rejection); full Python source,
license and foundation evaluation gates passed. The hybrid-gain gate is still failed; no
vector-only answer faithfulness comparison or local judge has been run. A human review packet
is provided at `evals/results/knowledge-needle-v5-human-review.md`; review remains pending.
Phase 3 remains gated.

## Phase 2 slice 5 — v6 discriminative challenge and grounded answers

The separately versioned v6 suite uses 30 exact machine-identifier questions over
480 parsed passages (30 targets and 450 near-duplicate decoys). The frozen dataset
SHA-256 is `bd2c1f62b08284eb62fbc8781969ffc1c530f93b38d5e00942b9569d4039247e`.
Against the same indexed workspace, vector/hybrid recall@5 is 0.60/1.00 (absolute
gain +0.40; target >=0.05), with MRR 0.60/1.00. The retrieval-only artifact is
`evals/results/knowledge-needle-v6-retrieval-only.json`.

The completed ACL-filtered hybrid answer replay has exact citation support 1.00,
expected-answer inclusion 1.00, and unsupported-query abstention passed. Evidence is
`evals/results/knowledge-needle-v6-grounded-answers.json`. An exact-identifier path
returns the matching child passage and parent heading directly when the identifier
is unique in retrieved evidence, avoiding small-model confusion between near-duplicate
records; citations retain heading context. The previous v6 answer run is retained as
diagnostic evidence of 28/30 before this fix.

The first local judge pass marked both suites 30/30 supported. At the user's direction,
Codex checked the four hybrid packet examples against the frozen source and answer
artifacts; all four are supported by the expected source/quote. The same inspection
found three of four sampled vector-only answers cited decoy facts for different
identifiers, despite the prior judge marking all supported. ADR 0013 adds a
deterministic exact-entity check before local entailment judgment. The calibrated
vector judge supports 18/30 (0.60), matching vector answer containment/citation
metrics; calibrated hybrid judging also supports 30/30 (1.00). Artifacts:
`evals/results/knowledge-needle-v6-judge-entity-v2.json` and
`evals/results/knowledge-needle-v6-vector-judge-entity-v2.json`. ADR 0014 records the
user-directed Codex review substitution. Phase 2 is complete under that instruction,
with no claim of independent human review. The corpus is synthetic and demonstrates
pipeline behavior only, not customer-corpus quality.

## Phase 3 slice 1 — speech contracts and evaluation plan

Tasks: define OpenAI-compatible file transcription and speech contracts plus a
WebSocket event protocol; contract tests first; then stable VAD, ASR, diarization, and
TTS engine interfaces; add a dataset-driven WER/latency harness and document local-only
profiles. Tests cover schema validity, malformed/oversized audio, adapter conformance,
VAD segmentation, transcription timing, and barge-in cancellation. Risks: no numeric
WER threshold is stated in plan.md, this machine is T0 rather than T1, audio hardware is
unavailable, and each weight/voice has its own license. No T1 performance result will be
claimed here.
## Phase 3 implementation update

Phase 3 contracts, Python engine protocols, VAD-to-ASR composition with optional
diarization, offline WER/voice-loop evaluator, and a hash-pinned whisper.cpp file-ASR
adapter are implemented. Speech contracts and evaluator are wired into the normal
repository check. No whisper.cpp binary/model, VAD runtime, voice, listener, or hardware
benchmark is provisioned. T1 latency and WER remain unverified; Phase 3 is in progress.
ADR 0015 records the missing numeric WER target; ADR 0016 defines p95 aggregation for
the plan's <800 ms first-audio SLO; ADR 0017 excludes a transitive MPL dependency.
Candidate licensing review is documented in `docs/PHASE-3-PLAN.md`; no model is pinned
as a default.

## Phase 3 checklist and measured slice results

- [x] OpenAPI speech routes and realtime WebSocket event contract; schema tests pass.
- [x] Stable VAD, ASR, diarization, and TTS interfaces; VAD/ASR composition tests pass.
- [x] Local whisper.cpp file-ASR adapter with profile hash verification and no shell/network fallback.
- [x] Speech engine profile contract requires explicit egress denial and SHA-256 pins.
- [x] Offline speech evaluation schema and WER/latency/RTF/barge-in report; evaluator tests pass.
- [x] Generated API documentation updated; all speech tests included in `tools/check.py`.
- [ ] Integrate a locally licensed streaming ASR backend, VAD backend, TTS, and audio capture/output.
- [ ] Implement push-to-talk, file transcription with diarization, barge-in voice loop, and meeting-to-Knowledge integration.
- [ ] Record licensed dataset and model/voice provenance, revision, and hashes in the registry.
- [ ] Measure WER against an agreed numeric target and end-of-speech-to-first-audio p95 <800 ms on T1.

| Check | Observed result |
|---|---|
| Full offline `tools/check.py` | PASS |
| Foundation tests | 22/22 pass |
| Isolation/evaluation tests | 9/9 pass |
| Knowledge tests | 21 pass, 1 Windows symlink privilege skip |
| Speech contract/interface tests | 11/11 pass |
| Speech profile and whisper.cpp adapter tests | 4/4 pass |
| Speech evaluation tests | 4/4 pass |
| Ruff lint/format, type checks, Python/frontend license scans | PASS |
| T1 WER and voice latency | Unverified; no whisper.cpp artifact/model, licensed benchmark dataset, T1 hardware, or numeric WER threshold available |

Phase 3 remains in progress and Phase 4 has not started because the Phase 3 exit gate
has not been verified. `evals/speech_eval.py` is the reproducible offline runner for
licensed T1 records when those inputs are available.

### Phase 3 ASR adapter slice

The machine check still reports Windows AMD64, 15.70 GiB RAM, Intel Iris Xe with
unverified VRAM, and T0. No usable audio endpoint or whisper.cpp binary was found.
The adapter's fake-process integration tests verify its WAV serialization, argv,
timeout, JSON parsing, and hash checks. This is not an inference or WER measurement.
The faster-whisper optional dependency was resolved and audited, then removed before
commit because its current transitive `tqdm` package includes MPL-2.0-licensed files;
see ADR 0017. The speech runtime dependency set remains unchanged.
