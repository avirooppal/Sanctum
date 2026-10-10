# Plan coverage audit

S0-1 context update: `services/inference/src/cancellation.rs` and ingress private-peer
association share cancellation/deadline state through queued Rust engine entry
points. Unit and real TCP tests cover terminal state and disconnect propagation.
End-to-end cancellation is **Partial**: blocking inference/Knowledge/speech and
their nested engine work are not interrupted yet. S0-2 through S0-8 remain open.
ADRs 0031/0032 predeclare cleanup gates and future resident speech workers.

Step 0 ingress update: connection/lane/header/body bounds and upload stall checks
are implemented in `services/gateway/src/ingress.rs`, with unit tests and measured
`evals/results/ingress-{limits,overload}.json`. Three-minute upload-flood health p95
is 6.386ms. Overall resource governance remains **Partial**: these no-engine
checks do not establish inference/ASR/ingestion cancellation, response throughput,
process-tree leak freedom, mixed-engine load, or full graceful shutdown.
Held authenticated WebSocket criterion is **PENDING Step 1a**.

Step 0 dispatch update: `services/gateway/src/dispatch.rs` and `runtime_main.rs`
implement bounded admitted-request workers/queues with 503 backpressure and lane
priority. `gateway-dispatch.json` measures real held-upload health/models and mixed
chat/ingestion, plus overload. Mark concurrency **Partial**: held WebSocket,
transport connection bounds, disconnect/engine cancellation and storm leak tests
are not verified or implemented. This is not Step 0 acceptance.

## Single-user scope amendment

The following supersedes team-related cells throughout this historical audit.
Each is **Out of scope by decision**, not implemented: team mode/collaboration,
shared workspaces/multiple human accounts, Postgres/pgvector/Postgres FTS, team
queues, OIDC/SAML, multi-user RBAC/tenancy/per-user quotas, multi-user load and the
20-user gate, Helm/Kubernetes. See [ADR-0027](adr/0027-single-user-scope.md).
Local ACLs, personal workspace boundaries, optional GPU inference, resource limits,
single-owner workload/soak tests and signed offline deployment remain required.

Container verification update: Docker recovered; current unsigned offline chat
bundle reached first answer in 31.7311s on a fresh no-network container. Evidence:
`evals/results/phase1-clean-install.json`, `tools/clean_install_test.py`. This
supersedes the socket blocker and old timing; it does not verify a signed air-gap
release, downloads/build time, or non-Linux engines.

Incremental ASR update: `services/speech/sanctum_speech/incremental.py` provides
bounded partial replacement snapshots with either verified ASR backend. Real
isolated evidence in `speech-incremental-{parakeet,whisper}.json`; final decoding
1.97s / 1.19s. Streaming remains Partial: no hosted WebSocket, persistent native
streaming state, or engine-process cancellation. No T1 latency claim.

Browser meeting update: `apps/web/src/MeetingPanel.tsx` offers explicit reviewed
transcript save and plain-text generated notes. `meeting-browser.json` records
5/5 real browser checks. This supersedes the missing meeting UI note below;
diarization and semantic summary quality remain incomplete.

Meeting update (2026-10-10): `services/speech/sanctum_speech/hosted_meeting.py`
connects the authenticated workspace meetings route to local inference and ACL
ingestion. `evals/results/speech-meeting.json`: 7/7 real API checks, 2.053715s
summary/ingestion on a short actual ASR transcript. Phase 3 meeting mode remains
Partial: no diarization or meeting UI, and summary semantics are not quality-gated.
Unit tests enforce authorization before inference and verbatim action evidence.

Microphone update (2026-10-10): bounded start/finish capture now exists in
`apps/web/src/microphone.ts`, `capture-worklet.js` and `pcm.ts`. Real worklet to
local ASR tested with an emulated device: `speech-microphone.json` 4/4. Physical
microphone UNVERIFIED; this is final-on-commit dictation, not partial streaming ASR.

