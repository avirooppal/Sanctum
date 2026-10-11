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

H3a follow-up evidence (does not change ADR0040): three real reference documents,
23 chunks, three paired full-ingestion repetitions: whole-document 8.243297 docs/min,
1.053310 chunks/s; one-input 8.073704 docs/min, 1.031640 chunks/s. Throughput -2.057341%,
paired vector difference0.0. Raw `evals/results/embedding-cost-reference.json`.
Small-corpus evidence only; cache-cost/KV-reuse measurement remains pending.

| New decision | Evidence / proposed change | Relaxes gate? | Cost |
|---|---|---|---|
| [0044](adr/0044-bounded-slot-prefix-reuse.md), proposed | Current prefix reuse disabled; H3 off/on median2.512/0.357s; short-warm RSS+19072/+60704KiB. Propose RAM0 with chat slot reuse only | No; existing complete warmed storm, cancel, shutdown and mixed-load gates must pass before adoption | No snapshot reuse across unrelated conversations; production adoption/resource gate PENDING |
| [0045](adr/0045-voice-deferral-accounting.md), proposed | Mixed ASR6.598s failed5s; idle2.347–2.619s. Count actual voice-blocked time, not earlier engine waiting, against2500ms deferral | No numeric gate change; timing-accounting semantics change is explicit | Queued chat may wait longer overall; unchanged chat/ASR5s and full real gates must pass |
| [0046](adr/0046-cpu-inference-thread-experiment.md), experiment | Corrected timer mixed ASR8.550s still failed5s. Test existing inference threads2 instead of4, ASR6 unchanged | No gate/timeout/tolerance change; original profile retained while testing | Slower embedding/rerank possible; measure all gates/throughput before adoption |

2026-10-11 adoption supplement (original proposal rows above retained):0044–0046
combined configuration passed the final500 cancellations/floods,180s mixed gate,
active and three repeated shutdowns. Retained RSS7376/14116KiB, bounds unchanged.
One-input ingestion throughput+22.905242% against original four-thread profile on
the small real corpus. Both failed mixed candidates remain named evidence. See ADR
follow-ups and STATUS; this does not waive T1 voice latency or held-WS requirements.

Step1-pre ADR0032 supplement: measured Parakeet507168KiB peak versus unchanged
proposed ASR1GiB cap; shared budget/OS25% still proposed enforcement for Step1b.
Choose reusable upstream library (bundled server is Whisper-only), retain Flite
per-request after short-text p95 17.940ms. No SLO/tolerance relaxation; long-audio
peak, enforced caps, supervised IPC and T1 measurements remain pending. Version
probe exit1 accepted only with exact upstream version output; failed run retained.

| [0047](adr/0047-realtime-admission-and-tickets.md), proposed | Tickets30s/cap32; WS900s hard lifetime, ping15s/pong30s, frame64KiB; held3 attempts/admit2 for600s | New WS transport bounds; HTTP330s unchanged; no lane/cancel/resource gate relaxed | Memory-only primitive first; actual endpoint/transport/held gate still pending |

Final mission milestone: ADR0042 byte-preserving archive rule extended to
`2026-10-11-through-ticket-preparation.md`; SHA256
8a5e4cd509a551c4761808bd3a30d591085f61cfee6c93584b384b47b6a71e7e.
Entire prior STATUS copied verbatim; no recorded measurement rewritten or deleted.
Formatting exemption remains archive-only, with no executable check relaxed.

| [0048](adr/0048-incremental-smoke-entry-point.md) | smoke_all initially runs all currently implemented real flows; manifest lists release gaps, strict release mode refuses success | No final gate relaxed; user explicitly requires extending smoke as features land | Requires provisioned running runtime/browser initially; file speech is not WS voice, and full fresh-clone RC acceptance remains pending |

| [0049](adr/0049-guarded-websocket-transport.md) | Direct admitted WS handler and hierarchical turn cancellation; raw-frame parser, bounded memory, inherited upload/write bounds | No numeric gate relaxed; topology and additive cancellation API change | New audited Rust codec dependencies; actual speech integration remains later |
| [0050](adr/0050-explicit-mit-choice-for-r-efi.md) | Record and enforce MIT selection for exact upstream MIT OR Apache OR LGPL alternative | No permissive-only rule relaxed; reject absent/LGPL selection | Extra explicit license metadata required; UEFI dependency is not a tested runtime platform |

ADR0049 measurement supplement: opt-in mixed --held-websocket after original
181.419s baseline PASS; default workload/every threshold retained. One held WS
leaves one voice connection for real ASR/TTS. Client250ms read polling does not
expire the connection or alter the15s/30s heartbeat policy.

ADR0049 shutdown measurement supplement: opt-in held WS plus active real jobs;
move the slow-body probe to background lane in this mode so voice cap2 is honored.
Require100-continue to prove admission before SIGTERM (stricter evidence, not
threshold relaxation). Original mode and5s/250ms bounds retained; WS closes1001.

