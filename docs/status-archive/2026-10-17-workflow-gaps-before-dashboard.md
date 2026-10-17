# Workflow gap audit v1.0.0

Audit:2026-10-17; base6339d359e041d7d21b949b2d1b9ee77e7564b963 plus
ADR0070 baseline repairs. Authority:[WORKFLOW](WORKFLOW.md),[ADR0071](adr/0071-canonical-owner-journeys.md).
No complete journey or click budget has been measured yet. Source-only entries
below establish presence/absence,not runtime correctness. Pending test IDs in
WORKFLOW are acceptance contracts,not a claim that runners already exist.

## Fresh baseline evidence

- B1:`bash tools/run_source_gate.sh evals/results/workflow-baseline-source.log`:
  157 tests,Ruff/format/types/license/profile/API gates PASS.
- B2:`bash tools/check_rust.sh`:initial voice_priority test FAIL;unchanged full
  rerun PASS67 tests,38 denial/startup probes,92 crate licenses. Supervision
  term0.56731755s,parent-death0.535976329s,natural0.566351028s;zero survivors.
  Raw:workflow-baseline-rust-failed.log and workflow-baseline-rust-retry.log.
- B3:`npm test/run typecheck/run build --prefix apps/web`;audit at low:
  71 web+2 font tests PASS,typecheck/build PASS,0 advisories. Repair web checks
  pass again;raw workflow-baseline-web.log and workflow-repair-web.log.
- B4:`bash tools/smoke_all.sh`:11 implemented-feature stages PASS after baseline
  repairs;release_complete=false. Real SDK chat,cited RAG,file ASR/TTS,tickets,
  speech browser,Knowledge,Stop,history,website and geometry/egress checks.
  Raw workflow-baseline-final-smoke.log and workflow-baseline-final-*.json/log.
- B5:parent6339d35 hosted run38293273975 completed success;all5 jobs completed
  success observed via API. workflow-baseline-hosted-ci.json. New SHA CI is
  recorded separately after push;parent CI is not inferred for edited code.

All raw paths above are under evals/results/. Baseline failures remain named:
missing Windows Python path,uv/Linux .venv conflict,theme expectation,missing
speech panel,bundled-doc link scope,ambiguous Model/Knowledge locators. No
threshold/deadline is relaxed. Host dependencies were recovered in an ignored
separate Windows venv;the owner Linux environment was not deleted.

## Every workflow step

Exists means the documented step,not a similarly named control. Action is one
of keep/fix/build/hide until backend/remove. B1–B5 do not close quality,
ledger,packet capture,chaos or full-journey gates they did not exercise.

