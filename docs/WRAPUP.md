FINAL WRAP-UP DIRECTIVE — SANCTUM

Authority: docs/MISSION.md (including Amendment 1), plan.md, ADR 0027 (single-user scope) and every earlier rule remain in force. This directive sets the order, the freeze, and the exit conditions. Save it verbatim as docs/WRAPUP.md and commit it. After any context reset, re-read plan.md, docs/MISSION.md, docs/WRAPUP.md and docs/STATUS.md, check out the last green commit, run the baseline, and resume.

GOAL
Deliver Sanctum as a finished, installable, documented, Local Private AI Platform that runs models, RAG, speech recognition, vision, and agents entirely on-device or inside the owner's private network, with everything verified here proven by evidence and everything not verifiable here listed with a runnable script. Nothing may break: every change keeps main green.

0. START
Run the full baseline (Linux source, Rust, web tests/typecheck/build/audit, real browser flows, SDK, denial/startup probes, `bash tools/smoke_all.sh`, hosted CI state). Confirm green before editing. Write an inventory table in docs/STATUS.md: every item in MISSION.md's work order and Amendment 1's D1-D6, marked DONE (with evidence) / IN PROGRESS / NOT STARTED. This table is the wrap-up work list.

1. FEATURE FREEZE
No new features, screens, engines or dependencies beyond MISSION.md/Amendment 1. Only: finishing listed work, fixing defects, tests, docs, cleanup, packaging. Anything new you think of goes to docs/FUTURE.md and is not built. Polish is time-boxed: a fidelity or UX gap that does not block a gate becomes a line in docs/ui-deviations.md or docs/KNOWN_LIMITS.md, not a loop.

