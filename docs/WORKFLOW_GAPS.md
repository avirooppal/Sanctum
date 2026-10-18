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

## Redesign baseline/audit (2026-10-17)

ADR0079 and design/REDESIGN_AUDIT.md preserve current evidence and missing-state
coverage. Real129 before records:three themes,two modes,three viewports;zero
foreign requests/page errors and zero root horizontal-overflow records. This
is not an accessibility pass or a complete state matrix. Busy,long-answer and
combined streaming/code/citation captures remain PENDING. Baseline182 source,
70 Rust,81 web/typecheck/build,audit0,38 denial probes and15 smoke PASS;raw
redesign-baseline-*. Starting1c0eb3b hosted39056409170 completed success/all5.
No new product feature or journey status promoted by the audit. S1 tests and
implementation follow the wireframe;all prior installation/backend gaps remain.

## S1 focused unlock iteration1 (2026-10-18)

Partial redesign:real focused unlock,truthful copy,one primary,key-file help,
inline errors and auth-gated shell are implemented and exercised. New contract:
docs/contracts/unlock-ui-v1.md;4 unit tests and evals/browser_unlock.mjs;16-stage
smoke now includes that browser subflow. Actual182 source/70 Rust/85 web/types/
build,audit0,38 probes and16 smoke PASS;raw redesign-round1-*. AA primary
6.85586/7.16261;48px target;0 foreign/page errors/root overflow. Actual build
size delta95 JS/555 CSS gzip bytes (redesign-round1-budget.json). Existing237px
reference geometry check passes. No full Hermes pixel-diff,all-theme WCAG,axe,
200% zoom,INP/CLS or human-comfort gate is inferred. S1 iterations2/3 and S2-S7
remain pending;standalone historical pre-auth shell/theme runners need auth
migration before reuse. No full journey/install/phase/release promotion.

## S1 iteration2 (2026-10-18)

Live bounded health observation and linked field errors are exercised with real
gateway reads and explicitly simulated browser network failure. Startup report
read time is separate from kernel test time;no ledger/history claim. Source182,
Rust70,web89/types/build,audit0,38 probes,16 smoke PASS;raw redesign-round2-*.
Button48px/contrast6.85586 and7.16261;observed text minimum8.90049,focus4.90443;
zero root overflow/foreign/page errors. Raw screenshots ui-after/round-2. JS+868/
CSS+623 gzip bytes under prior budgets;fonts/deps0. Previous2ce6c60 hosted
39058592559 completed success/all5. S1 iteration3,legacy standalone runner auth
migration,all-theme/axe/zoom/performance and later screens remain Not done.
Full journeys/platform/install/release are not promoted.

S1 iteration3 (2026-10-18): stable two-line startup chip; guarded owner accent
also controls focus. Preferences now serialize the actual preference object,
not the Content-Type header object; API test and browser readback cover it.
Malformed historical preferences are preserved with an honest recovery notice.
Unsupported deletion Undo and local-only message deletion are hidden. Metadata
floor is12px;notification duration remains5s without a layout-width animation.
Evidence:evals/results/redesign-round3-*;182 source,70 Rust,89 web tests,
typecheck/build,audit0,38 kernel probes;18 implemented smoke stages. Authenticated
shell runner covers5 widths;theme runner covers96 samples and3 system checks.
Unlock primary48px,contrast6.85586/7.16261;focus6.23336/5.83256;no foreign requests
or page errors. Actual archived-baseline rebuild:JS+862/CSS+739 gzip bytes.
Full redesign and release are NOT verified. Native Chrome reports zoom2 and
711x402 CSS viewport, but screenshot inspection finds clipped content despite
root overflow=false: zoom accessibility gate FAILED, not a passing claim.
See ui-after/round-3/native-zoom/review.json. Capture/layout diagnosis,axe,
all-theme contrast,streaming/performance and S2-S7 remain open. No tag or merge.

