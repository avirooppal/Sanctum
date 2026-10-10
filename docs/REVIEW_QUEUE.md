# Decision review queue

Owner review pending. This is an index of existing decisions, not retrospective
approval or a replacement for their original text. Historical failures and numbers
remain in the ADRs, status archives and named results. Add new entries when a
timeout, threshold, tolerance or scope changes; supersede explicitly, never silently.
“Relaxes gate” includes methodology/scope exceptions, even when numeric bounds stay.

| ADR | Change and motivating evidence | Relaxes plan/ADR gate? | Cost / limitation |
|---|---|---|---|
| [0001](adr/0001-foundation-cli.md) | Python diagnostic CLI; initial host lacked Rust; permissive tooling substitution | No: Rust control plane retained | Source CLI initially needs explicit profile path |
| [0002](adr/0002-conservative-profiles.md) | Exact RAM/one-GPU boundaries; unreliable Windows VRAM reporting | No: conservative selection, no measured speed claim | May underselect; accelerator coverage incomplete |
| [0003](adr/0003-early-egress.md), [0005](adr/0005-contained-bootstrap-ipc.md), [0006](adr/0006-linux-runtime-boundary.md) | Early namespace/seccomp; native containment unavailable | Scope exception: Linux x86_64 reference only; privacy gate unchanged there | Unsupported runtime platforms fail closed; trusted engine filesystem boundary |
| [0004](adr/0004-eval-thresholds.md) | Set unspecified regression X to 5%; security zero tolerance | No: establishes previously unspecified bound | Needs representative baselines; foundation accuracy is not product quality |
| [0007](adr/0007-reference-models-and-provisioning.md) | Tiny verified CPU models, explicit online provisioning | Scope qualification: install timing excludes provisioning; not full clean online install evidence | Reference quality and hardware claims limited |
| [0009](adr/0009-knowledge-parser-license-boundary.md) | Docling transitive MPL license; pypdf/Markdown substitute; >=5pp recall lift, >=95% citation support | Scope exception for layout parsing; numeric quality gates newly established | Complex tables/figures/regions still partial |
| [0010](adr/0010-permissive-vector-adapter.md) | LanceDB dependency license blocked; sqlite-vec replacement | Stack/scope exception, no ACL/quality relaxation | Exact scans; LanceDB remains absent |
| [0011](adr/0011-polling-folder-ingestion.md) | Poll 5–3600s, one root, .md/.pdf <=10MiB; deletion unspecified | Scope restriction; no existing measured gate changed | Delayed updates; no automatic deletion propagation |
| [0012](adr/0012-exact-identifier-grounded-answers.md) | Initial replay cited 28/30 expected passages; unique identifier quote path | No numerical relaxation; narrower answer methodology | Synthetic exact-key task does not prove semantic QA |
| [0013](adr/0013-exact-entity-faithfulness-judge.md) | Judge accepted 30/30 decoy answers; exact entity precheck | No: strengthens judge; preserves original run | Narrow identifier calibration; broader semantic judge remains weak |
| [0014](adr/0014-user-directed-review-substitution.md) | Codex source review substitutes unavailable human spot-check | Yes: reviewer independence criterion replaced | Synthetic dataset, no independent human audit |
| [0015](adr/0015-speech-wer-exit-threshold.md), [0018](adr/0018-speech-wer-benchmarks.md) | Deferral superseded by LibriSpeech clean <=0.10/other <=0.20 | No: numeric WER target absent in plan; T1 retained | English read speech coverage only; new mission also requires noisy/accented evidence |
| [0016](adr/0016-speech-latency-percentile.md) | Define p95 <800ms, preserve p50/max | No: tail aggregation makes existing target explicit | Requires T1 measurements, T0 diagnostic only |
| [0017](adr/0017-speech-asr-engine-license-gate.md) | faster-whisper transitive license blocked; whisper.cpp fallback | Engine scope substitution, no WER/latency relaxation | Language/speed must be measured; planned adapter absent |
| [0020](adr/0020-whisper-ggml-fallback.md), [0022](adr/0022-silero-ggml-vad.md), [0023](adr/0023-parakeet-asr-license-and-output.md), [0024](adr/0024-permissive-cpu-tts-reference.md) | Actual artifacts use GGML/native voice; Parakeet source attribution CC-BY retained; Flite CPU reference | Format/license scope exceptions; no performance gate relaxation | Coarse Parakeet timestamps, file VAD latency, reference TTS quality; upstream provenance mandatory |
| [0021](adr/0021-verification-and-blocked-dependencies.md) | Independent work can continue across hardware blockers; tags require real gates | Execution-order exception authorized by mission, not gate pass | Unverified items remain visible; no Phase 7 until verified |
| [0026](adr/0026-incremental-asr.md) | CLI prefix redecoding, 30s audio cap | No: explicitly not native streaming or latency acceptance | Repeated model loading/decoding and CPU overhead |
| [0027](adr/0027-single-user-scope.md) | Owner expressly removed team product; replaces 20-user gate with owner >=1h soak and packaging/security gates | Yes: explicit user-authorized scope/gate replacement | No SSO/team storage/Helm/collaboration; optional GPU remains |
| [0028](adr/0028-bounded-dispatch.md), [0029](adr/0029-bounded-ingress.md) | 6 workers, queue8/10s; TCP24/header8/backlog32; health250ms/chat5s; FD exact/thread+2/RSS+16MiB/10s | New Step0 gates; transport compatibility restrictions, not Phase3 relaxation | No keepalive/chunked upload; Upgrade initially501, pending real WS |
| [0031](adr/0031-request-cancellation.md) | p95 <=2s/max <3s (50 each), shutdown5s; 100/400/500ms escalation, guardian1250ms | No: establishes Step0 acceptance before runs | Process overhead; compute stop must be separately observed |
| [0032](adr/0032-resident-speech-workers.md) | Proposed warm IPC workers, T0 1.25GiB/T1 3GiB, 25% OS reserve | No: proposal, not implemented or measured allowance | Must verify actual upstream modes/residency before implementation |
| [0033](adr/0033-cancellable-local-http-bridge.md) | Blocking HTTP isolated in owned request helper | No | Process creation per request; latency cost measured through SDK |
| [0034](adr/0034-response-backpressure.md) | 1800ms idle/absolute block, >=1024B/s active-delivery windows | No: stricter bound after socket test exceeded2s | Slow clients disconnected; generation pauses excluded only from delivery throughput |
| [0035](adr/0035-shared-engine-admission.md) | Cross-process ports: chat/embed2, rerank/ASR/TTS1; reserved interactive slot | No: tighter admission | Shed503+Retry-After; advisory locks require all callers to cooperate |
| [0036](adr/0036-resident-engine-crash-recovery.md) | 100/500/2000ms restart, <=3/min; readiness120s/probe250ms; cache0; allocator trim; one execution lease | No numeric resource/latency relaxation; recovery wait is not normal lane gate | Chat RSS +39808KiB and embedding +55936KiB failures motivated policy; loses host prompt cache/batching throughput; no zero downtime |
| [0037](adr/0037-large-embedding-probe-setup-deadline.md) | Large 128-input slow-reader setup header wait30s ->120s; failed at30.031s with zero bytes | Yes: harness setup timeout relaxed; no plan/cancel/delivery/overload gate relaxed | Test takes longer; separately report computation before slow reading |
| [0038](adr/0038-complete-resource-baseline-workloads.md) | Warm one complete representative100-section ingestion; setup60s ->240s after timeout; RSS +153864KiB failure | Yes: baseline methodology/setup exception; numeric +16MiB unchanged | Higher warmed baseline hides one-time working allocation; cold peak must remain reported; no repeated warm-until-pass |
| [0039](adr/0039-explicit-owner-cancellation.md) | Authenticated empty-body cancel all admitted engine requests, control untouched | No: adds scope-limited owner API | No per-session cancellation yet; not a Privacy Ledger |
| [0040](adr/0040-bounded-embedding-work.md) | Whole document ->8 ->1 input/pair; actual Knowledge compute >3s even at8 | No: unchanged p95<=2s/max<3s and resource bounds | Serial HTTP/embedding/rerank throughput penalty; H3 comparative measurement pending |
| [0041](adr/0041-mixed-engine-overload-gate.md) | >=180s mixed test; ASR/TTS5s, voice admission250ms; peakRSS baseline+2GiB/process+8 | No: new scheduling/peak limits; retained+16MiB unchanged | File timings are not <800ms voice turns; prior held upload not WS |
| [0042](adr/0042-verbatim-status-archive-formatting.md) | Preserve raw CRLF/archive trailing blank, path-specific Git whitespace exception; byte hash | Yes: inert archive formatting only; no executable checks or measured gate relaxed | Archives exempt from EOF normalization; expanded to H1 archive by same exact-byte rationale |
| [0043](adr/0043-voice-compute-priority.md) | ASR2 ->6 threads; background yields fully, foreground max2500ms | No: unchanged 5s lane/resource/cancel gates | Failures ASR8.121609s, chat11.261964s, ASR6.404672s preserved; CPU profile-specific; foreground can still contend after wait |

Other ADRs audited: 0008/0025 build dependency repair, 0019 classification vocabulary,
0030 managed Python CI. They do not alter a timeout/threshold/tolerance or roadmap
gate; retain their original records. H1 archive uses ADR0042's existing byte policy.
No past ADR was modified to create this queue. H3 cost measurements are pending.
