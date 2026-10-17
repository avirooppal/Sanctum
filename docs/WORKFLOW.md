# Sanctum owner workflow

Version: 1.0.0. Authority: the owner's 2026-10-17 workflow-first directive,
[ADR0071](adr/0071-canonical-owner-journeys.md), plan.md, MISSION Amendment1,
WRAPUP, ADR0027. This is the normative user experience. It describes required
behavior; status explicitly separates that contract from the current product.
Changes require a version bump, ADR/REVIEW_QUEUE and corresponding journey tests.

## Current journey registry

No full journey is VERIFIED by historical UI tests. Fresh baseline evidence is
indexed in [WORKFLOW_GAPS](WORKFLOW_GAPS.md). A passing supported subflow is not
the completed journey, its quality benchmark, or ledger proof.

| ID | Status | Acceptance test ID | Main blocker |
|---|---|---|---|
| J1 | PENDING | journey:J1 | Signed installers/bundle verification absent |
| J2 | PARTIAL | journey:J2 | Real hardware onboarding/import progress missing |
| J3 | PARTIAL | journey:J3 | Journey budgets/chaos/ledger not established |
| J4 | PARTIAL | journey:J4 | Folder/progress/restart and quality gates incomplete |
| J5 | PARTIAL | journey:J5 | Full resident WebSocket voice/barge-in absent |
| J6 | PARTIAL | journey:J6 | Recording,diarization and speaker-note pipeline absent |
| J7 | PENDING | journey:J7 | Vision/OCR/indexing/evaluation absent |
| J8 | PENDING | journey:J8 | Governed agent runtime/policy/ledger absent |
| J9 | PARTIAL | journey:J9 | Startup self-test exists;Privacy Ledger absent |
| J10 | PENDING | journey:J10 | Prerequisite policy/ledger/broker absent |
| J11 | PARTIAL | journey:J11 | LAN/crypto/update/full-purge contracts incomplete |
| J12 | PARTIAL | journey:J12 | Unified recovery,diagnostics and chaos evidence absent |

## Shared interaction and data contract

One owner; no account creation/team questions. Detect what can be detected.
One primary action per screen, advanced choices disclosed only on request.
Tokens and drafts stay in memory; credentials never enter URLs or saved
preferences. Generated/retrieved/OCR/tool content is untrusted. Never silently
retry generation. An explicit Retry creates one new request and displays it.

Action budgets are fixed in ADR0071 before measuring; pointer activations and
navigation keys are counted separately from text-field entries. Report actual
typing separately; never infer physical keystrokes from fill(). Budgets do not
remove consent or destructive confirmations. Every journey test records version,
source SHA, hardware, start/end times, actions, result and evidence paths.

All long work displays real stage/bytes/counts when supplied by the backend;
otherwise display an indeterminate stage and elapsed time, not a fake percent.
Offer Cancel and an explicit restart/resume action with an idempotency identity.
Cancellation uses the common context and supervisor. Waiting state shows the
admitted lane; rejected work does not queue forever. Existing deadlines from
cancellation-v1,ingress,response-flow,realtime and engine ADRs remain unchanged.
Use existing UI feedback/performance budgets; no new operation deadline here.
Measure cold/warm latency separately. Existing install<5min and T1 EOS-to-first-
audio p95<800ms gates retain their definitions and remain unverified here.

Every step uses the failure catalogue below. Unexpected exceptions use E_UNKNOWN
without stack traces, raw server bodies or secrets. Show the recovery action and
a content-free trace ID. Corrupt writes must fail atomically. Display unknown
usage/context/profile/privacy when the backend cannot establish it.

Ledger event names below are the required future contract, NOT emitted evidence.
Record metadata, hashes, outcomes and policy decisions, not conversation,
document, audio or secret content. Until signed hash-chain verification and
packet reconciliation exist, say "Ledger unavailable" and never "nothing left
this machine" based only on /healthz. A feature requiring the ledger stays hidden.

## Failure catalogue (exact target messages)

All journeys include E_OFFLINE,E_AUTH,E_INVALID,E_CANCELLED,E_DEADLINE,
E_STORAGE and E_UNKNOWN in addition to their listed errors. Each step's relevant
failure must be exercised or remain a gap. These are target strings: existing
generic/raw errors are recorded as mismatches in WORKFLOW_GAPS.

