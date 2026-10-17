# Plan coverage — current conservative audit

Date:2026-10-17. Source base:c91cc58a249aa14db97d625116e8f4ca1a4b294d plus
current UI slice. Old audit archived verbatim at
[archive](status-archive/2026-10-17-coverage-before-ui-alignment.md),SHA256
`7e76314f555640430c6ce87763a60947e23f0718c0e59e9764b75b4e5289694d`. All requirement IDs retained below;unproven Implemented claims
are downgraded. Partial includes absent software,not just hardware exceptions.
The old25-case browser suite uses canned API replies and is not real acceptance.

## Current evidence

N1:tools/run_source_gate.sh174 tests PASS;N2:tools/check_rust.sh67 tests,38 denial
probes PASS. N3:web80 tests,typecheck/build,audit0. Fresh logs under
evals/results/workflow-ui-*. These verify only tested source/reference scopes.
N4:real smoke and onboarding outputs are recorded with this slice;release_complete
remains false. No full journey,ledger,WER/DER/visual-QA,soak or packaging gate is
claimed. All12 journey statuses remain canonical PARTIAL/PENDING.

## Sections 1–5: product, modes and architecture

| Requirement | Status | Current evidence / gap |
|---|---|---|
| P1 Â§1 unified private text/knowledge/speech/vision/agents | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P2 Â§2 landscape and lessons; Â§17 inspirations | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3a Â§3 default-deny and explicit per-workspace cloud connectors | Partial | Current full requirement not established. Source pointers: `services/policy/src/runtime.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3b Â§3 verifiable Privacy Ledger | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3c Â§3 hardware adaptation | Partial | Current full requirement not established. Source pointers: `apps/cli/sanctum/doctor.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3d Â§3 shared auth,memory,knowledge,tools,audit | Partial | Current full requirement not established. Source pointers: `services/gateway/src/chat.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3e Â§3 signed five-minute install and air gap | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3f Â§3 standards: OpenAI,MCP,OTel,GGUF/safetensors | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P3g Â§3 measured releases | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P4a Â§4 solo/desktop | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P4b Â§4 team mode,SSO,multiple accounts/sharing,Postgres/pgvector,team queues,Helm,multi-user quota/load | Out of scope by decision | [ADR0027](adr/0027-single-user-scope.md);owner ACLs,LAN,optional GPU retained. |
| P4c Â§4 air-gapped mode | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P4d Â§4 edge/appliance,NPU | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P5a Â§5 separate swappable services/versioned contracts | Partial | Current full requirement not established. Source pointers: `docs/contracts/`, `services/inference/src/lib.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P5b Â§5 gateway-only ingress / allowlisted egress | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| P5c Â§5 request envelope validation | Partial | Current full requirement not established. Source pointers: `services/gateway/tests/contracts.rs::shared_envelope_fixtures_match_contract`, `test_envelope_rejects_missing_identity_and_invalid_traces`. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Section 6.1: inference

| Requirement | Status | Current evidence / gap |
|---|---|---|
| I1 llama.cpp CPU adapter / OpenAI chat,streaming,embeddings,models | Partial | Current full requirement not established. Source pointers: `services/inference/src/lib.rs`, `services/gateway/src/chat.rs`, `evals/sdk_chat.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I2 MLX / vLLM or SGLang / accelerator offload | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I3 CPU/GPU/VRAM/RAM/NPU discovery and quant/context/KV profile selection | Partial | Current full requirement not established. Source pointers: `doctor.py`, `profiles/hardware.json`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I4 capability registry,task/classifier/reasoning routing | Partial | Current full requirement not established. Source pointers: `profiles/registry.json`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I5 priority queue and admission | Partial | Current full requirement not established. Source pointers: `services/gateway/src/dispatch.rs`, `services/gateway/src/engine_admission.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I6 lazy load,keep-warm,LRU,memory guards | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I7 batching,prefix/KV cache,speculative decoding,reasoning toggle,multi-LoRA | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I8 JSON schema and tool-call output | Partial | Current full requirement not established. Source pointers: `evals/sdk_chat.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I9 local mirror/HF download,hash validation,fit/speed estimates | Partial | Current full requirement not established. Source pointers: `apps/cli/tests/test_provisioning.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| I10 signed models/bundles and quarterly family refresh | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Section 6.2: speech