Browser speech update (2026-10-10): file dictation to draft, WAV playback and client
stop now exist in `apps/web/src/SpeechPanel.tsx` / `speech.ts`. Real browser 6/6 in
`speech-browser.json`; warm ASR-chat-TTS full-WAV latency 5.120009s in
`speech-voice-turn-warm.json`. Streaming ASR, microphone, server-side barge-in,
diarization and T1 latency remain Partial/UNVERIFIED. This is not Phase 3 acceptance.

Hosted TTS update (2026-10-10): authenticated `/v1/audio/speech` now returns real
WAV/PCM through the confined worker (`services/gateway/src/speech.rs`,
`services/speech/worker.py`). `evals/results/speech-sdk-tts.json` records 8/8 SDK
checks. This implements file synthesis only; streaming output, physical playback,
barge-in and end-to-end voice SLO remain Partial/UNVERIFIED.

Audit begun 2026-10-10 at `303d16e`; this is a live audit, not final acceptance.

Latest evidence superseding pending cells below: Linux recovered; Rust containment
reverified; `phase1-sdk.json` now records a fresh 8/8 real chat SDK run. Real whisper.cpp
file ASR is verified by `speech-jfk-smoke.json` (single public-domain sample, not a
quality corpus). `/v1/audio/transcriptions` is now implemented for authenticated solo
multipart uploads: `services/gateway/src/speech.rs`, `services/speech/worker.py`,
`speech-sdk.json` (8/8 real SDK checks). Other speech routes and full Phase 3 remain
partial. `docs/contracts/speech-worker-v1.md` states exact limits and context scope.
File VAD is now implemented by `backends/silero_cpp.py`: `speech-vad-smoke.json`
records real speech/silence checks and `speech-sdk-vad.json` the HTTP integration.
Streaming VAD/ASR and voice SLOs remain unverified; file VAD is opt-in.
`backends/parakeet_cpp.py` now supplies a second real ASREngine. Its isolated file and
HTTP results are in `speech-parakeet-smoke.json` and `speech-sdk-parakeet.json`.
Language selection is unforced and timestamps coarse; live streaming remains absent.
`backends/flite.py` now provides a real opt-in CPU TTSEngine with a versioned profile
and reviewed permissive voice artifact. `speech-tts-smoke.json` records synthesis;
physical playback and neural quality remain unverified. TTS HTTP hosting is verified above.
`Implemented` means the named scope has current executable evidence, not that the
whole phase is complete. `Partial` includes missing integrations. `UNVERIFIED` means
implementation/evidence exists but the required execution has not passed this run.
Historical result files are retained and explicitly identified. README-only service
directories are `Not done`. No claim is based merely on a protocol or a mock engine.

## Sections 1–4: product scope

| Requirement | Status | Evidence / missing work |
|---|---|---|
| §1 unified local multimodal product | Partial | Chat reference and Knowledge worker; speech libraries; vision/agents absent |
| §2 landscape | Reference | Research/inspiration, not acceptance requirements or verified current comparisons |
| §3 default-deny egress | Partial | `services/policy/src/runtime.rs`, `tools/verify_runtime.py`; Linux only, future services absent |
| §3 verifiable Privacy Ledger | Not done | No hash-chained ledger or ledger UI |
| §3 hardware adaptation | Partial | `apps/cli/sanctum/doctor.py`, `profiles/hardware.json`; Windows doctor executed, accelerator coverage incomplete |
| §3 shared identity/knowledge | Partial | Local bearer authentication, Knowledge ACLs; speech HTTP integration absent |
| §3 five-minute install / air gap | UNVERIFIED | Historical `phase1-clean-install.json` excludes build/download; signed clean-clone installation not verified |
| §3 standards | Partial | OpenAI chat, JSON/OpenAPI contracts; OTel/OIDC/MCP not implemented |
| §3 measured releases | Partial | `evals/`, CI source/profile gates; no full product release gate |
| §4 Solo/Desktop | Partial | Linux CPU reference; no Tauri shell, native Windows/macOS runtime |
| §4 Team/Server | Not done | No Compose/Helm team stack, pgvector or SSO |
| §4 Air-gapped/Regulated | Not done | Unsigned development bundle only |
| §4 Edge | Not done | Later scope; no NPU appliance profile verified |