| Code | Exact message | Recovery |
|---|---|---|
| E_OFFLINE | Sanctum is unavailable. Start the local runtime, then check again. | Check again; retain draft |
| E_AUTH | The local access key was not accepted. Check the runtime's token file and sign in again. | Re-enter key;never bypass |
| E_INVALID | This request could not be accepted. Review the highlighted fields. | Correct fields;no write |
| E_CANCELLED | Cancelled. No automatic retry will run. | Explicit restart;show saved/unsaved state |
| E_DEADLINE | This operation reached its time limit. Review its saved state before restarting. | Inspect state;explicit restart |
| E_STORAGE | Local storage is unavailable. Check disk space and permissions before retrying. | Storage check;preserve prior data |
| E_UNKNOWN | Sanctum could not finish this operation. Your request was not retried automatically. | Content-free diagnostics;explicit retry |
| E_SIGNATURE | Verification failed. This package has not been installed. | Obtain trusted pack;verify again |
| E_PLATFORM | This platform does not have a verified Sanctum package yet. | Read support matrix;use supported Linux/WSL path |
| E_SELFTEST | The startup privacy self-test failed. Sanctum has not started. | Diagnostics;fix confinement;never bypass |
| E_NOFIT | No verified model profile fits this hardware. Review the hardware report. | Smaller admitted profile/offline pack;no threshold reduction |
| E_ARTIFACT | Model verification failed. The existing model has not been replaced. | Re-import trusted artifact |
| E_BUSY | The local engine is busy. Wait for the displayed retry interval, then retry. | Show Retry-After when supplied;no replay |
| E_ENGINE | The local engine stopped. Your saved data is unchanged; the unfinished answer may not be saved. | Check engine status;explicit retry |
| E_UNSUPPORTED | This capability is not available on this runtime. | Return to supported action;hide unavailable controls |
| E_DOCUMENT | Choose a Markdown file or a text-based PDF up to 10 MiB. | Choose supported file |
| E_ABSTAIN | No supported answer found in the selected documents. | Add sources or refine question |
| E_MIC | Microphone access is unavailable. Allow access or choose an audio file. | Device consent or file input |
| E_AUDIO | Local audio could not be played. Check the output device, then press Read answer. | Explicit playback retry |
| E_SCOPE | This data is outside the selected workspace or tool scope. | Choose allowed local scope;no automatic broadening |
| E_APPROVAL | This action was not approved. No tool action was executed. | Review exact arguments;new approval required |
| E_BUDGET | The task reached its configured budget and stopped. | Inspect partial result;explicit new run |
| E_LEDGER | Privacy Ledger verification failed. Governed actions are blocked. | Preserve ledger;diagnose;never silently repair chain |
| E_LOCKED | Sanctum is locked. Unlock local storage to continue. | Unlock locally |
| E_KEY | The storage key was not accepted. Your data has not been changed. | Correct key or verified restore |
| E_SPACE | There is not enough local memory or disk space for this operation. | Free resources/select fitting profile |
| E_CORRUPT | Local data failed its integrity check. Preserve the files and restore a verified backup. | Read-only diagnostics;no destructive repair |
| E_CLOUD_AUTH | The cloud provider rejected its configured key. Disable the connector or correct the broker environment. | Restart broker with corrected environment;no key UI |
| E_CLOUD_CREDIT | The cloud provider requires credits. This request was not retried. | Choose local model explicitly |
| E_CLOUD_RATE | The cloud provider rate-limited this request. Wait for the displayed retry interval before retrying. | Show supplied Retry-After;no replay |
| E_CLOUD_DOWN | The cloud provider is unavailable. This request was not retried. | Explicit retry or explicit local choice |
| E_CLOUD_POLICY | Policy does not permit this content to leave the device. | Keep conversation local |

## J1 — Install and verify

Trigger: owner obtains a package. Preconditions: trusted signing fingerprint,
supported OS, writable empty destination; use offline artifacts for zero egress.
Budget:6 clicks,16 navigation keys,3 text entries. Test: journey:J1. Status:PENDING.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J1.1 | 1. Verify package checksum and signature. | Packaging/CLI verify contract,not yet implemented | Verification metadata only |
| J1.2 | 2. Install to the chosen supported destination. | Installer verifies manifest/dependencies atomically | Binaries,profiles,notices |
| J1.3 | 3. Start Sanctum. | Gateway verifies artifacts and kernel-denial startup probes;failed self-test prevents ready | Owner token,local state |
| J1.4 | 4. Read the startup result and open the local address. | /healthz reports scope of checks;UI never infers ledger proof | No document/conversation data |

