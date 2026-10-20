# Release checklist — blocked,not release approval

## Desktop pivot amendment, 2026-10-20

ADR0084 and plan.md's pivot amendment supersede conflicting public website,
Hermes-fidelity and old packaging assumptions below. No desktop release is
approved. Native Windows/Linux/macOS installer execution is UNVERIFIED.

| Pivot gate | State | Required evidence / exact available command |
|---|---|---|
| Pre-pivot archive | Recorded | `git rev-parse 'pre-pivot-2026-10-20^{commit}'` must return 1bee37bc777318b1913aac0a95eb9315e29cfa05 |
| Legacy baseline | PASS on rerun, not full product acceptance | `bash tools/run_source_gate.sh`; `bash tools/check_rust.sh`; `npm test --prefix apps/web`; provision README smoke environment then `bash tools/smoke_all.sh` |
| Performance inventory | Partial | `python3 tools/measure_pivot_baseline.py --output evals/results/local-pivot-measurements.json`; build web first; output must not already exist |
| Removal of website/docs/Hermes work | PENDING | Delete/update dependent routes, gates, references and results after recorded salvage review |
| Native desktop performance/CI budgets | PENDING | Proposed ADR0084 budgets; native shell and full-process measurement scripts not implemented |
| Jan LICENSE/NOTICE and dependency/MPL audit | PENDING | Source-pin/audit commands to be recorded in M1; no license exception currently granted |
| Installers, signatures, SBOM, update verification | UNVERIFIED | No session-built clean-installed native artifacts; implement executable build/install runners in M11 before listing owner commands |
| OS helper egress assurance | UNVERIFIED for native Windows/macOS | Platform implementations and outbound-probe runners absent; Linux denial evidence is separate |
| A–L desktop journeys and evaluations | PENDING | PLAN_COVERAGE pivot rows; legacy smoke does not certify replacements |
| Hosted CI on pivot head | PENDING until observed | Push jan-style and poll that exact commit to completed; starting-head/main receipts are historical for the new commit |

Missing native runners are software blockers, not accepted hardware exceptions.
Do not publish a GitHub release. Existing dist archives have measured byte sizes
only; no clean-install or signature claim follows from their existence.

Date:2026-10-17. Base:c91cc58a249aa14db97d625116e8f4ca1a4b294d.
Old file preserved verbatim at [archive](status-archive/2026-10-17-release-before-ui-alignment.md),
SHA256 `78b8b3ec3b8e3a83ef70a8e7a030561b7e45bd65a35042a6a6be423f7decf9fd`. No release/phase tags.

## Support matrix

| Target | Current evidence | Boundary |
|---|---|---|
| WSL Ubuntu22.04 x86_64 CPU |174 source,67 Rust,38 denial probes,13 real smoke stages PASS |Provisioned development runtime only;not signed install or full platform |
| Windows browser over loopback |80 web tests,typecheck/build,audit0;real browser smoke |Not native Windows runtime/desktop |
| Native Windows desktop/runtime | UNVERIFIED | Native confinement/package absent;browser evidence is separate |
| Native macOS desktop/Apple Silicon | UNVERIFIED | Native runtime/MLX/package absent |
| NVIDIA/vLLM | UNVERIFIED | Adapter and real GPU validation absent |
| T1 voice/audio/KVM | UNVERIFIED | Missing pipelines/runners also remain software blockers |
| LAN,crypto,bundle,agents,vision,full live speech |Partial/PENDING |Not release-supported |

## Owner verification queue



Run from repository root after README development setup and local model provisioning.

For existing Linux runners, use the Python environment that passes tools/check.py.

Set SANCTUM_TOKEN_FILE to your local token **file path**, SANCTUM_CONFIG to your

runtime config, and SANCTUM_RUNTIME_PID to the running gateway's Linux PID.

The current realtime runners require the loopback gateway at127.0.0.1:8769.

Never paste the token itself into a command or report.



| ID / coverage | UNVERIFIED item | Exact owner-run command | Missing prerequisite / acceptance |

|---|---|---|---|

| U-HOLD / S13 | Current ten-minute held-session gate | `python evals/realtime_held.py --pid "$SANCTUM_RUNTIME_PID" --token-file "$SANCTUM_TOKEN_FILE" --runtime-config "$SANCTUM_CONFIG" --output evals/results/owner-held.json --seconds 600` | Provisioned Linux runtime; not run in this audit. Does not verify voice execution. |

| U-T1 / S10,H2 | T1 EOS-to-first-audio p95<800ms,>=50 warm/cold turns | — | Full authenticated WS voice path and runner pending. Do not substitute sdk_voice_turn.py's file-output measurement. |

| U-NVIDIA / I2,H2 | NVIDIA/vLLM or SGLang serving | — | Adapter,allowlist/ledger and real serving verifier pending. |

| U-AUDIO / S6,S9 | Physical microphone/playback,barge-in and echo | — | Manual/physical duplex runner pending. browser_microphone.mjs intentionally emulates a file and does not close this row. |

