# Plan coverage — current evidence only

Audit date: 2026-10-11. Verified source: `7cbc426d13b284856563c6e0a103f202b24557bf`
on `ui-hermes-port`. This replaces the chronological audit, not its evidence.
Previous file archived **verbatim** at
[old audit](status-archive/2026-10-11-plan-coverage-before-refresh.md), SHA256
`3697d6ac2d2a3e76c9f4ef58e3e07b063c2e35e7c3018bec09483eb5b3117932`.

## Rules and evidence index

- **Implemented** applies only to the narrow requirement named in that row and
  requires execution observed during this audit session. It is not phase acceptance.
- **Partial** includes incomplete or entirely absent software, explicitly described
  in the gap column. It must not be relabeled a hardware exception.
- **UNVERIFIED** identifies execution not established here; missing implementation
  is stated separately. Historical measurements do not establish a current pass.
- **Out of scope by decision** requires an ADR. ADR0027 removes team features, not
  owner LAN mode, owner ACLs, optional GPU backends or sandbox tiers.
- Every subsequent slice must update its row IDs here and the matching rows in
  RELEASE_CHECKLIST.md in the **same commit** as code/tests. Preserve failed runs.

All paths below are repository-relative. E1–E8 refer only to this session:

| ID | Command / result / raw evidence |
|---|---|
| E1 | `python tools/check.py` under the WSL development venv, PYTHONPATH unset: 157 tests (24 CLI,20 tools,24 Knowledge,69 speech,20 eval), Ruff/format/declared ty scopes, generated API consistency PASS. `evals/results/audit-refresh-source.log`. Registry scans:26 Python/72 npm dependencies;5 font asset/notice hashes. These scans compare reviewed metadata; they are not a fresh upstream legal review. |
| E2 | `bash tools/check_rust.sh`:57 Rust tests, fmt/clippy -D warnings,92 crate licenses,22 containment +16 runtime/exec-child denial checks PASS. `evals/results/audit-refresh-rust.log`; supervision3 cases,zero survivors,release0.566360/0.539456/0.566059s in `audit-refresh-process-supervision.json`. |
| E3 | `npm test --prefix apps/web`32+2 PASS; `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; `npm audit --audit-level=low --prefix apps/web`0 advisories. `evals/results/audit-refresh-web.log`. |
| E4 | `bash tools/smoke_all.sh` with runtime-dispatch config and local token:8 real stages PASS; **release_complete=false**. `evals/results/audit-refresh-smoke.log` and `audit-refresh-smoke-all-reference.json`. SDK8 checks,chat3.5742s,TTFT0.5524s,1024-dimensional embeddings: `audit-refresh-smoke-chat.json`. These are smoke timings, not controlled SLO benchmarks. |
| E5 | Real browser tests in E4: Knowledge6 checks with cited amber answer,empty-workspace abstention,zero foreign HTTP/WS requests on that surface; chat Stop4 checks; file speech UI7 checks. `audit-refresh-smoke-ui-knowledge.json`, `audit-refresh-smoke-ui-chat-stop.json`, `audit-refresh-smoke-ui.log`. |
| E6 | `node evals/browser_meeting.mjs ...`5 PASS and `node evals/browser_microphone.mjs ...`4 PASS. `audit-refresh-meeting-browser.json`, `audit-refresh-speech-microphone.json`. Summary semantic quality and physical microphone are explicitly **not verified**. |
| E7 | WSL `python evals/realtime_transport.py --token-file /home/aviroop/.local/share/sanctum-dispatch-smoke/local.token --output .sanctum/audit-refresh-realtime-linux.json`:13 PASS,handshake1.877212s,partial-frame1.870464s,expiry30.104537s. `audit-refresh-realtime-linux.json`. Windows invocation first FAILED existing handshake<2s assertion: `audit-refresh-realtime.log`; no exact elapsed number emitted. Do not count it as a pass. No held-session/load rerun this session. |
| E8 | `python -m sanctum doctor --json`: Linux x86_64,12 CPUs,8167555072 RAM bytes,no GPU,NPU unknown; recommendation=null,exit1. `audit-refresh-doctor.json`. This is below the configured8GiB floor; no floor relaxed. Hosted exact7cbc426 CI all5 jobs observed successful: [run38145322030](https://github.com/avirooppal/Sanctum/actions/runs/38145322030). |

## Sections 1–5: product, modes and architecture

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| P1 §1 unified private text/knowledge/speech/vision/agents | Partial | E4 verifies chat,RAG,file speech only. Full live voice,vision,agents absent. |
| P2 §2 landscape and lessons; §17 inspirations | Partial | Reference context, not executable acceptance. No current competitor/performance assertions verified in this session. Swappable local adapters exist; complete desktop experience and policy do not. |
| P3a §3 default-deny and explicit per-workspace cloud connectors | Partial | `services/policy/src/runtime.rs`,E2 Linux denial; connectors unavailable,not an implemented logged/revocable allowlist. Future components cannot inherit a verification claim. |
| P3b §3 verifiable Privacy Ledger | Partial | Ledger,verify command and packet reconciliation absent. Startup denial alone is not a ledger. |
| P3c §3 hardware adaptation | Partial | `apps/cli/sanctum/doctor.py`,E1 doctor fixtures; E8 actual host has no recommended profile. |
| P3d §3 shared auth,memory,knowledge,tools,audit | Partial | `services/gateway/src/chat.rs`,E4/E6 owner routes; agents and common audit absent. |
| P3e §3 signed five-minute install and air gap | Partial | No current clean-install timing or signed product bundle evidence. |
| P3f §3 standards: OpenAI,MCP,OTel,GGUF/safetensors | Partial | E4 OpenAI+GGUF reference; MCP,OTel and complete safetensors engine support absent. |
| P3g §3 measured releases | Partial | E1–E7 scoped tests; no full RAG/WER/DER/visual/agent/soak release measurement. |
| P4a §4 solo/desktop | Partial | Linux CPU runtime and browser E4/E5; Tauri/native packages absent. |
| P4b §4 team mode,SSO,multiple accounts/sharing,Postgres/pgvector,team queues,Helm,multi-user quota/load | Out of scope by decision | [ADR0027](adr/0027-single-user-scope.md). Owner LAN/resources/ACLs retained. |
| P4c §4 air-gapped mode | Partial | Signed offline install and audit export absent. Unsigned development tools are not release artifacts. |
| P4d §4 edge/appliance,NPU | Partial | Plan marks later; no validated appliance implementation. No scope cut is inferred. |
| P5a §5 separate swappable services/versioned contracts | Partial | `docs/contracts/`,`services/inference/src/lib.rs`,Knowledge/speech worker interfaces,E1/E2; no complete gRPC surface or vision/agents. |
| P5b §5 gateway-only ingress / allowlisted egress | Partial | E2 isolated runtime/exec-child probes; full product proxy and connector governance absent. |
| P5c §5 request envelope validation | Implemented | `services/gateway/tests/contracts.rs::shared_envelope_fixtures_match_contract`,E2; CLI `test_envelope_rejects_missing_identity_and_invalid_traces`,E1. End-to-end propagation to absent services is not claimed. |

## Section 6.1: inference

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| I1 llama.cpp CPU adapter / OpenAI chat,streaming,embeddings,models | Implemented | `services/inference/src/lib.rs`,`services/gateway/src/chat.rs`; `evals/sdk_chat.py`,E4 real8 checks. Scope is installed Linux CPU reference. |
| I2 MLX / vLLM or SGLang / accelerator offload | Partial | Concrete alternative adapters and full hardware verification absent. Do not describe this as hardware-only. |
| I3 CPU/GPU/VRAM/RAM/NPU discovery and quant/context/KV profile selection | Partial | `doctor.py`,`profiles/hardware.json`; E1 boundary/probe tests, E8 no-fit,NPU unknown; accelerator/native probes not established. |
| I4 capability registry,task/classifier/reasoning routing | Partial | `profiles/registry.json`,E1 registry tests; current chat/embed routes do not implement planner routing. |
| I5 priority queue and admission | Partial | `services/gateway/src/dispatch.rs`,`services/gateway/src/engine_admission.rs`,E2 unit/contracts. Current mixed-engine load not rerun; full owner scheduling absent. |
| I6 lazy load,keep-warm,LRU,memory guards | Partial | Engines launched eagerly; complete memory-aware lifecycle absent. |
| I7 batching,prefix/KV cache,speculative decoding,reasoning toggle,multi-LoRA | Partial | Upstream capability is not product acceptance; cache/role code exists, no current feature benchmarks. Multi-LoRA is later. |
| I8 JSON schema and tool-call output | Implemented | `evals/sdk_chat.py` json_schema/tools real checks,E4. This is structured output,not governed tool execution. |
| I9 local mirror/HF download,hash validation,fit/speed estimates | Partial | `apps/cli/tests/test_provisioning.py` hash mismatch/offline import/network-explicit/speed-not-fabricated,E1. Actual download and fit UI not verified; speed not measured. |
| I10 signed models/bundles and quarterly family refresh | Partial | Registry/hash checks exist,E1; signatures and measured profile refresh absent. Example model names are not claimed current/appropriate. |

## Section 6.2: speech

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| S1 VAD→streaming ASR→diarization→LLM→streaming TTS | Partial | `services/speech/sanctum_speech/` interfaces,E1; full resident WebSocket pipeline absent. |
| S2 Parakeet file ASR | Implemented | `backends/parakeet_cpp.py`,gateway speech worker; E4 real SDK8 cases on hash-identified JFK fixture. No corpus-quality claim. |
| S3 whisper.cpp / faster-whisper | Partial | `backends/whisper_cpp.py`,E1 adapter tests; Whisper real engine not rerun; faster-whisper blocked under [ADR0017](adr/0017-speech-asr-engine-license-gate.md),not implemented. |
| S4 language/hardware auto-selection,pinning,hotwords | Partial | Explicit configured IDs; no validated automatic multilingual routing/hotword quality. |
| S5 file/streaming VAD,EOU,live captions | Partial | VAD/incremental source tests,E1; real VAD/streaming path not established by current smoke. |
| S6 push-to-talk anywhere / microphone | Partial | `apps/web/src/microphone.ts`,`pcm.ts`,E6 real worklet with emulated input. Desktop-global dictation absent; physical audio UNVERIFIED. |
| S7 meeting summary/action items into Knowledge | Partial | `hosted_meeting.py`,`MeetingPanel.tsx`,E6 5 browser checks; no diarization,editable speaker labels or semantic-quality gate. |
| S8 TTS voices / cloning policy | Partial | Flite file synthesis verified8 SDK cases,E4; resident/streaming neural TTS and voice cloning governance absent. Cloning not exposed. |
| S9 barge-in,playback acknowledgement,history truncation,echo handling | Partial | Client Stop exists,E5; complete voice barge-in absent. |
| S10 <800ms T1 EOS-to-first-audio / WER / DER | Partial | Evaluation functions tested,E1. Real>=50-turn WS and corpus/DER gates not implemented/measured; T1 hardware result UNVERIFIED,not the only gap. |
| S11 audio HTTP endpoints | Implemented | `services/gateway/src/speech.rs`,`services/speech/worker.py`; E4 ASR8/TTS8 SDK checks. File modes only. |
| S12 authenticated WebSocket transport | Implemented | `services/gateway/src/realtime.rs`,E7 13 Linux transport checks and E2 contracts; speech_pipeline=false. Windows-side deadline failure retained. |
| S13 held sessions/overload under voice caps | UNVERIFIED | Existing `evals/realtime_held.py`; not rerun this session. Prior results remain archived,not current acceptance. |
| S14 optional wake word | Partial | Not implemented; optional,not silently counted complete. |

## Sections 6.3–6.4: vision and Knowledge

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| V1 VLM images/screenshots/charts,multi-image/capability/size/EXIF controls | Partial | Vision implementation and corresponding UI absent. |
| V2 OCR,structural tables/figures/formulas/reading order,captions | Partial | Markdown/text-PDF parser only; [ADR0009](adr/0009-knowledge-parser-license-boundary.md) selection; OCR/VLM/layout/bbox output absent. |
| V3 receipt/invoice structured extraction,handwriting,agent UI understanding | Partial | No real pipeline/evidence. |
| V4 video sampling + ASR timeline | Partial | Stretch requirement; not implemented,not a release claim. |
| K1 upload | Implemented | `services/knowledge/worker.py`,`apps/web/src/KnowledgePanel.tsx`; E4/E5 real restricted document upload/cited answer. Markdown scope tested live. |
| K2 local folder watch / Markdown vault | Partial | `services/knowledge/watch.py`,E1 root confinement/content-hash/size tests; no current live watcher run. |
| K3 Git,email/IMAP,WebDAV,SMB,S3,Confluence/Notion exports | Partial | Dedicated connectors absent; file import is not equivalent to authenticated connectors. |
| K4 structural chunks,parent-child,enrichment | Partial | `sanctum_knowledge/parsing.py`,E1 heading/parent/untrusted markup tests; LLM contextual enrichment and full PDF layout absent. |
| K5 dedup/version/incremental catalog | Implemented | `sanctum_knowledge/store.py`,E1 `test_dedup_version_and_parent_expansion_acl`; catalog scope,not all connector workflows. |
| K6 document ACL/classification inheritance,prefilter,revocation | Implemented | `test_document_acl_and_revocation_apply_before_candidates`,`test_vectors_prefilter_before_top_k`,`test_cross_workspace_and_membership_are_denied`,E1; E4 real authorized retrieval. No independent penetration-test claim. |
| K7 rewrite/decomposition,dense+BM25,RRF,rerank,parent context/dedupe | Partial | `sanctum_knowledge/retrieval.py`,E1 RRF/parent/ACL tests and E4 real ask; rewrite/decomposition absent; comparative quality gate not rerun. |
| K8 citations and abstention | Implemented | `local_models.py`,E1 unknown chunk/nonverbatim quote tests; `KnowledgePanel.tsx`,E5 source/quote display and empty-workspace abstention. Entailment accuracy not established. |
| K9 page/region highlights,confidence,missing-evidence UX | Partial | Source/page/quote fields exist; actual page-region overlays and calibrated confidence absent. |
| K10 embeddings/reranker, multilingual/Matryoshka dims | Partial | E4 real1024-d embeddings and RAG; multilingual/dimension-reduction quality unmeasured. |
| K11 visual retriever/fusion/compression | Partial | Optional and absent/off; no measured lift. |
| K12 graph/global query,agentic searches/citation following,SQL tables | Partial | Graph is later; agentic RAG/SQL absent. |
| K13 embedded vector abstraction | Implemented | `sanctum_knowledge/vectors.py`,E1 prefilter tests/E4 local RAG using sqlite-vec substitution under ADR0010; no LanceDB claim. |
| K14 LanceDB default | Partial | [ADR0010](adr/0010-permissive-vector-adapter.md) substitution; default adapter not restored. |

## Sections 6.5–6.6: agents, governance and security

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| A1 plan/tool/observe/reflect loop and step/token/time/compute budgets | Partial | No production agent loop. |
| A2 MCP client/server,stdio/HTTP,knowledge/transcribe/OCR/code tools | Partial | No complete MCP implementation. |
| A3 pinned/signed manifests,scope,name-shadow/rug-pull defense | Partial | Absent. |
| A4 scoped file ops,code,browser proxy,calendar/email,read-only SQL | Partial | Governed built-in tools absent. |
| A5 container/gVisor/Firecracker,egress/CPU/RAM/disk/time quotas,ephemeral FS | Partial | Trusted-engine confinement E2 is not a hostile-code sandbox; agent sandbox absent. KVM availability alone cannot complete it. |
| A6 editable/exportable user/project memory | Partial | `storage.rs` conversation turns exist; governed persistent agent memory absent. |
| A7 visual workflow builder,event/scheduled triggers | Partial | Absent. Upstream Hermes cron is omitted; Sanctum's plan workflow requirement is not silently removed. |
| A8 exact-argument approvals,diff preview,timeout deny/replay defense | Partial | Absent. |
| G1 local owner auth | Implemented | `chat.rs`,E4 real auth/unknown-model SDK checks; single owner only. |
| G2 scoped API keys / data-class model-tool rules | Partial | Single owner token and Knowledge ACLs; declarative model/tool data-flow policy absent. |
| G3 OPA/Rego or Cedar,taint tracking,review before memory write | Partial | Absent. No model-level prompt-injection immunity claimed. |
| G4 hash ledger,query/export/UI,signed checkpoints,tamper verification | Partial | Absent. No claim of zero unexpected outbound traffic reconciled with a ledger. |
| G5 namespace/seccomp/startup deny | Implemented | `services/policy/src/runtime.rs`,`tools/verify_containment.py`,`verify_runtime.py`,E2 38 Linux checks. Scoped to tested reference processes. |
| G6 DNS sinkhole,allowlist proxy,per-workspace connector enable/revoke/logging | Partial | Explicit connector path absent; no broad platform completion claim. |
| G7 encryption at rest,rotation,keychain,sealed secrets,backup | Partial | File permissions are not encryption. Implementation absent. |
| G8 TLS LAN,Host/Origin allowlist,lockout,LAN ledger;internal mTLS | Partial | Loopback auth/Origin tests E2/E7; owner LAN TLS absent. Team identity remains excluded by ADR0027. |
| G9 signed images/models,reproducible artifacts,SBOM | Partial | Hash/license gates E1/E2; release signing/SBOM and reproducibility unverified. |

## Sections 7–9: profiles, threat model and stack

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| H1 config-based T0/T1/T2 profiles and fit/speed UX | Partial | `profiles/hardware.json`,`doctor.py`,E1 fixtures; E8 no-fit on host; UI fit/license estimates absent. |
| H2 accelerator hardware matrix and NPU | UNVERIFIED | Hardware execution not established; E8 reports NPU unknown. Missing adapters remain I2 Partial. |
| H3 T3/team defaults | Out of scope by decision | ADR0027 team product removed; optional owner NVIDIA backend retained in I2. |
| T1 accidental cloud leak / prompt injection / authorized-tool exfil / malicious MCP | Partial | E2 denial and E1 untrusted retrieval tests; complete policy/red-team/ledger absent. |
| T2 cross-workspace retrieval isolation | Implemented | K6/E1 scoped tests; team isolation is out of scope under ADR0027. |
| T3 poisoned weights and supply chain | Partial | E1 rejects bad hashes/noncommercial metadata; signature and adversarial weight/bundle audit absent. |
| T4 insider/disk theft | Partial | Encryption and audit absent; multi-human RBAC excluded ADR0027. |
| ST1 Rust/Python/React/Tailwind/SQLite/local queue | Implemented | `Cargo.toml`,`pyproject.toml`,`apps/web/package.json`; E1–E4 builds/tests. This is stack selection,not all module behavior. |
| ST2 Tauri/PWA/gRPC/MCP/policy/OTel/Prometheus/dashboard | Partial | No complete implemented/verified stack for these integrations. |
| ST3 Postgres/pgvector/NATS/Redis/team OIDC/Helm | Out of scope by decision | ADR0027; owner equivalents remain open elsewhere. |

## Sections 10–13: phase gates, evaluations, APIs and layout

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| PH0 foundations,contracts,doctor,egress | Partial | E1/E2 foundation tests pass; E8 actual doctor recommendation=null. No phase tag. |
| PH1 chat,downloads,UI,auth,SQLite / <5min clean install | Partial | I1/I8/G1 implemented scope; no fresh clean-machine timing this session,MLX/UI incomplete. |
| PH2 hybrid beats baseline,recall/faithfulness,page highlights | Partial | K rows; no current real-document ablation/human review results. |
| PH3 voice WER and T1 latency | Partial | S rows; full voice pipeline and corpus acceptance absent. |
| PH4 measured visual-QA lift | Partial | V rows absent; optional visual retrieval stays off. |
| PH5 red-team and zero unexpected ledger egress | Partial | A/G rows absent; no attack-success table yet. |
| PH6 single-owner install/encryption/bundle/one-hour soak | Partial | ADR0027 replacement; no verified packages/full workload soak.20-user gate excluded. |
| PH7 PWA,IDE/plugin SDK/templates,demos,benchmark site/leaderboard | Partial | Optional/later; no completion claim. Desktop installer retained in PH6. |
| EV1 RAG recall/MRR/nDCG,faithfulness,citation precision,abstention/local judge/human review | Partial | E1 evaluator/local judge tests and E5 narrow real citation/abstention; no current quality corpus measurements. |
| EV2 WER/CER/RTF,DER,voice EOS latency/barge-in | Partial | `evals/speech_eval.py`,`run_speech_asr.py`,E1 tests; full required corpus/voice evaluation absent. |
| EV3 visual accuracy/CIs,agent success/budget/safety,privacy packet capture | Partial | Required real evaluation and human-reviewed subset absent. |
| EV4 inference TTFT/tokens/sec/throughput/VRAM | Partial | E4 single smoke TTFT; no controlled per-tier benchmark. |
| EV5 regression threshold and security zero tolerance | Implemented | `tools/tests/test_evals.py::test_regression_and_missing_metrics_fail`, `test_security_has_zero_tolerance`,E1; [ADR0004](adr/0004-eval-thresholds.md). Foundation scope,not missing eval suites. |
| API1 chat/embedding/models | Implemented | I1/I8,E4. |
| API2 audio HTTP / realtime voice | Partial | S11 HTTP and S12 transport implemented; actual WS voice absent. |
| API3 public rerank | Partial | Internal reranker exists; public `/v1/rerank` not verified/claimed. |
| API4 workspaces/documents/search/ask | Implemented | `worker.py`,`chat.rs`,E4 real upload/search/cited answer/empty abstention; E5 UI. |
| API5 agents/runs/SSE,ledger,policies,MCP | Partial | Not implemented. |
| L1 §13 monorepo layout | Implemented | `apps/`,`services/`,`profiles/`,`evals/`,`deploy/`,`docs/`,`tools/`; E1/E2/E3 resolve source/contracts/builds. Empty service READMEs do not mean implemented engines. |
| L2 remove placeholders / per-service operational docs | Partial | Final cleanup still required; agents/vision/desktop incomplete. |

## Sections 14–17 and mission delivery

| ID / requirement | Status | Implementation/evidence and remaining boundary |
|---|---|---|
| D14 §14 privacy,unified modalities,adaptive profiles,RAG,agents,signed bundles,public evals | Partial | Aggregate of P3,H1,K,A,G,EV,PH6; no SOTA/exactness claim. |
| R15 §15 scope gates/engine churn/hardware matrix/storage cost/latency/licensing/privacy/maintained libraries | Partial | E1/E2 registry gates and interfaces exist; quarterly refresh,complete hardware CI and third-party security review absent. No scope cut declared in this slice. |
| F16a §16 days1–2 foundations | Partial | P5c/E1/E2,doctor gap E8. |
| F16b §16 days3–5 chat/UI/SQLite | Implemented | I1,E4/E5; basic UI scope,not completed Hermes port. |
| F16c §16 days6–7 egress/self-test | Implemented | G5/E2 Linux reference scope. |
| F16d §16 days8–9 structural ingest/hybrid | Partial | K rows; Docling/LanceDB defaults substituted by ADR0009/0010; live folder ingestion not rerun. |
| F16e §16 day10 30–50 real-document labels/baseline | Partial | Foundation8-case eval passes,E1; required current real-document retrieval baseline absent. |
| U1 Amendment UI source/license/theme/provenance foundation | Partial | E1 source-inventory/font hash tests,E3 theme tests; upstream legal records not re-audited at source this session. |
| U2 UI chat/Stop/Knowledge/history/model/settings | Partial | E5 current real Stop/Knowledge/chat; search/rename/delete,fit/license picker,settings,status,Markdown/palette/retry/undo incomplete. |
| U3 UI fidelity/axe/keyboard/contrast/full HTTP+WS egress | Partial | E5 Knowledge surface zero foreign requests; no current full reference/fidelity/a11y/all-screen gate. |
| D1 offline five-modality product plus LAN/encryption/resources | Partial | E4 eight-stage incremental smoke explicitly release_complete=false. |
| D2 verified dist/installers/Compose/Tauri/signed bundle/checksums/SBOM | Partial | No release artifacts verified this session. |
| D3 complete repo/in-app user/developer/API/security/ADR/notices/release docs | Partial | E1 API generation consistency; full guide and release docs incomplete. |
| D4 lint/tests/audit/coverage/unused code/red-team/soak/UI gates | Partial | E1–E7 scoped results; coverage,Rust vulnerability audit,full security/eval/soak/UI gates absent. |
| D5 coverage/support matrix/exact verification commands | Partial | This live audit and RELEASE_CHECKLIST now track gaps; blank commands explicitly block acceptance until real runners exist. |
| D6 clean-clone loopback+LAN acceptance,packet-ledger reconciliation,tags,handoff | Partial | Not executed; no release/phase tags justified. |
