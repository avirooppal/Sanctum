# Workflow gap audit v1.0.0

Current date:2026-10-17;base bcb1b67e1ffea0642ad6539d03adaf479d290cff
plus ADR0076 slice. Previous file retained verbatim at
[archive](status-archive/2026-10-17-workflow-gaps-before-dashboard.md),SHA256
`528effc7406198b0fc00da182a8fde4ff0a9c9ee3a3bab5c9b496062b6ce16a8`. Required journeys are not full VERIFIED from supporting checks.

## Current evidence

C1:run_source_gate.sh174 tests PASS;C2:check_rust.sh70 tests,38 denial probes
PASS;C3:web81,typecheck/build PASS,audit0. Raw workflow-dashboard-*.
C4:15 real smoke stages PASS,SDK/chat,RAG/citations,file ASR/TTS,tickets and
UI;release_complete=false. Full budgets/chaos/ledger/WER/DER/visual QA absent.
C5:base bcb1b67 hosted39051732254 completed success,all5 jobs;new SHA pending.
C6:real dashboard/profile subflow1980.519ms,13 clicks,4 text entries,zero
foreign HTTP/WS requests/page errors. Aborted health clears success;aborted
profile list shows error/Unknown,not false empty. Explicit reopening recovers;
unique fixture create/edit/delete passes. Counts cover this combined subflow,
not full journey budgets. Older supported subflow checks rerun in C4.

## Every canonical step

| Step | Exists? | Current evidence | Action |
|---|---|---|---|
| J1.1 | No signed release verification | SOURCE:tools/build_dev_bundle.py explicitly unsigned | build |
| J1.2 | No verified installer | SOURCE:apps/desktop/README.md;R-PACKAGES remains OPEN | build |
| J1.3 | Partial runtime startup | C2,C4;services/gateway/src/runtime_main.rs | keep |
| J1.4 | Partial truthful status | UI alignment:complete eight-check predicate;unknown on failure;ledger explicitly unavailable | fix |
| J2.1 | Runtime-backed review;hardware Unknown | workflow-ui-onboarding.json real auth/review;doctor recommendation API still absent | build |
| J2.2 | CLI import/hash;no product jobs | CLI import/hash only;fake UI provisioning removed per ADR0074 | hide until backend |
| J2.3 | Real auth/review;optional folder not built | workflow-ui-onboarding.json rejects wrong key,uses configured model;inert folder/fallback key removed | build |
| J2.4 | Local answer works | C4 SDK8 and real browser answer;budget/install timing absent | keep |
| J3.1 | Picker/history partial | C4 model API/history;fit/speed Unknown;full version/usage coverage pending;no journey count | fix |
| J3.2 | Streaming works | C4 real SDK/browser;full declarative policy/ledger absent | keep |
| J3.3 | Restored Stop works | C4 request_aborted,no_automatic_retry,explicit_next_send_succeeds;not engine-slot timing | keep |
| J3.4 | History works | C4 sessions15 checks:search/rename/restore/delete/inert HTML;full journey budget absent | keep |
| J4.1 | Workspace works | C4 Knowledge create/select,owner isolation | keep |
| J4.2 | Upload works;folder/jobs incomplete | C4 Markdown indexed;SOURCE:KnowledgePanel.tsx synchronous upload,no progress API | build |
| J4.3 | Cited answer works;benchmark gap | C4 amber-lighthouse citation;R-RAG ablation/page highlights still OPEN | fix |
| J4.4 | Abstention/cancel UI present;full restart evidence pending | C4 abstention;UI Cancel now aborts and retains inputs;real cancel/restart evidence still pending | fix |
| J5.1 | File/emulated capture partial | C4 actual WAV→draft;physical mic evidence absent | fix |
| J5.2 | Transport only | SOURCE:realtime.rs advertises speech_pipeline=false;no resident duplex path | hide until backend |
| J5.3 | No true barge-in | SOURCE:file Stop audio only,not LLM+playback-ack integration | hide until backend |
| J5.4 | Read-aloud works | C4 real TTS/browser playback/stop;not physical speaker verification | keep |
| J6.1 | No meeting recorder/import job | SOURCE:MeetingPanel.tsx accepts reviewed transcript text | hide until backend |
| J6.2 | No diarization/speaker map | SOURCE:speech adapters lack evaluated diarizer | hide until backend |
| J6.3 | Reviewed-text helper only | SOURCE:meeting.ts;no DER/evidence-linked full meeting pipeline | fix |
| J6.4 | Reviewed notes save source-only | SOURCE:MeetingPanel.tsx and meetings route;not exercised by C4 smoke and not a speaker-labelled pipeline | fix |
| J7.1 | No image ingress | SOURCE:chat attachment is Knowledge document upload only | hide until backend |
| J7.2 | No VLM/OCR pipeline | SOURCE:vision-docs service has no runnable adapter | hide until backend |
| J7.3 | No region visual QA | R-VISION OPEN;no fresh benchmark | hide until backend |
| J7.4 | No visual jobs | SOURCE:capabilities endpoint omits vision | hide until backend |
| J8.1 | No governed MCP registry | SOURCE:capabilities omits agents/tools | hide until backend |
| J8.2 | No governed agent runtime | R-AGENTS OPEN;no fresh red-team execution | hide until backend |
| J8.3 | No exact-argument approvals | SOURCE:PanelRegistry only allows registration,not approval backend | hide until backend |
| J8.4 | No agent budgets/result chain | R-AGENTS OPEN;kernel confinement alone insufficient | hide until backend |
| J9.1 | Scoped current status;ledger absent | C6 real health-abort clears success;no historical egress proof | fix |
| J9.2 | No Privacy Ledger view | SOURCE:gateway has no ledger route | hide until backend |
| J9.3 | No ledger verify command | SOURCE:CLI only doctor/pull/estimate | hide until backend |
| J9.4 | No signed ledger export | R-PRIVACY OPEN;no packet reconciliation evidence | hide until backend |
| J10.1 | No connector/policy prerequisite | SOURCE:capabilities excludes cloud;key must never enter UI/config | hide until backend |
| J10.2 | No cloud consent/model registry | Owner model candidate not yet verified;no approved data-policy record | hide until backend |
| J10.3 | No confined broker/adapter | No live call permitted yet;loopback fake tests must precede implementation | hide until backend |
| J10.4 | No kill switch/connector CLI | SOURCE:CLI command inventory | hide until backend |
| J11.1 | Preferences and saved definitions partial | C3 safe errors;C6 real profile create/update/delete and failed-load recovery;not automatic chat application | fix |
| J11.2 | Read-only queues only | C4 dashboard actual dispatch;no resource-limit write API | hide until backend |
| J11.3 | No owner TLS LAN | R-LAN OPEN;loopback confinement is not LAN support | hide until backend |
| J11.4 | No encryption/backup | R-CRYPTO OPEN;no canary/rotation/restore evidence | hide until backend |
| J11.5 | No verified update | R-PACKAGES OPEN;no signature/update rollback evidence | hide until backend |
| J11.6 | Purge hidden;legacy mutation disabled | workflow-purge-live.json and14-stage smoke:401/400/413/501,populated metadata unchanged;full erasure backend absent | hide until backend |
| J12.1 | Selected safe errors;taxonomy coverage partial | C3 runtime-truth tests;C6 wrong-key/health/profile-load errors;all operation-specific recovery not established | fix |
| J12.2 | Supervision/cancel partial | C2 process-tree tests;C4 browser Stop;resident real-engine storms pending | build |
| J12.3 | Incomplete resource/crash recovery | C1 profile fixtures;no fresh low-disk/gateway-kill-indexing runner | build |
| J12.4 | No doctor --bundle | SOURCE:CLI argument inventory;no diagnostic-content scan | build |

