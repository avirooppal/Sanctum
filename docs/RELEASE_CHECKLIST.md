# Release checklist — blocked,not release approval

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
