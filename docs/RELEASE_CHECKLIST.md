# Release checklist — live, not a release approval

Evidence date: 2026-10-11; baseline `7cbc426d13b284856563c6e0a103f202b24557bf`.
Authoritative row IDs and fresh evidence: [PLAN_COVERAGE](PLAN_COVERAGE.md).
Feature freeze and release rules: [WRAPUP](WRAPUP.md), [MISSION](MISSION.md).
**Release blocked by missing software.** No release artifact or tag is approved.

## Update rule (every slice)

- Update the affected coverage IDs and checklist IDs in the same code/test commit.
- Record commands, actual results, source SHA and raw evidence. Keep failures.
- Supply and exercise the owner runner before closing an UNVERIFIED row. Blank
  commands below are explicit outstanding work, permitted by the docs-first request;
  they are not runnable verification and cannot satisfy release acceptance.
- Missing software remains Partial, even when its eventual target needs hardware.
- Archive milestone narrative verbatim with SHA256; keep STATUS's top block short.

## Support matrix

| Platform / scope | Verified in this session | Remaining support boundary |
|---|---|---|
| Linux x86_64, WSL Ubuntu22.04, CPU reference | Source157,Rust62,38 denial/startup probes;9 real smoke stages;13 WS transport checks (E9) | Development configuration with pre-provisioned models. Not a verified installable release. No full WS voice/vision/agents/LAN/encryption. |
| Windows host Chromium UI → WSL gateway | Web34 tests/build/typecheck/audit0; real chat,Knowledge,file speech,meeting/emulated microphone | Native Windows gateway absent. Windows-side raw WS handshake deadline probe FAILED; E7 preserves it. |
| Ubuntu/macOS/Windows hosted source CI | Exact7cbc426 all5 jobs PASS observed via GitHub API | Source CI does not verify native engines,containment,installers or audio. |
| T1 recommended hardware voice | UNVERIFIED | Full WS speech pipeline and>=50-turn runner also missing; software remains Partial. |
| NVIDIA owner vLLM/SGLang | UNVERIFIED | Adapter not implemented; no real GPU serving claim. |
| Apple Silicon/MLX native | UNVERIFIED | Concrete adapter/native containment/package validation absent. |
| Physical microphone/speaker/echo | UNVERIFIED | Emulated-file capture passed; it is not physical audio or duplex echo evidence. |
| gVisor/Firecracker/KVM | UNVERIFIED | Governed agent sandbox missing; availability has not been established here. |
| Native Windows/macOS desktop packages | UNVERIFIED | Native runtime/build/install verification and artifacts pending. |
| Owner LAN / fully air-gapped release | Not supported yet (Partial) | TLS,ledger,encryption,signed bundle and clean offline acceptance pending. |

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
| U-NPU / H2 | NPU and non-NVIDIA accelerator discovery | `python -m sanctum doctor --json` | Inventory only; current report says NPU unknown. This command cannot establish engine performance or support. |
| U-WS-WIN / S12 | Windows-to-WSL handshake deadline regression | `python evals/realtime_transport.py --token-file "$SANCTUM_TOKEN_FILE" --output evals/results/owner-windows-realtime.json` | Run from Windows against forwarded8769. This session FAILED handshake<2s; Linux rerun passed unchanged. Cause not established; no pass inferred. |

Blank rows will be filled as implementations and tested runners land. They are
release blockers, not accepted hardware exceptions. The live voice, GPU and native
platform rows currently combine absent software with unverified target execution.

## Release gates