## Sections 5–6: architecture and modules

| Requirement | Status | Evidence / missing work |
|---|---|---|
| §5 only gateway ingress; isolated engine processes | Implemented (Linux reference) | `runtime_main.rs`, `chat.rs`; fresh `tools/check_rust.sh`: HTTP health + 16 denial probes |
| §5 every module behind versioned HTTP/gRPC | Partial | `docs/contracts/`; Knowledge JSONL worker, speech in-process protocols; no universal gRPC |
| §5 request envelope and trace ID validation | Implemented (contract) | `services/gateway/tests/contracts.rs`, CLI envelope fixtures passed; not distributed tracing |
| §6.1 llama.cpp | UNVERIFIED (current run) | `LocalEngine`, historical SDK result; fresh inference check pending |
| §6.1 MLX, vLLM/SGLang | Not done | No concrete adapter/profile execution |
| §6.1 CPU/GPU/RAM/NPU discovery, quantization/context/KV | Partial | `doctor.py`, hardware profiles; NPU/Apple/NVIDIA execution unverified |
| §6.1 registry/task routing | Partial | Licensed capability registry; static chat/embedding routing, no planner routing |
| §6.1 priority queue/lazy load/keep-warm/LRU | Not done | Engines start eagerly; no resource-aware scheduler |
| §6.1 batching/cache/speculation/reasoning | Partial | Upstream llama.cpp capabilities; no controlled product configuration or verification |
| §6.1 structured output/tool calls | UNVERIFIED (current run) | `evals/sdk_chat.py`; fresh real test pending |
| §6.1 local/HF sourcing/hash checks/fit estimate | Implemented (provisioning scope) | `apps/cli/tests/test_provisioning.py` passed; speed remains unmeasured |
| §6.1 signed model bundles / multi-LoRA | Not done | Hash checks only; multi-LoRA later |
| §6.2 VAD→streaming ASR→diarization→LLM→streaming TTS | Partial | `services/speech/sanctum_speech/`; protocols and fake-engine tests only |
| §6.2 Parakeet/faster-whisper/whisper.cpp | Partial | whisper.cpp file adapter, hash pins; real inference pending; other engines absent |
| §6.2 language/hardware auto selection | Not done | Explicit local profile only |
| §6.2 live captions/PTT/meeting/diarization | Partial | Bounded dictation and meeting ingestion libraries; no microphone, diarizer, UI or listener |
| §6.2 hotwords/wake word | Partial | Prompt forwarded; no hotword decoder; wake word optional and absent |
| §6.2 TTS/voice cloning policy | Partial | Voice registry contract and fake synthesis; no real TTS backend; no cloning feature |
| §6.2 voice latency/barge-in/WER | UNVERIFIED | Evaluator tests pass; T1 corpus and live voice measurements absent |
| §6.2 OpenAI audio/WebRTC/WebSocket | Partial | OpenAPI/events only; no served audio endpoints |
| §6.3 VLM chat / images/charts | Not done | `services/vision-docs/README.md` is a placeholder |
| §6.3 structural parser/OCR/table/figure/formula/reading order | Partial | Markdown/text-PDF parser only (ADRs 0009/0010); no scanned OCR or VLM captions |
| §6.3 UI/receipt/handwriting/video | Not done | Video is stretch scope |
| §6.4 folder/upload connectors | Partial | Polling watcher and upload worker; fresh tests pass, real request pending |
| §6.4 Git/vault/email/WebDAV/SMB/S3/export connectors | Partial | Markdown vault files can be watched; dedicated connectors absent |
| §6.4 structure/parent-child/context enrichment | Partial | `parsing.py` and retrieval tests passed; no LLM chunk enrichment |
| §6.4 dedup/version/incremental index | Implemented (catalog) | `test_acl.py`, watcher tests; Windows symlink test skipped for privilege |
| §6.4 ACL/classification prefilter/revocation | Implemented (library) | `test_acl.py`, `test_vectors_prefilter_before_top_k`, meeting ACL integration passed |
| §6.4 rewrite/dense/BM25/RRF/rerank/parents | Partial | Hybrid pipeline exists; no rewrite/decomposition; concrete model rerun pending |
| §6.4 citations/highlights/groundedness | Partial | Quote validation, abstention and local judge; page-region UI absent; quote presence is not entailment |
| §6.4 embeddings/reranker/Matryoshka | Partial | Registered Qwen GGUFs; no dimension selection validation |
| §6.4 visual retrieval/compression | Not done | Optional, off |
| §6.4 graph/agentic RAG/SQL | Not done | Graph is later scope |
| §6.4 LanceDB/pgvector store abstraction | Partial | SQLite-vec adapter under ADR 0010; pgvector absent |
| §6.4 source/confidence/missing-evidence UX | Partial | API citations and abstention; web only supports chat |
| §6.5 agent loop/budgets/MCP/tools | Not done | `services/agents/README.md` placeholder |
| §6.5 container/gVisor/Firecracker sandbox quotas | Not done | Linux runtime containment is not an agent sandbox |
| §6.5 memory/workflows/approvals | Not done | Chat SQLite history only; no governed agent memory or workflow runner |
| §6.6 local accounts/OIDC/SAML/scoped API keys | Partial | Single local bearer credential; no multi-user identity or scoped keys |
| §6.6 RBAC/ABAC/allowlists/OPA/Cedar | Partial | Knowledge owner/membership/class validation; no declarative data-flow policy |
| §6.6 append-only hash-chained ledger and export/UI | Not done | No complete model/tool/retrieval/egress audit |
| §6.6 namespaces/firewall/DNS/proxy/self-test | Partial | Namespace/seccomp denial verified; cloud connectors absent, no egress proxy |
| §6.6 encryption/TLS/mTLS/keychain | Not done | Loopback bearer transport; private file permissions are not encryption |
| §6.6 signed images/SBOM/reproducible releases | Partial | Dependency licenses/hashes scanned; signing and release SBOM absent |