Success: verified installation and live scoped self-test. Failures: shared plus
E_SIGNATURE,E_PLATFORM,E_SELFTEST,E_ARTIFACT. Progress: real verification stages;
clean install→answer timing includes J2 and retains<5min gate. Privacy:no outbound
traffic for offline install;no telemetry. Required ledger:install.verified,
runtime.started,selftest.result;ledger currently absent,not a claimed chain.

## J2 — First run

Trigger:first authenticated workspace. Preconditions:J1,local key available.
Budget:7 clicks,16 navigation keys,3 text entries. Test:journey:J2. Status:PARTIAL.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J2.1 | 1. Open setup and read detected tier/profile. | Doctor plus authenticated capability/model metadata;unknown if not supplied | None |
| J2.2 | 2. Consent to a fitting local model or import an offline pack. | Hash-verified provisioner with real progress,cancel,resume;product API pending | Atomic model files,checkpoint metadata |
| J2.3 | 3. Enter the local key;optionally choose a Knowledge folder. | Authenticate via /v1/models;folder registration only when backed | Key in memory;optional local folder registration |
| J2.4 | 4. Ask a question with the detected model. | POST /v1/chat/completions streams once;SQLite stores completed turn | Local conversation and actual usage |

Success:first local answer without a mandatory model/profile decision. Failures:
shared plus E_NOFIT,E_ARTIFACT,E_SELFTEST,E_SPACE,E_BUSY,E_ENGINE. Progress:actual
artifact bytes and indexing counts or indeterminate stage;no timer verification.
Privacy:offline import/inference has no egress. Product download branch stays
hidden pending audited provisioning;explicit developer downloads disclose IP/
artifact identity,never described as zero-egress. Ledger:model.import,auth.result,
model.request,model.result;currently pending. Setup must not fabricate a key.

## J3 — Ask locally

Trigger:new/resumed chat. Preconditions:authenticated owner,ready local model.
Budget:8 clicks,16 navigation keys,3 text entries. Test:journey:J3. Status:PARTIAL.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J3.1 | 1. Start or select a conversation;optionally select a model. | /v1/sessions,/v1/models;license/fit/unknown estimate shown | Session metadata only |
| J3.2 | 2. Type and send one question. | One OpenAI-compatible streaming request;policy checks local model | Completed local turns/real usage |
| J3.3 | 3. Press Stop if needed;Retry only by explicit action. | Abort→common cancellation→engine supervisor;no silent replay | Partial persistence explicitly identified |
| J3.4 | 4. Search,rename or reopen saved history. | Owner-filtered /v1/sessions and /v1/conversations/{id} | Transactional metadata mutations |

Success:local answer or explicit cancellation;history reflects actual saved state.
Failures:shared plus E_BUSY,E_ENGINE,E_SPACE,E_SCOPE. Progress:streamed tokens and
real usage,otherwise unknown;elapsed/TTFT recorded without invented throughput.
Privacy:no egress,no automatic cloud switch. Ledger:model.request/result/cancel,
session.changed;currently pending. Stop browser latency is not engine-slot release.

## J4 — Ask my documents

Trigger:owner opens Knowledge. Preconditions:Knowledge capability and local model.
Budget:9 clicks,20 navigation keys,4 text entries. Test:journey:J4. Status:PARTIAL.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J4.1 | 1. Create/select a personal workspace. | /v1/workspaces;restricted owner scope by default | Workspace metadata |
| J4.2 | 2. Add files or optionally register a folder;watch indexing progress. | /v1/workspaces/{id}/documents;parser→chunks→embeddings;folder/progress API pending | Content hashes,chunks,index,ACLs atomically |
| J4.3 | 3. Ask a question and inspect cited passages/pages. | /v1/workspaces/{id}/ask;ACL prefilter,hybrid/rerank,grounding | Local request/result metadata |
| J4.4 | 4. Refine the question/add sources after abstention,or cancel/restart indexing. | No unsupported answer;idempotent job checkpoint/recovery required | Explicit job state,no duplicate versions |

Success:cited supported answer or E_ABSTAIN. Failures:shared plus E_DOCUMENT,
E_SCOPE,E_SPACE,E_BUSY,E_ENGINE,E_ABSTAIN. Progress:actual file/chunk/job stages;
current synchronous upload has no resumable-job claim. Privacy:no remote parser/
embeddings;retrieved instructions remain untrusted. Ledger:document.ingest,
retrieval.request/result,model.request/result;currently pending.

## J5 — Voice