| Requirement | Status | Current evidence / gap |
|---|---|---|
| S1 VAD→streaming ASR→diarization→LLM→streaming TTS | Partial | Current full requirement not established. Source pointers: `services/speech/sanctum_speech/`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S2 Parakeet file ASR | Partial | Current full requirement not established. Source pointers: `backends/parakeet_cpp.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S3 whisper.cpp / faster-whisper | Partial | Current full requirement not established. Source pointers: `backends/whisper_cpp.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S4 language/hardware auto-selection,pinning,hotwords | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S5 file/streaming VAD,EOU,live captions | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S6 push-to-talk anywhere / microphone | Partial | Current full requirement not established. Source pointers: `apps/web/src/microphone.ts`, `pcm.ts`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S7 meeting summary/action items into Knowledge | Partial | Current full requirement not established. Source pointers: `hosted_meeting.py`, `MeetingPanel.tsx`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S8 TTS voices / cloning policy | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S9 barge-in,playback acknowledgement,history truncation,echo handling | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S10 <800ms T1 EOS-to-first-audio / WER / DER | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S11 audio HTTP endpoints | Partial | Current full requirement not established. Source pointers: `services/gateway/src/speech.rs`, `services/speech/worker.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S12 authenticated WebSocket transport | Partial | Current full requirement not established. Source pointers: `services/gateway/src/realtime.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S13 held sessions/overload under voice caps | UNVERIFIED | Current full requirement not established. Source pointers: `evals/realtime_held.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| S14 optional wake word | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Sections 6.3–6.4: vision and Knowledge

| Requirement | Status | Current evidence / gap |
|---|---|---|
| V1 VLM images/screenshots/charts,multi-image/capability/size/EXIF controls | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| V2 OCR,structural tables/figures/formulas/reading order,captions | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| V3 receipt/invoice structured extraction,handwriting,agent UI understanding | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| V4 video sampling + ASR timeline | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K1 upload | Partial | Current full requirement not established. Source pointers: `services/knowledge/worker.py`, `apps/web/src/KnowledgePanel.tsx`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K2 local folder watch / Markdown vault | Partial | Current full requirement not established. Source pointers: `services/knowledge/watch.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K3 Git,email/IMAP,WebDAV,SMB,S3,Confluence/Notion exports | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K4 structural chunks,parent-child,enrichment | Partial | Current full requirement not established. Source pointers: `sanctum_knowledge/parsing.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K5 dedup/version/incremental catalog | Partial | Current full requirement not established. Source pointers: `sanctum_knowledge/store.py`, `test_dedup_version_and_parent_expansion_acl`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K6 document ACL/classification inheritance,prefilter,revocation | Partial | Current full requirement not established. Source pointers: `test_document_acl_and_revocation_apply_before_candidates`, `test_vectors_prefilter_before_top_k`, `test_cross_workspace_and_membership_are_denied`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K7 rewrite/decomposition,dense+BM25,RRF,rerank,parent context/dedupe | Partial | Current full requirement not established. Source pointers: `sanctum_knowledge/retrieval.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K8 citations and abstention | Partial | Current full requirement not established. Source pointers: `local_models.py`, `KnowledgePanel.tsx`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K9 page/region highlights,confidence,missing-evidence UX | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K10 embeddings/reranker, multilingual/Matryoshka dims | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K11 visual retriever/fusion/compression | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K12 graph/global query,agentic searches/citation following,SQL tables | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K13 embedded vector abstraction | Partial | Current full requirement not established. Source pointers: `sanctum_knowledge/vectors.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| K14 LanceDB default | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Sections 6.5–6.6: agents, governance and security

| Requirement | Status | Current evidence / gap |
|---|---|---|
| A1 plan/tool/observe/reflect loop and step/token/time/compute budgets | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A2 MCP client/server,stdio/HTTP,knowledge/transcribe/OCR/code tools | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A3 pinned/signed manifests,scope,name-shadow/rug-pull defense | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A4 scoped file ops,code,browser proxy,calendar/email,read-only SQL | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A5 container/gVisor/Firecracker,egress/CPU/RAM/disk/time quotas,ephemeral FS | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A6 editable/exportable user/project memory | Partial | Current full requirement not established. Source pointers: `storage.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A7 visual workflow builder,event/scheduled triggers | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| A8 exact-argument approvals,diff preview,timeout deny/replay defense | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G1 local owner auth | Partial | Current full requirement not established. Source pointers: `chat.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G2 scoped API keys / data-class model-tool rules | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G3 OPA/Rego or Cedar,taint tracking,review before memory write | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G4 hash ledger,query/export/UI,signed checkpoints,tamper verification | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G5 namespace/seccomp/startup deny | Partial | Current full requirement not established. Source pointers: `services/policy/src/runtime.rs`, `tools/verify_containment.py`, `verify_runtime.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G6 DNS sinkhole,allowlist proxy,per-workspace connector enable/revoke/logging | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G7 encryption at rest,rotation,keychain,sealed secrets,backup | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G8 TLS LAN,Host/Origin allowlist,lockout,LAN ledger;internal mTLS | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| G9 signed images/models,reproducible artifacts,SBOM | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Sections 7–9: profiles, threat model and stack

