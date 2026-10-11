# Current state

- Authority: [MISSION](MISSION.md), [WRAPUP](WRAPUP.md), ADR0027; feature freeze active.
- Current: Step U foundation on `ui-hermes-port`; baseline passed before edits.
- Last hosted-green: `a1781a8f3fad700e137542ada155a35eea116cca`, [all 5 jobs](https://github.com/avirooppal/Sanctum/actions/runs/38144636103).
- Blockers: no current software blocker; T1/GPU/physical audio/native targets need later verification.
- Next: chat controls/history; real settings/models/Knowledge screens; isolated reference and U6 gates.
- Release: incomplete; no merge or tag authorized by measured gates yet.

| Baseline gate (this session, dd72706) | Result |
|---|---|
| Linux source / Rust / web | 157 / 57 / 29 PASS; lint, format, types, clippy PASS |
| Licenses / npm audit | 26 Python, 72 npm, 92 Rust; 5 font hashes PASS; 0 advisories |
| Denial/startup / supervision | 38 probes PASS; 3 scenarios, zero survivors; release .565395/.528833/.565931s |
| Actual SDK / incremental smoke | SDK 8 PASS, chat 1.3789s, TTFT .3842s; all 6 implemented stages PASS |
| Actual browser | Smoke UI 7, meeting 5, emulated microphone 4 PASS; physical audio unverified |
| Final product / UI merge | NOT DONE; release_complete=false |

## Wrap-up inventory

DONE below means the cited scoped work exists; historical gate evidence is labeled,
and is not represented as remeasured this session. Whole-product rows remain open.

| Mission work order / Amendment deliverable | State | Evidence / remaining work |
|---|---|---|
| Step 1a authenticated transport | DONE | realtime.rs, realtime-v1 contract; prior held 600.398s and mixed 182.553s in archives; current ticket smoke 6 PASS; speech_pipeline=false |
| Step U foundation | IN PROGRESS | 16 palettes, 5 licensed fonts, responsive shell, adapter/notices; current 29 web tests; remaining screens, reference fidelity, axe, all-screen WS egress |
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

## Baseline commands and evidence

`python tools/check.py`; `bash tools/check_rust.sh` under WSL Ubuntu-22.04,
VIRTUAL_ENV=/home/aviroop/.local/share/sanctum-dev-venv, PYTHONPATH unset.
`npm test --prefix apps/web`; `npm run typecheck --prefix apps/web`;
`npm run build --prefix apps/web`; `npm audit --audit-level=low --prefix apps/web`.
`bash tools/smoke_all.sh` using runtime-dispatch.json / localhost:8769 and the
existing token file (never logged). `node evals/browser_meeting.mjs` and
`node evals/browser_microphone.mjs` with the installed Playwright package and JFK
fixture; SANCTUM_BASE_URL=http://127.0.0.1:8769. No physical microphone claim.
Raw commands/results: `evals/results/wrapup-baseline-*`.
Hosted API read confirmed exact dd72706 all five jobs successful this session.

## Preserved history

Previous STATUS archived verbatim as [responsive shell](status-archive/2026-10-11-responsive-shell.md),
SHA256 `d2efe17f413fadf952659223277e9912a05b4912503bff01a73ebdc45e114657`.
Older archives and measurements remain linked there. Existing untracked owner files
are untouched. No failed measurements removed or thresholds changed.

## Step U: composer cancellation

Contract/tests first: new controller suite failed while module was absent (named
wrapup-chat-stop-test-first.log). Implemented one owned AbortController, Stop,
late-output suppression, overlap refusal, unmount cancellation and explicit recovery.
Tests now 30 web +2 font metrics PASS. Typecheck/build/audit0 PASS. Full Linux157,
Rust57,38 denial/startup and3 supervision cases/zero survivors PASS again; all6
real incremental smoke stages PASS. Raw commands/results: wrapup-chat-stop-*.

Real browser initially missed Stop after response completion; failure preserved.
New request-initiation trigger (ADR0062) observes aborted HTTP request, no retry,
no visible cancellation error and successful explicit next Send:4 PASS. Browser
stop-to-idle333.7183ms, single observation; NOT engine-slot timing or p95.
Editing helper's initial Windows-default decoding failed before main.tsx was
changed; rerun with explicit UTF-8, then all checks above. No runtime defect masked.

Documentation5557fd3 hosted run38144333928 all5 PASS. WRAPUP/archive Git newline
normalization corrected under ADR0062 so committed bytes match their source hashes.
Next: conversation management and remaining foundation screens, then U6 gates.

Exact a1781a8 hosted CI: all5 jobs PASS, run38144636103. Byte audit initially
FAILED: Git index reused normalized WRAPUP despite the attribute change. Rewrote
and restaged exact attachment; staged-byte comparison now PASS (SHA256
eab241c4b9f2b2f2de21b140db3ce664339c46a974b3204932e80ef45e0d2fba).
Archive committed-byte SHA256 comparison also PASS. No product code changed.