| [0051](adr/0051-hermes-ui-source-and-asset-boundary.md) | Pin actual upstream b30f95ac; recreate locally instead of importing UI0.18.2 wholesale; exclude unverified brand fonts/assets | Intentional legal/privacy deviation only; no fidelity or quality threshold set/relaxed yet | Font substitutes alter glyph appearance; full asset/token/fidelity audit remains pending |

| [0052](adr/0052-ui-package-audit.md) | Local primitives instead of the published package and unreviewed font/dependency bundle | No quality threshold changed | Exact MIT notice retained; component adaptation remains pending |
| [0053](adr/0053-ui-font-audit.md) | Exclude Collapse/Rules/Mondwest/Neuebit; review pinned OFL candidates with actual render comparisons before selection | Glyph substitution required by licensing; no fidelity waiver | No binary admitted; comparison and individual font provenance pending |
| [0054](adr/0054-ui-icons-and-assets-audit.md) | Exclude upstream brand, unverified icons and all bundled assets pending individual admission | Identity deviation required; no scope or gate relaxation | Original icon and license-verified selected assets remain pending |
| [0055](adr/0055-ui-font-substitution-selection.md) | Select OFL Spectral/Archivo/League Gothic/VT323 from actual local render comparisons | No fidelity threshold waived; diagnostic sample shortened after overflow, same geometry | Bold/italic/language and compressed-width differences remain; no product font admitted yet |
| [0056](adr/0056-ui-theme-and-icon-permissions.md) | Preserve palette-origin MIT notices and Lucide ISC plus Feather MIT/Tabler MIT | No scope/threshold changes; product preset labels exclude upstream branding | Installing selected icons and adapting palettes still requires product license/audit/provenance gates |

ADR0056 exact-notice supplement: path-specific Git trailing-blank exception for
the original Solarized copyright notice only; named whitespace failure retained.
Do not rewrite a primary license to satisfy code whitespace rules. No code,
test, timeout, benchmark or fidelity threshold exception.

| [0057](adr/0057-web-adapter-and-cancellation.md) | Existing screen uses first-party typed HTTP adapter; guarded ticket WS helper |2000ms tests-first hang guard only; server deadlines unchanged | Full UI egress/fidelity and speech integration still pending; real native-fetch failure retained and fixed |

ADR0057 evidence supplement: preserve Node's raw failed assertion formatter's
trailing spaces using a single-file Git whitespace exception. No source or test
waiver; failing whitespace output retained and STATUS archive SHA256 recorded.

| [0058](adr/0058-native-license-surface.md) | Native in-app exact notices and initial primitives; palette/theme migration remains pending | New geometry860px/32px gutter/720px or86dvh, centering1CSS px;12px floor/opacity1/reduced motion0s | Legal surface only, not full fidelity/axe; screenshot-discovered top-left regression preserved before fixing |
| [0059](adr/0059-pinned-palette-token-stage.md) | Pinned palettes, renamed identity and in-memory controls; system fonts until asset admission | New semantic4.5:1 base-backdrop ladder0.2,12px/opacity1 and16x2x3 coverage; former green assertion deliberately updated | Alpha-derived tiers differ by mission; all-surface contrast/typography/full fidelity remain pending |
| [0060](adr/0060-offline-font-admission.md) | Admit five exact OFL fonts/notices with offline hashes and scoped tiers | No CSP, model/package-license or performance threshold relaxed | Synthetic bold/language/per-theme typography and full reference fidelity still need verification |

ADR0060 notice-byte supplement: legal/evidence-only Git whitespace attributes
preserve original upstream OFL trailing spaces and the exact aggregate notice.
Named failed check retained; no source/test lint exception or quality gate waiver.

| [0061](adr/0061-responsive-shell-stage.md) | Source-backed237px/640px chat rail, one sidebar subtree and bounded viewport | New1CSS-pixel geometry tolerance,100dvh/above-fold/focus assertions; server bounds unchanged | Prior250px assertion intentionally updated, all functional flows retained; full fidelity/axe pending |

| [0062](adr/0062-chat-stop-and-wrapup-evidence.md) | Composer Stop and exact wrap-up/archive bytes | No server threshold/timeouts changed; new browser test starts cancellation at request initiation after preserved missed-completion failure | Browser idle timing is not engine-slot release; partial text persistence remains completion-dependent |

| [0063](adr/0063-conversation-management.md) | Owner-scoped history management with idempotent metadata migration and deletion markers | New 4096-byte body,100-row page,120-character title/query,1000000-offset bounds; no existing threshold relaxed | Delete is not forensic erasure; deleted IDs cannot be reused; title/ID search uses SQLite ASCII case folding |