| Requirement | Status | Current evidence / gap |
|---|---|---|
| H1 config-based T0/T1/T2 profiles and fit/speed UX | Partial | Current full requirement not established. Source pointers: `profiles/hardware.json`, `doctor.py`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| H2 accelerator hardware matrix and NPU | UNVERIFIED | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| H3 T3/team defaults | Out of scope by decision | [ADR0027](adr/0027-single-user-scope.md);owner ACLs,LAN,optional GPU retained. |
| T1 accidental cloud leak / prompt injection / authorized-tool exfil / malicious MCP | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| T2 cross-workspace retrieval isolation | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| T3 poisoned weights and supply chain | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| T4 insider/disk theft | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| ST1 Rust/Python/React/Tailwind/SQLite/local queue | Partial | Current full requirement not established. Source pointers: `Cargo.toml`, `pyproject.toml`, `apps/web/package.json`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| ST2 Tauri/PWA/gRPC/MCP/policy/OTel/Prometheus/dashboard | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| ST3 Postgres/pgvector/NATS/Redis/team OIDC/Helm | Out of scope by decision | [ADR0027](adr/0027-single-user-scope.md);owner ACLs,LAN,optional GPU retained. |

## Sections 10–13: phase gates, evaluations, APIs and layout

| Requirement | Status | Current evidence / gap |
|---|---|---|
| PH0 foundations,contracts,doctor,egress | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH1 chat,downloads,UI,auth,SQLite / <5min clean install | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH2 hybrid beats baseline,recall/faithfulness,page highlights | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH3 voice WER and T1 latency | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH4 measured visual-QA lift | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH5 red-team and zero unexpected ledger egress | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH6 single-owner install/encryption/bundle/one-hour soak | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| PH7 PWA,IDE/plugin SDK/templates,demos,benchmark site/leaderboard | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| API1 chat/embedding/models | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| API2 audio HTTP / realtime voice | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| API3 public rerank | Partial | Current full requirement not established. Source pointers: `/v1/rerank`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| API4 workspaces/documents/search/ask | Partial | Current full requirement not established. Source pointers: `worker.py`, `chat.rs`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| API5 agents/runs/SSE,ledger,policies,MCP | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| L1 Â§13 monorepo layout | Partial | Current full requirement not established. Source pointers: `apps/`, `services/`, `profiles/`, `evals/`, `deploy/`, `docs/`, `tools/`. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| L2 remove placeholders / per-service operational docs | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## Sections 14–17 and mission delivery

| Requirement | Status | Current evidence / gap |
|---|---|---|
| D14 Â§14 privacy,unified modalities,adaptive profiles,RAG,agents,signed bundles,public evals | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| R15 Â§15 scope gates/engine churn/hardware matrix/storage cost/latency/licensing/privacy/maintained libraries | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| F16a Â§16 days1–2 foundations | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| F16b Â§16 days3–5 chat/UI/SQLite | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| F16c Â§16 days6–7 egress/self-test | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| F16d Â§16 days8–9 structural ingest/hybrid | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| F16e Â§16 day10 30–50 real-document labels/baseline | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| U1 Amendment UI source/license/theme/provenance foundation | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| U2 UI chat/Stop/Knowledge/history/model/settings | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| U3 UI fidelity/axe/keyboard/contrast/full HTTP+WS egress | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D1 offline five-modality product plus LAN/encryption/resources | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D2 verified dist/installers/Compose/Tauri/signed bundle/checksums/SBOM | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D3 complete repo/in-app user/developer/API/security/ADR/notices/release docs | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D4 lint/tests/audit/coverage/unused code/red-team/soak/UI gates | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D5 coverage/support matrix/exact verification commands | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D6 clean-clone loopback+LAN acceptance,packet-ledger reconciliation,tags,handoff | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| U4 Public marketing website and documentation (owner amendment,ADR0064) | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| U3 UI fidelity/accessibility/all-screen egress supplement | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |
| D2 Shared frontend in packaged distributions supplement | Partial | Current full requirement not established. Historical detail retained in the verbatim archive;not current acceptance evidence. |

## UI slice verified scope

J2 auth/runtime review and J9 scoped status tested against real8769;3 clicks,
2 entries,1054.46ms,zero foreign requests. Full J2/J9 stay Partial. J11 hides
unbacked controls/purge;legacy HTTP safety fix still OPEN. J12 safe error
taxonomy unit tests and wrong-key recovery pass;full chaos remains OPEN.
Source174/Rust67/web80/13 real smoke stages PASS,audit0,38 denial probes.
No requirement upgraded to Implemented without a complete per-row current proof.

Hosted12afacc failed the unchanged website consistency test after the release
rewrite renamed its Support matrix heading. Restored the established heading
and explicit native Windows/macOS rows;no assertion removed or weakened.
Raw workflow-ui-hosted-web-failed.log. Local docs must be included in the final
web rerun;earlier web pass preceded the last docs rewrite.