Trigger:dictation,voice conversation or Read answer. Preconditions:configured
speech engines;device permission only after owner click. Budget:8 clicks,16 keys,
2 text entries. Test:journey:J5. Status:PARTIAL;live subflow PENDING and hidden.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J5.1 | 1. Dictate or choose a supported audio file;review transcript. | Local capture→/v1/audio/transcriptions;cancel supported | Transcript draft in memory |
| J5.2 | 2. Start live conversation only when advertised. | Single-use WS ticket→authenticated /v1/realtime;resident ASR→LLM→streaming TTS pending | Reviewed/spoken local turns |
| J5.3 | 3. Interrupt by speaking or press Stop. | Barge-in cancels LLM/TTS,flushes playback,acks played content;pending | History truncated to acknowledged speech |
| J5.4 | 4. Read an answer aloud,or stop audio and return to chat. | /v1/audio/speech;blob playback with explicit stop | No recording saved without consent |

Success:reviewable dictation or real duplex voice or local read-aloud as selected.
Failures:shared plus E_MIC,E_AUDIO,E_UNSUPPORTED,E_BUSY,E_ENGINE,E_SPACE. Progress:
recording/transcribing/playing;real captions only. Report T0 warm/cold latency;
T1<800ms p95 unchanged and unverified. Privacy:audio stays local. Ledger:
speech.request/result/cancel,voice.playback_ack;currently pending.

## J6 — Meetings

Trigger:owner chooses meeting capture/import. Preconditions:meeting capability,
local engines and Knowledge. Budget:10 clicks,24 keys,4 text entries.
Test:journey:J6. Status:PARTIAL;diarized-meeting subflow PENDING and hidden.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J6.1 | 1. Record with explicit consent or choose an audio file. | Local capture/upload pipeline;full meeting ingestion pending | Private local audio only when requested |
| J6.2 | 2. Review transcript and speaker labels;edit speaker names. | Licensed diarizer with measured DER;not implemented | Reviewed transcript and speaker map |
| J6.3 | 3. Review summary and verbatim-quote action items. | Local summarizer identifies supporting timestamps/passages | Draft notes,never remote content |
| J6.4 | 4. Choose Knowledge workspace and save reviewed notes. | Existing reviewed-transcript flow;complete speaker pipeline pending | Restricted local Knowledge document |

Success:reviewed speaker-labelled notes and source-linked action items in Knowledge.
Failures:shared plus E_MIC,E_AUDIO,E_SCOPE,E_DOCUMENT,E_SPACE,E_UNSUPPORTED.
Progress:real duration/transcription/diarization stages,cancel and explicit restart.
Privacy:meetings never sent to J10;private restricted default. Ledger:meeting.capture,
meeting.reviewed,document.ingest;currently pending. Pasted notes are not diarization.

## J7 — Images and scanned documents

Trigger:image question or scanned-document upload. Preconditions:verified vision
capability/profile. Budget:7 clicks,16 keys,2 entries. Test:journey:J7. Status:PENDING.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J7.1 | 1. Choose a local image/scan. | Size/decompression limits,EXIF stripping,capability check;pending | Sanitized local artifact |
| J7.2 | 2. Ask an image question or choose document indexing. | Router VLM/OCR interface;pending | Local OCR/table/figure data |
| J7.3 | 3. Inspect answer and page-region citations/thumbnails. | Visual/text retrieval and groundedness;pending | Local answer/citation metadata |
| J7.4 | 4. Correct scope/add sources or cancel. | Same cancellation context;abstain on missing evidence | Idempotent job state |

Success:grounded visual answer or explicit abstention. Failures:shared plus
E_DOCUMENT,E_SCOPE,E_SPACE,E_UNSUPPORTED,E_ABSTAIN,E_ENGINE. Progress:real OCR/page
stages;optional visual retriever remains off without measured lift. Privacy:no
remote images/OCR;image text untrusted and prohibited from cloud. Ledger:
vision.request/result,document.ingest,retrieval.result;currently absent.

## J8 — Agent task

Trigger:owner chooses a tool-backed task. Preconditions:policy,ledger,sandbox,
MCP and approved pinned manifests. Budget:9 clicks,20 keys,3 entries.
Test:journey:J8. Status:PENDING;all agent controls hidden.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J8.1 | 1. Choose task,workspace and allowed tools. | MCP registry validates manifests/hash/scopes;planned agents API | Pinned run configuration |
| J8.2 | 2. Start with visible budgets and sandbox tier. | Policy/taint checks every model,retrieval,tool,egress;pending | Local run/step metadata |
| J8.3 | 3. Approve exact arguments after preview,or deny. | Argument/hash-bound approval,timeout-deny,replay rejection | Approval decision hash only |
| J8.4 | 4. Inspect result or stop the run. | Hard step/token/time/CPU/memory/disk budgets;whole-tree cancellation | Result plus verifiable ledger metadata |