| ID / coverage | Acceptance | Current result / evidence |
|---|---|---|
| R-BASE / D4 | All existing source,Rust,web,SDK,denial checks | PASS within E1–E4 scope:157/57/34,38 probes,8 smoke stages; not final release regression. |
| R-DOCTOR / PH0,H1 | Correct real tier/profile and readiness | OPEN:8167555072 bytes<configured8GiB; recommendation=null,exit1 (E8). No profile threshold reduced. |
| R-UI / U1–U3 | Completed real screens,licensed assets,reference fidelity,axe/keyboard/contrast,all-screen HTTP+WS egress,branch merge | OPEN; S0–S14 implemented and merged to main (merge commit 064a1c4, hosted CI run 38216308897 success). 25/25 E2E Playwright tests PASS (browser-e2e-25.json), 73 unit tests PASS, TypeScript strict, npm audit 0. Fidelity measured at supplementary invariant level (ui-fidelity.json), not upstream pixel-exact. Full axe/keyboard/contrast gates and all-screen WS egress in release harness pending. |
| R-RAG / PH2,EV1 | Real-document hybrid/vector ablation,faithfulness,page highlighting | OPEN; current citation smoke does not establish benchmark lift. |
| R-SPEECH / S1–S14 | Resident workers,streaming TTS,barge-in,diarization/notes,WER/DER/WS latency | OPEN; file ASR/TTS and reviewed notes only. |
| R-VISION / V1–V4,EV3 | VLM/OCR/tables/figures/citations,n>=100QA/CIs/human subset | OPEN; software/evaluation absent. Optional visual retriever remains off. |
| R-AGENTS / A1–A8,G2–G4 | MCP/policy/taint/budgets/sandboxes/approvals/ledger;critical bypasses0 | OPEN; no full agent runtime/red-team suite. |
| R-PRIVACY / G4–G6,D1 | Packet/netns capture reconciled with ledger,final startup self-test | OPEN;38 denial probes PASS is narrower than this requirement. |
| R-RESOURCES / I5,I6 | Priority/preemption/RAM/VRAM/lifecycle/owner caps | OPEN; bounded admission exists; complete governance absent. |
| R-LAN / G8 | TLS owner-only LAN,Host/Origin/lockout/ledger,second-netns tests | OPEN; absent. |
| R-CRYPTO / G7 | Lock/unlock,wrong-key/canary/rotation/backup/overhead | OPEN; absent. File permissions do not pass this gate. |
| R-PACKAGES / PH6,D2 | Clean installer/Compose/desktop,offline signed bundle/SBOM/checksums/tamper rejection | OPEN; no verified release dist artifacts. |
| R-SOAK / PH6,D4 | >=1h real voice/chat/ingest/agent/reconnect workload,leak bounds | OPEN; complete workload absent. |
| R-QUALITY / D4 | Coverage,unused-code/dependency cleanup,Rust security audit,all lint/type/license checks | PARTIAL; configured lint/type/license checks and npm audit pass; coverage/unused-code/Rust vulnerability audit pending. |
| R-DOCS / D3,D5 | User/developer/in-app/security/API/ADR/notices/release guides,strict coverage | PARTIAL; live coverage/checklist present; remaining guides and final audit pending. |
| R-FRESH / D6 | Fresh clone README-only,all five UI capabilities on loopback+LAN | OPEN; not executed. |
| R-HANDOFF / D6 | HANDOFF,known limits,review decisions,exact CI,clean pushed main,tags | OPEN; UI branch not merged; no tags or complete handoff. |

## Known limits and release decision

See [KNOWN_LIMITS](KNOWN_LIMITS.md). This session does not reapprove old long-load,
leak-storm,benchmark or clean-install results. All commands/results used as current
evidence are indexed in PLAN_COVERAGE E1–E8. No gate is relaxed or optional feature
silently removed. Phase/release tags remain withheld because software gaps remain.

## Website slice (ADR0064 / E10)

R-UI remains OPEN. Public /website.html is built with the application and tested
at1440x900,820x1180,390x844 with zero foreign requests/WebSockets/page errors.
Command: `node evals/browser_website.mjs <Playwright-package-path> evals/results/website-browser.json`.
Source157,Rust62,web35+2,38 denial probes pass; npm audit0. Raw logs:
evals/results/website-source-final.log,website-rust.log,website-web-final.log.
Docs-site port,chat/dashboard fidelity,axe and executable packaging remain
Partial. No download links or release/phase tags are justified by this slice.

Extended smoke: `bash tools/smoke_all.sh` passed all10 stages,including
ui_website;release_complete=false. Evidence:evals/results/website-smoke-final.log
and website-final-smoke-*.json/log. No full release claim.

Website commit `6ec627261abae92de6d8ed8a2247c2d0e4579f8b` pushed;
hosted run38152617896/all5 jobs PASS observed. Raw:website-hosted-ci.json.

## Canonical workflow gate (2026-10-17)

R-WORKFLOW:OPEN. WORKFLOW.md v1.0.0 (ADR0071) and its per-step gap audit are
canonical. All12 journeys require their own actual action/time/chaos/ledger
evidence;legacy smoke does not promote one to VERIFIED. Baseline now passes
source157,Rust67,web73,38 denial probes,11 real smoke stages and npm audit0.
Evidence:WORKFLOW_GAPS B1-B5,evals/results/workflow-baseline-*.
The initial failures are preserved. Exact edited-SHA hosted CI is pending push.
Missing full-purge scope,simulated onboarding,unconditional privacy badges and
fail-open client capabilities must be corrected. Cloud remains unavailable
until its policy/ledger/broker prerequisites pass;no release tags.