## Product-control inventory and orphan handling

| Surface/control | Journey | Required disposition |
|---|---|---|
| Owner login,new chat,tabs,history,copy/retry/Stop,model picker | J2,J3,J12 | Keep real behavior;test Retry/usage/save semantics |
| Knowledge dialog,document attachment,source rail,local artifacts | J4 | Keep supported formats;cancel/progress and citation coverage gaps |
| File dictation/Read answer/Stop audio | J5 | Keep precisely named supported subflow;no live-voice promise |
| Reviewed transcript capture | J6 | Keep precise text-only scope;hide speaker/recording promises |
| Dashboard status/models/sessions/queues/config/licenses/docs | J1,J3,J9,J11,J12 | Read-only facts,unknown on failed checks,no invented zero metrics |
| Themes/layouts/shortcuts/palette/profiles,preferences import/export | J11 | Keep validated data-only controls;remove inert options |
| Full Purge | J11.6 | Hide until full documented scope/cancellation/storage tests pass |
| Setup provisioning/folder/auto-token bypass | J2 | Remove simulations;replace with actual status/explicit unavailable |
| ?gallery=1 developer samples | None in owner workflow | Remove from production entry;retain isolated developer tests if useful |
| Pending vision/agents/ledger/cloud/LAN/crypto/update controls | J5–J11 | Capability-denied and absent until backend plus journey test pass |


## Next work

Complete J1-J4/J12 actual provisioning,progress/restart,diagnostics and chaos
proof;continue later backend journeys in WRAPUP order. Missing full voice,
vision,agents/ledger,cloud,LAN,crypto/packages remain blocked/hidden. Do not
start cloud before policy/ledger. All full journey statuses remain unchanged.

## Main checkpoint (2026-10-17)

Verified code:f34af519d57e1e8585229ba92b7324cdc2de5fe6 on main. Full requested
baseline rerun:174 source,70 Rust,81 web/types/build,audit0,38 denial probes,
15 real smoke stages PASS. Raw workflow-main-*;main hosted39053461090 all5
completed success (workflow-main-implementation-hosted-ci.json). No full
journey promoted;no ledger/quality/storm/soak/release proof inferred. Earlier
per-slice numbers remain historical measurements. New checkpoint is docs-only;
its exact-SHA hosted CI follows push.