Success:allowed result or clean budget/denial stop,no unauthorized side effects.
Failures:shared plus E_SCOPE,E_APPROVAL,E_BUDGET,E_LEDGER,E_ENGINE,E_UNSUPPORTED.
Progress:real queued/running/tool/approval events. Privacy:sandbox egress denied;
untrusted content cannot grant authority;tool output never goes to J10. Ledger:
agent.run,policy.decision,tool.manifest,approval.decision,tool.result,run.stop;
currently absent. Zero critical bypass gate remains mandatory.

## J9 — Verify privacy

Trigger:owner inspects status or audits a run. Preconditions:runtime available;
ledger actions require ledger capability. Budget:5 clicks,12 keys,0 entries.
Test:journey:J9. Status:PARTIAL;ledger subflow PENDING and hidden.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J9.1 | 1. Open status and inspect live self-test scope. | /healthz verifies current confinement response;not packet history | No content |
| J9.2 | 2. Open What left this machine when ledger is available. | Planned /v1/ledger metadata view,policy and broker reconciliation | Read-only audit |
| J9.3 | 3. Run ledger verification. | Planned sanctum ledger verify;detect modifications,deletion,reordering,truncation | Verification result/checkpoint |
| J9.4 | 4. Export metadata or investigate a discrepancy. | Signed checkpoints/export;block governed actions after failure | Owner-selected local metadata export |

Success:verified ledger and reconciled monitoring,or truthful unavailable/failed
state. Failures:shared plus E_LEDGER,E_CORRUPT,E_UNSUPPORTED. Progress:verification
counts,not unconditional green badges. Privacy:no outbound;metadata/hash-only
default. Ledger:ledger.verify,ledger.export;currently absent. Kernel-denial probes
alone cannot prove zero historical outbound bytes.

## J10 — Use a cloud model (optional)

Trigger:explicit owner opt-in. Preconditions:Phase5 policy/ledger,confined broker,
verified model metadata/terms and broker environment key. Budget:8 clicks,20 keys,
1 text entry (prompt only). Test:journey:J10. Status:PENDING;connector does not run.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J10.1 | 1. Read verified provider/retention terms and explicitly enable. | Future broker alone reads OPENROUTER_API_KEY at start;no key UI | Owner consent metadata only |
| J10.2 | 2. Select cloud for this conversation and confirm disclosure. | Policy rejects restricted/confidential,meetings,images,tool outputs;RAG only from cloud-allowed workspace | Per-conversation consent;Cloud badges in tab/status/picker |
| J10.3 | 3. Send one prompt and inspect result/usage. | Broker TLS POST openrouter.ai:443,OpenAI-compatible SSE,no redirects/fallback | Host/model/byte/token/outcome/policy metadata,not content |
| J10.4 | 4. Switch back to local in one action or use connector kill switch. | Cancel in-flight work via common context;disable broker;planned CLI disable | Revocation and cancellation metadata |

Success:one consented policy-allowed request,or a denied request with no egress.
Failures:shared plus E_CLOUD_AUTH,E_CLOUD_CREDIT,E_CLOUD_RATE,E_CLOUD_DOWN,
E_CLOUD_POLICY,E_LEDGER,E_UNSUPPORTED. Timeouts/retries friendly,Retry-After shown;
no automatic generation replay or automatic local/cloud switching. Privacy:only
this journey can send user content beyond the owner's device/private network;
warning precedes enable and per-conversation consent. Free endpoints may retain
or train on content:show verified policy,never promise provider privacy. Ledger:
connector.enabled/disabled,cloud.request/result,policy.decision;required before
exposure. Owner-requested model is unverified until registry admission. CI uses
loopback fake only;live checks require owner's environment and never record keys.

## J11 — Manage