| U-KVM / A5 | Firecracker/KVM and gVisor sandbox | — | Sandbox implementation and escape/resource/egress runner pending. |

| U-MAC / I2,H2,PH6 | Native macOS/MLX/desktop | — | Runtime/adapter/build/install runner pending. |

| U-WIN / PH6 | Native Windows runtime/desktop | — | Native containment/build/install runner pending. |

| U-NPU / H2 | NPU and non-NVIDIA accelerator discovery | `python -m sanctum doctor --json` | Inventory only; historical report says NPU unknown. This command cannot establish engine performance or support. |

| U-WS-WIN / S12 | Windows-to-WSL handshake deadline regression | `python evals/realtime_transport.py --token-file "$SANCTUM_TOKEN_FILE" --output evals/results/owner-windows-realtime.json` | Run from Windows against forwarded8769. Historical Windows run failed;not rerun in this slice. Cause not established; no pass inferred. |



Blank rows will be filled as implementations and tested runners land. They are

release blockers, not accepted hardware exceptions. The live voice, GPU and native

platform rows currently combine absent software with unverified target execution.




## Release gates

| ID / coverage | Acceptance | Current result |
|---|---|---|
| R-BASE / D4 | All existing source,Rust,web,SDK,denial checks | PASS scoped only:174 source,70 Rust,81 web,audit0,38 probes,15 real smoke stages;workflow-ui-* evidence. |
| R-DOCTOR / PH0,H1 | Correct real tier/profile and readiness | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-UI / U1–U3 | Completed real screens,licensed assets,reference fidelity,axe/keyboard/contrast,all-screen HTTP+WS egress,branch merge | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-RAG / PH2,EV1 | Real-document hybrid/vector ablation,faithfulness,page highlighting | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-SPEECH / S1–S14 | Resident workers,streaming TTS,barge-in,diarization/notes,WER/DER/WS latency | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-VISION / V1–V4,EV3 | VLM/OCR/tables/figures/citations,n>=100QA/CIs/human subset | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-AGENTS / A1–A8,G2–G4 | MCP/policy/taint/budgets/sandboxes/approvals/ledger;critical bypasses0 | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-PRIVACY / G4–G6,D1 | Packet/netns capture reconciled with ledger,final startup self-test | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-RESOURCES / I5,I6 | Priority/preemption/RAM/VRAM/lifecycle/owner caps | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-LAN / G8 | TLS owner-only LAN,Host/Origin/lockout/ledger,second-netns tests | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-CRYPTO / G7 | Lock/unlock,wrong-key/canary/rotation/backup/overhead | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-PACKAGES / PH6,D2 | Clean installer/Compose/desktop,offline signed bundle/SBOM/checksums/tamper rejection | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-SOAK / PH6,D4 | >=1h real voice/chat/ingest/agent/reconnect workload,leak bounds | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-QUALITY / D4 | Coverage,unused-code/dependency cleanup,Rust security audit,all lint/type/license checks | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-DOCS / D3,D5 | User/developer/in-app/security/API/ADR/notices/release guides,strict coverage | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-FRESH / D6 | Fresh clone README-only,all five UI capabilities on loopback+LAN | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |
| R-HANDOFF / D6 | HANDOFF,known limits,review decisions,exact CI,clean pushed main,tags | OPEN:full requirement not established by current slice;historical details archived. Missing software is not a hardware exception. |

## Canonical journey status v1.0.0



| ID | Status | Acceptance test | Blocker |

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


UI slice:real setup3 clicks/2 entries,1054.46ms in the full smoke;wrong key
rejected,zero foreign requests. This is a configured-runtime subflow,not full
J2 or budget/ledger acceptance. Full purge hidden;legacy HTTP mutation disabled per ADR0075.
The old25-case canned API suite is fixture coverage,not current real evidence.
Hosted c91cc58 all5 jobs completed success;new SHA CI follows push.

Post-docs correction verified locally:source174,Rust67,web81,typecheck/build,
audit0,38 probes,13 real smoke stages PASS. Evidence:workflow-ui-postdocs-*.
Hosted12afacc completed FAILED (web status-matrix contract);all other4 jobs
passed. Follow-up SHA CI must complete before any green claim. No test skipped.

ADR0075:full purge still unsupported;legacy API fails closed501 without
mutation. Real safety tests PASS;all broad release gates remain OPEN.
Current scoped regression174/69/81,audit0,38 probes,14 smoke stages. Evidence
workflow-purge-*. Prior cd68270 hosted all5 completed success;new SHA pending.

ADR0076 current scoped checks174/70/81,38 denial probes,15 smoke stages,
audit0 PASS. Dashboard errors clear success;profile reads never fake empty on
failure;real CRUD passes. Full release gates remain OPEN. Missing hardware
runners/software are not waived. Raw workflow-dashboard-*.

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

Landing CI receipt:ff2ce220d8ef11d4e7599b424d732c1087a5cc3f,run39099696783,
completed success/all5 jobs observed this session. Raw landing-hosted-ci.json.
No promotion of media,accessibility,fidelity or release gates.