| Step | Exists? | Current evidence | Action |
|---|---|---|---|
| J1.1 | No signed release verification | SOURCE:tools/build_dev_bundle.py explicitly unsigned | build |
| J1.2 | No verified installer | SOURCE:apps/desktop/README.md;R-PACKAGES remains OPEN | build |
| J1.3 | Partial runtime startup | B2,B4;services/gateway/src/runtime_main.rs | keep |
| J1.4 | Partial truthful status | UI alignment:complete eight-check predicate;unknown on failure;ledger explicitly unavailable | fix |
| J2.1 | Runtime-backed review;hardware Unknown | workflow-ui-onboarding.json real auth/review;doctor recommendation API still absent | build |
| J2.2 | CLI import/hash;no product jobs | CLI import/hash only;fake UI provisioning removed per ADR0074 | hide until backend |
| J2.3 | Real auth/review;optional folder not built | workflow-ui-onboarding.json rejects wrong key,uses configured model;inert folder/fallback key removed | build |
| J2.4 | Local answer works | B4 SDK8 and real browser answer;budget/install timing absent | keep |
| J3.1 | Picker/history partial | B4 model API/history;fit/usage derive inconsistently;no journey count | fix |
| J3.2 | Streaming works | B4 real SDK/browser;full declarative policy/ledger absent | keep |
| J3.3 | Restored Stop works | B4 request_aborted,no_automatic_retry,explicit_next_send_succeeds;not engine-slot timing | keep |
| J3.4 | History works | B4 sessions15 checks:search/rename/restore/delete/inert HTML;full journey budget absent | keep |
| J4.1 | Workspace works | B4 Knowledge create/select,owner isolation | keep |
| J4.2 | Upload works;folder/jobs incomplete | B4 Markdown indexed;SOURCE:KnowledgePanel.tsx synchronous upload,no progress API | build |
| J4.3 | Cited answer works;benchmark gap | B4 amber-lighthouse citation;R-RAG ablation/page highlights still OPEN | fix |
| J4.4 | Abstention works;cancel UI missing | B4 abstention;UI Cancel now aborts and retains inputs;real cancel/restart evidence still pending | fix |
| J5.1 | File/emulated capture partial | B4 actual WAV→draft;physical mic evidence absent | fix |
| J5.2 | Transport only | SOURCE:realtime.rs advertises speech_pipeline=false;no resident duplex path | hide until backend |
| J5.3 | No true barge-in | SOURCE:file Stop audio only,not LLM+playback-ack integration | hide until backend |
| J5.4 | Read-aloud works | B4 real TTS/browser playback/stop;not physical speaker verification | keep |
| J6.1 | No meeting recorder/import job | SOURCE:MeetingPanel.tsx accepts reviewed transcript text | hide until backend |
| J6.2 | No diarization/speaker map | SOURCE:speech adapters lack evaluated diarizer | hide until backend |
| J6.3 | Reviewed-text helper only | SOURCE:meeting.ts;no DER/evidence-linked full meeting pipeline | fix |
| J6.4 | Reviewed notes save source-only | SOURCE:MeetingPanel.tsx and meetings route;not exercised by B4 smoke and not a speaker-labelled pipeline | fix |
| J7.1 | No image ingress | SOURCE:chat attachment is Knowledge document upload only | hide until backend |
| J7.2 | No VLM/OCR pipeline | SOURCE:vision-docs service has no runnable adapter | hide until backend |
| J7.3 | No region visual QA | R-VISION OPEN;no fresh benchmark | hide until backend |
| J7.4 | No visual jobs | SOURCE:capabilities endpoint omits vision | hide until backend |
| J8.1 | No governed MCP registry | SOURCE:capabilities omits agents/tools | hide until backend |
| J8.2 | No governed agent runtime | R-AGENTS OPEN;no fresh red-team execution | hide until backend |
| J8.3 | No exact-argument approvals | SOURCE:PanelRegistry only allows registration,not approval backend | hide until backend |
| J8.4 | No agent budgets/result chain | R-AGENTS OPEN;kernel confinement alone insufficient | hide until backend |
| J9.1 | StatusBar scoped;dashboard still needs alignment | workflow-ui-onboarding.json proves current eight-check badge;SOURCE:DashboardPage still contains unconditional denial/self-test copy | fix |
| J9.2 | No Privacy Ledger view | SOURCE:gateway has no ledger route | hide until backend |
| J9.3 | No ledger verify command | SOURCE:CLI only doctor/pull/estimate | hide until backend |
| J9.4 | No signed ledger export | R-PRIVACY OPEN;no packet reconciliation evidence | hide until backend |
| J10.1 | No connector/policy prerequisite | SOURCE:capabilities excludes cloud;key must never enter UI/config | hide until backend |
| J10.2 | No cloud consent/model registry | Owner model candidate not yet verified;no approved data-policy record | hide until backend |
| J10.3 | No confined broker/adapter | No live call permitted yet;loopback fake tests must precede implementation | hide until backend |
| J10.4 | No kill switch/connector CLI | SOURCE:CLI command inventory | hide until backend |
| J11.1 | Preferences/profiles partial | B3 unit contracts;SOURCE:main.tsx silently swallows save/capability failures | fix |
| J11.2 | Read-only queues only | B4 dashboard actual dispatch;no resource-limit write API | hide until backend |
| J11.3 | No owner TLS LAN | R-LAN OPEN;loopback confinement is not LAN support | hide until backend |
| J11.4 | No encryption/backup | R-CRYPTO OPEN;no canary/rotation/restore evidence | hide until backend |
| J11.5 | No verified update | R-PACKAGES OPEN;no signature/update rollback evidence | hide until backend |
| J11.6 | Purge hidden;legacy mutation disabled | workflow-purge-live.json and14-stage smoke:401/400/413/501,populated metadata unchanged;full erasure backend absent | hide until backend |
| J12.1 | Generic/raw errors | SOURCE:api.ts Gateway request failed(status);SpeechPanel String(error) | fix |
| J12.2 | Supervision/cancel partial | B2 process-tree tests;B4 browser Stop;resident real-engine storms pending | build |
| J12.3 | Incomplete resource/crash recovery | B1 profile fixtures;no fresh low-disk/gateway-kill-indexing runner | build |
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

## Next alignment slices

1. Canonical contract committed at d6a10d7;all5 hosted jobs completed success
   (run39035676424). Registry consistency and secret scanning are the next slice.
2. Real first-run status/auth;fail-closed capabilities;truthful privacy badges,
   error taxonomy,Knowledge cancel;hide false full purge/developer gallery.
3. Register one automated runner per journey,distinguishing pending-denial checks
   from actual verified journeys;map existing real smoke to supported subflows.
4. Complete J1–J4/J12 and subsequent backends in WRAPUP order. No cloud connector
   before policy/ledger. No release tag from baseline or documentation alone.

## Workflow guard slice evidence

Canonical contract d6a10d7 hosted run39035676424:all5 jobs completed success.
Fresh guards:174 source tests,Rust67,web76 PASS;audit0,38 denial probes.
Full implemented-feature smoke12 stages PASS;readiness12 PASS/full journeys0.
Raw:workflow-checks-source-complete.log,workflow-checks-rust.log,
workflow-bootstrap-web.log,workflow-checks-smoke-boot-fixed.log and
workflow-checks-final-smoke-*. All counts are actual execution results.
Consistency IDs/steps/budgets/status/test mappings and credential scan are now
implemented. Actual full journey Playwright,budget,ledger,chaos and hosted
runtime acceptance remain gaps,not covered by readiness. Confirmed startup503
responses and failed tests remain named;sequential bootstrap plus fail-closed
capabilities and one context poll passed3 consecutive real Knowledge runs.
J2.3/J11.1 capability discovery is now fail-closed;simulated wizard,preference
write failures and broad privacy/purge claims remain pending alignment.
J6.4 was corrected to source-only evidence:legacy smoke did not exercise it.

Hosted12afacc failed the unchanged website consistency test after the release
rewrite renamed its Support matrix heading. Restored the established heading
and explicit native Windows/macOS rows;no assertion removed or weakened.
Raw workflow-ui-hosted-web-failed.log. Local docs must be included in the final
web rerun;earlier web pass preceded the last docs rewrite.