Trigger:owner opens management. Preconditions:auth;each action requires its own
capability and supported backend. Budget:24 clicks,48 keys,8 entries for the
documented management sweep. Test:journey:J11. Status:PARTIAL.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J11.1 | 1. Change theme/layout or assistant profile. | /v1/preferences,/v1/profiles;validated data-only settings | Local SQLite preferences/profiles |
| J11.2 | 2. Inspect resource use and set supported limits. | Health dispatch;resource/lifecycle API pending | Validated owner caps only |
| J11.3 | 3. Enable private LAN only after TLS/fingerprint/Host/Origin checks. | Owner-only TLS listener/lockout/ledger;pending | TLS config,owner allowlist |
| J11.4 | 4. Lock/unlock,rotate key,or back up/restore. | Vetted encryption,wrong-key/tamper checks;pending | Encrypted atomic data/backup |
| J11.5 | 5. Verify and apply an update with recovery information. | Offline signature/SBOM/hash verification;pending | Verified staged package;no silent downloads |
| J11.6 | 6. Export or purge the selected supported data scope after confirmation. | Existing conversation export;full purge must cover Knowledge/in-flight jobs or remain hidden | Export file or explicitly scoped transactional deletion |

Success:persisted confirmed settings and only the selected verified management
operation. Failures:shared plus E_LOCKED,E_KEY,E_CORRUPT,E_SIGNATURE,E_SELFTEST,
E_SPACE,E_SCOPE,E_UNSUPPORTED. Progress:real key/backup/update stages;restartable
without data loss. Privacy:no telemetry,remote fonts or mDNS by default;LAN keeps
one owner;backups local. Ledger:preferences.changed,profile.changed,lan.connection,
storage.lock/key_rotated/backup,data.purge,update.verified;currently incomplete.
Deletion never promises erasure of external backups or physical disk sectors.

## J12 — Recover

Trigger:busy/down/resource/crash/cancellation/integrity error. Preconditions:
preserve original files;no permission to erase owner data. Budget:8 clicks,
20 keys,2 entries per recovery variant. Test:journey:J12. Status:PARTIAL.

| Step | Numbered user action | System/component/API | Data written |
|---|---|---|---|
| J12.1 | 1. Read what happened and the permitted next action. | Error taxonomy,health and bounded lane/Retry-After;never raw stack | Content-free diagnostic metadata |
| J12.2 | 2. Cancel waiting work or explicitly restart a failed engine request. | Common cancellation/supervisor,reap descendants,restart health before ready | Prior saved turns retained;no auto generation replay |
| J12.3 | 3. Free memory/disk or restore a verified backup after corruption. | Admission/storage guards and crash-safe checkpoints;partial | Atomic recovery state;never silently overwrite damaged originals |
| J12.4 | 4. Inspect recovery result or export sanitised diagnostics. | Required sanctum doctor --bundle excludes conversations,documents,audio and secrets;not implemented | Local content-free bundle only |

Success:known recoverable state with no lost committed data,or explicit safe stop.
Failures:all catalogue entries,especially E_BUSY,E_ENGINE,E_SPACE,E_CORRUPT.
Progress:real queued/cancelled/restarting/checking state,existing bounded-release
times remain fixed. Privacy:diagnostics stay local until owner shares them;no
cloud fallback. Ledger:request.failed/cancelled,engine.restarted,recovery.result;
currently pending. Chaos variants must include engine kill,overload,download
cancel/resume,low RAM/disk,gateway kill during ingest and cloud429/timeout.

## Exposure and verification rules

Current safe subflows may stay visible with precise names:file dictation and
read-aloud are not live voice;reviewed transcript capture is not diarization.
Pending agent/vision/cloud/ledger/LAN/crypto/update controls must be absent and
rejected when directly requested. Unknown capability responses fail closed.
No simulated model provisioning,token bypass or invented hardware is allowed.
WORKFLOW_GAPS inventories all product controls against a journey;orphan developer
galleries stay out of the product entry point. No release/phase tag follows from
writing this specification. Each acceptance runner must preserve failures and
report partial/pending without laundering negative checks into VERIFIED status.

## Current implementation evidence: UI alignment

ADR0074 replaces simulated first-run provisioning with configured-runtime review.
J2 remains PARTIAL:installer,detected hardware recommendation and import jobs are
absent. Real subflow evidence:evals/results/workflow-ui-onboarding.json;3 clicks,
2 text entries including a wrong-key attempt,1486.96ms,zero foreign requests.
J9 displays current startup denial checks only;the ledger remains unavailable.
Full journey budgets,chaos and ledger acceptance are not established.

## J11 safety availability

ADR0075 disables the legacy full-purge HTTP mutation. Valid owner confirmation
returns501 without deleting state;full_purge remains absent. This corrects
availability while J11 stays PARTIAL. Real probe requires disabled-v1 marker
and preserves populated metadata;not full erasure or ledger acceptance.