## Sections 7–17: profiles, assurance and delivery

| Requirement | Status | Evidence / missing work |
|---|---|---|
| §7 T0–T3 configured profiles / fit UX | Partial | Hardware fixture evaluation 8/8; CLI fit, no UI download estimate or measured full tier matrix |
| §8 accidental cloud leakage | Partial | Runtime rejects cloud enablement; no opt-in connector path |
| §8 prompt injection/tool exfiltration/malicious MCP | Not done | No complete adversarial agent/data-flow suite |
| §8 cross-tenant RAG | Implemented (library) | ACL/pre-filter/revocation tests pass; broader product penetration test absent |
| §8 poisoned weights | Partial | SHA-256 validation; signatures/bundle scanning absent |
| §8 insider/disk theft | Not done | No workspace encryption/break-glass policy |
| §9 Rust/Python/React stack and §13 directories | Implemented (layout) | Cargo workspace, uv lock, React/Tailwind web build; placeholders clearly identified |
| §9 Tauri/PWA/gRPC/MCP/queue/OPA/OIDC/OTel | Not done | Future integrations, not inferred from chosen stack |
| §10 Phase 0 gate | Partial | Current doctor and Linux probes pass; hosted CI and full service/platform matrix unverified |
| §10 Phase 1 gate | Partial | Fresh clone reaches answer, SDK 8/8 (`fresh-checkout-sdk.json`); staged artifacts/toolchain used, cold-machine <5min not established |
| §10 Phase 2 gate | UNVERIFIED | Historical synthetic v6 +0.40 recall lift; current real-document benchmark required |
| §10 Phase 3 gate | Partial | Real Whisper/Parakeet/VAD/TTS and browser dictation verified; streaming, diarization and T1 WER/<800ms incomplete |
| §10 Phase 4 gate | Not done | No measured visual QA lift |
| §10 Phase 5 gate | Not done | No agent red-team suite or Privacy Ledger |
| §10 Phase 6 gate | Not done | No 20-user reference server or signed air-gap install |
| §10 Phase 7 | Not done | Optional; deferred until 0–6 verified |
| §11 retrieval/answers evaluation | Partial | Existing synthetic datasets and local judge; no current real-corpus/human review |
| §11 visual/ASR/voice/inference/agents/privacy metrics | Partial | Speech scoring and SDK timing harnesses; most real measurements absent |
| §11 regression thresholds/CI profile checks | Implemented (foundation) | `tools/tests/test_evals.py`, `evals/run.py`; 5% and security zero tolerance (ADR 0004) |
| §12 chat/embedding/models routes | Implemented (reference) | `fresh-checkout-sdk.json` and `phase1-sdk.json`, real SDK 8/8 in this session |
| §12 workspaces/documents/search/ask | UNVERIFIED (current run) | Implemented gateway/worker; real rerun pending |
| §12 rerank/audio/realtime/agent/ledger/policy/MCP | Partial | Some schemas only; no complete public implementation |
| §14 differentiators | Partial | Aggregate goals, dependent on incomplete modules above |
| §15 risk mitigations | Partial | ADRs/license gates/default-deny exist; hardware CI, external security review and quarterly refresh absent |
| §16 first ten days | Partial | Doctor/chat/UI/isolation/Knowledge source exists; signed install and real 30–50-question corpus missing |
| §17 references | Reference | Inspiration, not shipped dependencies or verified-current claims |

