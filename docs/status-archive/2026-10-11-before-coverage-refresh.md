# Current state

- Authority: [MISSION](MISSION.md), [WRAPUP](WRAPUP.md), ADR0027; feature freeze active.
- Current: Step U Knowledge upload/cited-answer surface implemented on `ui-hermes-port`.
- Last hosted-green: `4d509ea20b3b90f7f595a12d484bb1d7aa0a985c`, [all5 jobs](https://github.com/avirooppal/Sanctum/actions/runs/38145202433).
- Blockers: none for software; T1/GPU/physical audio/native targets need later verification.
- Next: history/model/settings screens; isolated reference captures; fidelity/axe/all-screen egress gates.
- Release: incomplete; no UI merge or phase/release tag.

| Latest slice gate (working tree based on 380f4d3) | Observed result |
|---|---|
| Linux / Rust / web |157 /57 /34 PASS; lint, format, typecheck, clippy PASS |
| Licenses / audit |26 Python,72 npm,92 Rust,5 font hashes PASS; npm0 advisories |
| Denial/startup / supervision |38 probes PASS;3 scenarios,zero survivors; .565053/.525362/.565618s |
| Real Knowledge UI |6 PASS: create/upload/cited answer/abstention/mobile/Escape; foreign HTTP/WS requests0 |
| Full incremental smoke |8 stages PASS including Knowledge UI and chat Stop; release_complete=false |
| U6 / final acceptance |NOT DONE; remaining screens, fidelity, axe, all-screen egress and later roadmap open |

## Wrap-up inventory

DONE below means the cited scoped work exists; historical gate evidence is labeled,
and is not represented as remeasured this session. Whole-product rows remain open.

| Mission work order / Amendment deliverable | State | Evidence / remaining work |
|---|---|---|
| Step 1a authenticated transport | DONE | realtime.rs, realtime-v1 contract; prior held 600.398s and mixed 182.553s in archives; current ticket smoke 6 PASS; speech_pipeline=false |
| Step U foundation | IN PROGRESS | 16 palettes, 5 licensed fonts, responsive shell, adapter/notices; current 29 web tests; Knowledge upload/cited-answer UI now real; remaining screens, reference fidelity, axe, all-screen WS egress |
| Step 1b resident supervised ASR | NOT STARTED | ADR0032 and measurement experiment only; no production resident worker |
| Step 1c streaming TTS | NOT STARTED | File TTS works; sentence-stream pipeline absent |
| Step 1d barge-in | NOT STARTED | Transport interrupt exists; complete playback/LLM/history cancellation absent |
| Step 1e diarization / speaker meeting notes | IN PROGRESS | Existing reviewed transcript to Knowledge works (browser 5); diarization and speaker UI absent |
| Step 2 real WER / WS latency | NOT STARTED | Corpus and >=50-turn measurements pending; T1 hardware gate unchanged |
| Phase 4 VLM / OCR / tables / figures / visual eval | NOT STARTED | Real models, UI, n>=100 ablation and licenses pending |
| Phase 5 MCP / manifests / policy / budgets / sandboxes / approvals / ledger / red-team | NOT STARTED | Existing network containment is not this complete agent boundary |
| Phase 6 resource governance | IN PROGRESS | Admission/cancellation limits exist; lifecycle, eviction and complete owner controls pending |
| Phase 6 optional GPU adapter | NOT STARTED | Contract adapter and NVIDIA verification script pending |
| Phase 6 owner LAN TLS | NOT STARTED | TLS, allowlists, lockout, ledger and second-netns test pending |
| Phase 6 encryption / rotation / backup | NOT STARTED | Implementation and real round-trip/canary tests pending |
| Phase 6 installers / desktop / signed offline bundle / SBOM | NOT STARTED | Release artifacts and clean no-network install pending |
| Phase 6 >=1h complete workload soak | NOT STARTED | Requires resident voice and agents |
| Code cleanup / coverage / dependency audits | IN PROGRESS | Current lint/license/npm checks PASS; coverage, unused-code and Rust security audit pending |
| Final acceptance / fresh clone / packet-ledger reconciliation | NOT STARTED | Requires all five modalities, LAN and artifacts |
| D1 offline product behavior | IN PROGRESS | Real incremental smoke 6 PASS; five explicit release gaps remain |
| D2 distributables | NOT STARTED | No verified release artifacts/checksums/signatures |
| D3 repo and in-app documentation | IN PROGRESS | Existing contracts/ADRs/notices; full user guide and release documentation pending |
| D4 delivery quality gates | IN PROGRESS | Baseline above; full eval/red-team/soak/fidelity/accessibility absent |
| D5 strict coverage / support matrix | IN PROGRESS | Existing PLAN_COVERAGE needs final requirement-by-requirement evidence audit |
| D6 tags / handoff | NOT STARTED | Software gaps prohibit release tag; HANDOFF and final report pending |

## Latest slice evidence

Contract `docs/contracts/knowledge-ui-v1.md`; tests first failed absent adapter
methods, retained in wrapup-knowledge-test-first.log. Added typed validated
workspace/create/upload/ask methods and real Knowledge dialog. Owner-only readers,
restricted uploads, existing10MiB/4000-character bounds, inert citation text,
abort on close, no automatic retry or new dependency. No OCR/region-overlay claim.

`npm test --prefix apps/web`32+2 PASS; typecheck/build/audit0 PASS.
`python tools/check.py`157 PASS; `bash tools/check_rust.sh`57 PASS,38 denial/startup
probes and3 supervision scenarios with zero survivors. Same WSL environment as
archived baseline, no threshold or timeout change. Commands/output retained in
`evals/results/wrapup-knowledge-*`. Source suite rerun after smoke harness extension.
`node evals/browser_knowledge.mjs PLAYWRIGHT_PACKAGE TOKEN_FILE OUTPUT_JSON`6 PASS:
actual local upload -> amber answer with harbour.md quote; empty workspace abstains;
mobile no overflow, Escape closes; no page errors or foreign HTTP/WS requests.
Desktop/mobile screenshots inspected and retained. This is surface-specific egress,
not the complete U6 gate. `bash tools/smoke_all.sh` extended to8 real stages and all
PASS, explicitly keeping five pending release requirements. No mock API responses.

## Preserved history

Previous STATUS copied verbatim to [baseline and chat Stop](status-archive/2026-10-11-wrapup-baseline-and-chat-stop.md),
SHA256 `6b1b21b44eb81c9b27dca833263d5b6de30f5a7134db02e04700221d915b7190`.
It preserves the full baseline, failed runs, commits, exact-byte correction and
older archive links. WRAPUP committed bytes verified equal the source attachment.
Existing untracked owner files untouched. Runtime remains on localhost:8769.

Documentation check correction: mixed newline conversion in the inventory caused
`git diff --check` to fail before b5a285a; the PowerShell wrapper incorrectly
continued to commit. Preserved the failure as wrapup-knowledge-status-whitespace-
failure.json, normalized only current STATUS (archives unchanged), and reran the
check. No test, threshold or measured result was removed.

Knowledge implementation b5a285a plus documentation correction4d509ea pushed.
Exact4d509ea hosted run38145202433/all5 jobs PASS observed this session.
Extended smoke repeated chat Stop at295.5036ms browser idle (single observation,
not an engine gate). Working tree has only the three pre-existing untracked owner
paths; main not merged and no tags created. Full mission remains incomplete.