2. FINISH IN THIS ORDER (each slice: contract/tests first, implement, run the real feature, full regression + smoke_all, record in STATUS.md, commit, push, verify hosted CI for the exact SHA)
 a. Step U: finish the foundation screens with real backends, meet the merge gates (reference fidelity numbers, egress test on every screen including the WebSocket path, axe/keyboard/contrast, notices with exact MIT text and each font's license, zero audit advisories), merge `ui-hermes-port` to main, rerun everything on main.
 b. Step 1b-1e: resident supervised speech workers under the memory cap, streaming TTS, barge-in, permissively licensed diarization and speaker-labeled meeting notes; rerun the Step 0 cancellation/storm/shutdown/overload gates with resident workers; voice and meeting UI on the WebSocket.
 c. Step 2: real WER (LibriSpeech test-clean/test-other plus a noisy/accented set, one documented normalizer, ADR 0018 thresholds) and real end-of-speech-to-first-audio latency over the WebSocket (>=50 turns, warm/cold, per-stage). T0 numbers reported honestly; the plan's T1 gate stays UNVERIFIED with a script; never redefine the metric.
 d. Phase 4 vision: VLM chat, OCR, table/figure indexing with page-region citations, optional visual retriever, measured visual-QA comparison (n >= 100, CIs, human-verified subset). If no measurable lift, keep it off by default and document; vision UI wired in the same slice.
 e. Phase 5 agents: MCP, signed/pinned manifests, default-deny scoped tools, policy engine with taint tracking, budgets, sandbox tiers (container / gVisor if installed / Firecracker UNVERIFIED if no KVM), approval gates bound to exact arguments, hash-chained Privacy Ledger with `sanctum ledger verify` and UI view, and the full red-team suite in CI (critical-severity bypasses must be zero; report attack-success tables).
 f. Phase 6 single-owner: scheduler/resource governance, optional vLLM/SGLang adapter (UNVERIFIED without NVIDIA), owner-only LAN mode (TLS, token + WS tickets, Origin/Host allowlist, lockout, ledger records, tested from a second network namespace), encryption at rest with lock/unlock/rotation/backup-restore, packaging, signed offline bundle with SBOM, and the >=1h soak with leak detection.
 If a step is blocked by something external, record the blocker, finish everything independent of it, and continue. Do not stall the whole mission.

3. CODE CLEANUP (continuous, completed before release)
Zero warnings: Ruff/format/type checks, `cargo clippy -D warnings`, TypeScript strict. Remove dead code, unused dependencies, commented-out code, empty placeholder service directories, stale scripts, orphan eval results (archive anything referenced by docs). No TODO/FIXME without a tracked reference. One README per service (contract, config, run, test). Coverage and unused-code reports with ADR-set thresholds; raise coverage on auth, policy, ledger, cancellation, ACL and crypto. Dependency hygiene: locked/pinned, license gate, npm and Rust audits clean, SBOM generated.

4. FINAL ACCEPTANCE (after steps 2-3)
 1. Fresh clone in a clean environment; follow ONLY README.md; reach chat, a cited document answer, a voice turn, a vision question, and an approved agent action through the UI, on loopback and over LAN mode. Fix the README wherever it fails.
 2. From that clean state run every suite: regression, evals (RAG, WER, DER, voice latency, visual QA), security/red-team, leak/storm, soak, UI fidelity, accessibility, egress. Record real results and commit hashes in STATUS.md; raw outputs in evals/results/.
 3. Egress proof: packet capture or netns monitoring across a full workflow, reconciled against the Privacy Ledger, then the startup egress self-test last. Zero unexpected egress.
 4. docs/PLAN_COVERAGE.md: walk plan.md section by section: Implemented (with file paths and evidence) / Partial / UNVERIFIED / Out of scope by decision (ADR link). No evidence means downgrade.
 5. Distributables in dist/ built from the release commit: one-line installer, single-user Docker Compose, signed offline bundle (verify with `sanctum bundle verify`; no-network install reaching chat, a speech turn and a cited RAG answer), Tauri builds for targets buildable here; SHA256SUMS signed, SBOM, verification instructions. Each claimed artifact verified from a clean environment; the rest UNVERIFIED with build scripts.
 6. Docs complete in-repo and in-app: README quickstart, user guide (install, first run, models/profiles, workspaces and RAG, voice, vision, agents and approvals, Privacy Ledger, LAN mode, encryption and backup, resource settings, troubleshooting), developer guide, architecture, threat model, SECURITY.md, generated API reference, ADR index, REVIEW_QUEUE, THIRD_PARTY_NOTICES.md, CHANGELOG.md, release notes, docs/KNOWN_LIMITS.md.
 7. docs/RELEASE_CHECKLIST.md: support matrix (verified vs UNVERIFIED), and for every UNVERIFIED item the exact command for the owner to run (T1 voice-latency gate, NVIDIA/vLLM, physical audio and echo, Firecracker/KVM, native macOS/Windows).
 8. docs/HANDOFF.md (one page): what Sanctum is, how to install and run, how to run all verification, where everything lives, the open items, and the decisions awaiting owner review.

5. TAGS AND EXIT
 - `phase-N-green` only for phases whose gates all have measured passing results.
 - `v1.0.0` only if no gate FAILED and every remaining gap is purely hardware/environment-unavailable and listed. Otherwise `v1.0.0-rc1`, or no tag, with the reason stated.
 - Exit when: the inventory table has no NOT STARTED or IN PROGRESS rows, every artifact is verified or marked UNVERIFIED with a script, hosted CI is green on the final commit, main is clean and pushed, STATUS.md "Current state" fits on one screen (history archived with SHA256), and the final report is written.

6. FINAL REPORT (print at the end)
What is done; what is UNVERIFIED and why; known risks and limits; every gate with its real numbers (including failures); the exact commands for me to verify the UNVERIFIED items; decisions awaiting my review (REVIEW_QUEUE); tags created or withheld with reasons; the repository state (final commit SHA, CI run URL, dist/ contents with checksums).

RULES (unchanged, restated)
Contract and tests first; run the real feature and record real output; never claim a result you did not see this session; never loosen a threshold, skip or xfail a test, or widen a timeout without an ADR and a REVIEW_QUEUE entry; preserve failed runs as named evidence; no mock data, placeholder screens or dead buttons; keep main green and revert immediately if a change breaks it; commit and push every slice and verify hosted CI for the exact SHA; WSL or Docker flakes are recorded, recovered minimally, rerun, and never counted as a pass; verify model, dataset, font and asset licenses at their sources; nothing leaves the machine unless the owner explicitly enables a connector, and it is logged.

REPORT per slice: step, criteria, commit hashes, commands run with real results, STATUS.md changes, next slice, decisions for my review.

BEGIN: baseline and the inventory table, then continue with step 2a.