## Final acceptance still required

Fresh clone → README → first answer; full clean regression and security suites;
last egress self-test plus ledger reconciliation; complete per-phase real features.
The ledger is absent, so "zero unexpected outbound connections in the ledger" cannot
currently be asserted. No final acceptance or fully green phase tags are implied.

## Step 0 cancellation evidence (2026-10-10)

Partial: shared context, owned process groups and cancellable engine I/O are tested
in `services/gateway/tests/cancellable_io.rs`, `tools/verify_supervision.py`, and
`evals/cancellation_release.py`. `evals/results/cancel-{chat,knowledge,asr,tts}.json`
records 50 actual samples per engine. This does not establish response-throughput,
engine-wide admission, full resource storm, active shutdown or mixed overload gates.

## Step 0 hardening progress

| Requirement | State | Current evidence |
|---|---|---|
| Shared context and owned process cleanup | Implemented for HTTP reference paths | cancellation-v1/process-supervision-v1 contracts; Rust tests and 38 denial probes |
| Cancellable engine I/O | Implemented reference | engine-storms-verified-* 500 real disconnect/explicit samples, observed actual model slot idle/CLI absence, all p95/max gates passed |
| Response/upload throughput | Implemented reference | response-flow tests and response-backpressure.json actual embedding/SSE/upload probes |
| Active/queued bounded shutdown | Implemented reference | repeated-shutdown.json three active/queued cycles max 1.198612s, zero survivors |
| Cross-caller engine limits | Implemented reference | engine_admission Rust/Python interoperability and engine-admission.json actual 503/Retry-After |
| Real engine crash recovery | Implemented reference | engine-crash-storage.json: queued/next requests succeed, affected turn not saved, old PID absent and resources restored |
| Resource storms | Implemented reference | engine-storms-verified.json and 500 per-engine/method samples; exact restoration and worst retained RSS +13248KiB |
| Mixed-engine sustained overload | Implemented reference | mixed-engine-overload.json 181.527s; all predeclared lane/resource gates passed, zero foreground errors |
| Held authenticated WebSocket | PENDING Step 1a | No authenticated WebSocket implemented yet |

Step 0 final local verification: 49 Rust and 138 source tests, 38 kernel denial
probes, 500 per-engine disconnect/explicit samples, three active start/stop cycles,
and the 181.527s mixed-engine gate pass. `final-priority-active-shutdown.json`
records the final 0.759479s stop with zero surviving owned PIDs. Real authenticated
WebSocket remains explicitly PENDING Step 1a; this does not complete Phase 3.