Focused chat refinement1,2026-10-18 (ADR0082):quiet single-line history with
native Actions disclosure;Appearance and runtime details collapsed;one compact
composer;Send replaced by Stop;readable transcript;Local speech and Meeting notes
below chat. APIs,auth,storage and engine behavior unchanged. Actual browser at
1440/820/390 measures composer760/543/366px wide and127px tall,no outer/root
overflow,real local answer,foreign HTTP/WS attempts0,page errors0;44px attachment,
dictation and artifact targets asserted. Existing history mutations,keyboard
mobile escape,speech and theme controls retain assertions with disclosure steps.
Source182,Rust70,web92/types/build,audit0,38 denial probes;19 implemented smoke
stages PASS. Raw chat-clean-* and chat-clean-smoke-ui-focused-chat. All new
browser images opened and inspected. Same-dependency git-archive baseline:
JS gzip+796/CSS+1949 bytes;no assets/fonts/dependencies added.

Preserved failures:initial new contract tests;old shortcut-label assertion
(restored exact shortcut text as textarea title);mobile0px runtime-more label
(fixed proper display:none,not lower floor);one standalone unlock locator timeout
while other tests ran(cause unproven,diagnostic and later real runs succeeded).
No flaked/failed run counted as a pass. Full redesign remains PARTIAL:remaining
critique rounds,custom controls,axe/all-theme contrast,zoom capture/layout,
performance and first-run work are not promoted. No phase/release tag or merge.

Focused-chat verification supplement:9988001 hosted39096933791 completed
success(all5). Native Appearance disclosure is keyboard-reachable after Licenses
on mobile;strengthened existing shell test passes5 widths. No product change,
threshold or timeout change. Raw chat-clean-navigation-focus.* and hosted-ci.json.

Liquid-glass public landing,2026-10-18(ADR0083):React/TypeScript/Vite,
existing Tailwind compiler,framer-motion14.3.0(MIT),lucide-react1.59.0(ISC).
Five new design sections,black background,glass primitives,Instrument Serif
regular/italic,real app/docs/status navigation;static setup/support/journey
projections retained. No signup/newsletter/social-account placeholders.

Measured:184 source tests,70 Rust,95 web tests,typecheck/build,audit0,77 reviewed
npm packages,7 admitted OFL font binaries,38 denial probes,19 smoke stages PASS.
Public browser1440x900/820x1180/390x844:foreign HTTP/WS0,storage0,page errors0,
no root overflow;normal scroll reveals exercised at1440/390;reduced motion at
all3 widths. Current public route JS108319 bytes gzip,fonts141604 bytes;budgets
245760/204800. Authenticated graph relative to archived1c0eb3b:+1816 JS/+2105
CSS gzip bytes,within unchanged12288/8192 limits. Scope change explicitly
recorded before graph comparison;old cross-entry aggregate is NOT a pass claim.
Raw evidence:evals/results/landing-*;source and browser scripts are reproducible.

PARTIAL:the five reference clips have no verified redistribution rights;owner
input requested,not received. Not downloaded/shipped/fetched. Original project
SVG artwork is the actual active design. See docs/landing-media.md. Video loop
500ms fades/100ms restart/cleanup/rejection have deterministic clock tests only;
real media remains UNVERIFIED. Google Fonts runtime import intentionally replaced
by pinned self-hosted OFL files. No pixel-exact/source-video fidelity claim.

Failures preserved:new-module tests first;0BSD initially rejected(admitted only
after reviewing tslib's unrestricted license and testing proprietary rejection);
obsolete zero-script assertion superseded by exactly one same-origin module
under explicit React request;status mutation fixture line-endings restored,
not weakened. Font budget initially800200 bytes failed;optional Archivo request
removed instead of raising budget. Full-page screenshots reviewed for layout;
section captures inspected at readable resolution. Long mobile element captures
can show a fixed skip-link screenshot artifact;separate actual viewport check
observed focus=false and its bottom above0(landing-skip-diagnostic.log). No
global accessibility/INP/pixel-fidelity/full-roadmap/release pass is claimed.