Post-docs correction verified locally:source174,Rust67,web81,typecheck/build,
audit0,38 probes,13 real smoke stages PASS. Evidence:workflow-ui-postdocs-*.
Hosted12afacc completed FAILED (web status-matrix contract);all other4 jobs
passed. Follow-up SHA CI must complete before any green claim. No test skipped.

## J11/J12 safety evidence (ADR0075)

Current source174/Rust69/web81 PASS,typecheck/build,audit0,38 denial probes,
14 real smoke stages PASS. Raw workflow-purge-*. Contract:purge-v1 safety
migration (filename purge-v1-safety-migration.md),OpenAPI0.2.1. Runtime refusal
401/400/400/413/501 and populated metadata unchanged. No secure erasure/ledger
claim;J11 remains Partial. Prior correction cd68270 hosted39050933876/all5
completed success. New safety SHA CI follows push.

## J9/J11/J12 dashboard/profile alignment

ADR0076:source174,Rust70,web81,38 denial probes,15 real smoke stages PASS;
typecheck/build,audit0. workflow-dashboard-* raw evidence. Real1980.519ms,
13 clicks/4 entries,zero foreign requests;failed health/list recovery and
unique-profile CRUD. Source paths:ui/DashboardPage.tsx,ui/SettingsModal.tsx,
ingress.rs;tests modular-ui.test.mjs,ingress.rs,browser_dashboard_profiles.mjs.
Full J9/J11/J12 and broad plan requirements remain Partial. No ledger proof.
Base bcb1b67 hosted39051732254/all5 completed success;new SHA CI follows push.

## Main checkpoint (2026-10-17)

Verified code:f34af519d57e1e8585229ba92b7324cdc2de5fe6 on main. Full requested
baseline rerun:174 source,70 Rust,81 web/types/build,audit0,38 denial probes,
15 real smoke stages PASS. Raw workflow-main-*;main hosted39053461090 all5
completed success (workflow-main-implementation-hosted-ci.json). No full
journey promoted;no ledger/quality/storm/soak/release proof inferred. Earlier
per-slice numbers remain historical measurements. New checkpoint is docs-only;
its exact-SHA hosted CI follows push.

## Installation slice — ADR0077 (2026-10-17)

Scope remains PARTIAL: read-only installation preflight exists; no artifact is
advertised as runnable. Linux Ubuntu22 WSL doctor with explicit foundation
binary,port8770 returned0 and all22 real denial checks passed. Busy8769,
insufficient-space simulation,missing probe,root and native Windows returned78.
Evidence:`evals/results/install-check-{linux,busy,disk,missing,root,windows}.json`.
Tests:`apps/cli/tests/test_install_check.py` (8),full source182,Rust70/38 denial
probes,web81/typecheck/build/audit0. Raw `install-check-*` logs. Scope does not
verify an installed artifact,model provisioning,Windows host prerequisites,
Ubuntu24/Debian clean installs,signatures,upgrade,rollback or uninstall.

| Requirement | State | Evidence / next verification |
|---|---|---|
| Linux preflight containment/disk/port/platform | Partial | Real source-check execution above;packaged execution pending |
| Linux tar/deb/install/uninstall | Not done | Not built or installed;owner command will be documented after implementation |
| Dedicated WSL Windows installer | Not done | ADR0077 only;launcher and host preflight not implemented |
| Authenticode | UNVERIFIED | No signing certificate/build;never claim signed |
| Native macOS | Out of scope by decision | ADR0006;no native containment |
| Ubuntu24 AppArmor minimal fix | Partial | Restriction detection/message;installed executable policy and real24 test pending |

No journey status or phase/release gate is promoted. Exact-SHA hosted CI is
required after this slice is committed;local tests do not substitute for CI.

Preflight implementation:f8d15e097972095894b25bcffae4d6fb6b56b4a0;hosted
39055449581/all5 completed success. Evidence:install-check-hosted-ci.json.
No installed-artifact or full-journey status is promoted.

## Cozy direction slice1 (2026-10-17)

ADR0078,design/DIRECTIONS.md and design/CRITERIA.md specify three additive packs
without changing the default. design/USER_TEST.md is an UNVERIFIED owner study
protocol. Implementation,contrast/gallery matrix,screenshots/two critique
passes,accessibility/performance comparison and default recommendation remain
Not done. This is documentation only;no journey/phase/platform gate promoted.
Current session baseline182 source,70 Rust,81 web/typecheck/build,audit0,38 denial
probes and15 implemented-feature smoke stages PASS. Raw design-baseline-*.
Starting1df4286 hosted39055637580/all5 completed success. This slice's exact-SHA
hosted CI follows push. Install artifacts and all earlier open blockers remain.

Design contract775a918:hosted39056299835 all5 completed success;raw
design-docs-hosted-ci.json. No new theme implementation is claimed.
