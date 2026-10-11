# Current state

- Mission: [MISSION.md](MISSION.md), Amendment1; single owner ADR0027.
- Step: U4 responsive shell implemented on `ui-hermes-port`; full foundation pending.
- Last hosted-green: `7691ad5`, run38133630223/all5 jobs PASS.
- Blockers: none for UI; T1/GPU/physical audio/native targets UNVERIFIED.
- Next three steps: chat/history/model/knowledge screens; reference launcher;
  isolated pinned reference, fidelity/axe/WS egress gates before U6 merge.

| Gate | Latest observed results |
|---|---|
| Linux/Rust |157/57 PASS; lint/fmt/types/clippy; licenses26/72/92 +5 font hashes |
| Denial/startup/supervision |38 probes PASS;3 scenarios/zero survivors |
| Web |27 tests +2 metrics PASS; typecheck/build/audit0 |
| Real shell/themes/notices |5 viewports +resize PASS;96+system3 theme cases;3 notice cases |
| Real feature regression |Incremental smoke6 PASS; meeting browser5; emulated microphone4 |
| Full UI/product/release |NOT DONE; no reference fidelity/axe/packet-ledger/final release claim or tag |

## Preserved evidence

Previous STATUS copied verbatim to
[font admission archive](status-archive/2026-10-11-font-admission.md), SHA256
`b66fae25548c19c512cbdf301c84b9e562c03770c429c44981bdbbcd351b0323`.
It links all older archives, hashes, actual commands/numbers, commits and failures.
No recorded measurement deleted or rewritten. [REVIEW_QUEUE](REVIEW_QUEUE.md).

Shell contract and real geometry test first FAILED against old250px rail. Native
AppShell implements inspected237px rail/640px dock floor, single sidebar subtree,
100dvh bounded history/transcript, mobile drawer/inert/focus trap/Escape/return.
SSR single-sidebar/native-control test PASS. No backend/API capability altered.
Source geometry hashes/provenance and1CSS-pixel tolerance recorded in ADR0061.

`node evals/browser_shell.mjs <playwright> evals/results/ui-shell-browser.json`
PASS1440/820/390 and639/640px boundary cases. Rail237px, login bottom585/725/575.5px
in the three target views; document height exactly900/1180/844; no horizontal
or outer vertical growth. Desktop-mobile-desktop retains Rosé and one sidebar.
Actual screenshot inspection confirms mobile login visible without scrolling.

Existing browser's250px assertion FAILED first, deliberately updated to inspected
237px with ADR/review note, all functional assertions kept. Added mobile drawer
opening for theme/notice controls. Theme96+system3 and notice3-view keyboard/text/
centering checks rerun PASS. New NodeNext SSR compilation failed extensionless
import; named failure retained, fixed explicit .js import, web27+2/typecheck/build PASS.

Full `python tools/check.py`, `bash tools/check_rust.sh`, npm test/typecheck/build/
audit and full incremental `bash tools/smoke_all.sh` actually ran PASS; raw
ui-shell-* logs/results retained, prior smoke/supervision records restored.
`node evals/browser_meeting.mjs <playwright> <token-file>` PASS5 real workspace/
local-summary-save/transcript-preservation/oversize/mobile checks; semantic_quality=false.
`node evals/browser_microphone.mjs <playwright> <token-file> jfk.wav <asr>` first
FAILED hardcoded8766 against current8769; preserved, added optional existing-style
base override and unmasked error reporting (default/timeouts/assertions unchanged).
Rerun PASS4 real worklet/emulated-file/ASR/track cleanup/no-upload-on-cancel cases;
physical_microphone_verified=false. No WER/voice-turn or diarization claim.

Shell7691ad5 pushed; exact hosted run38133630223/all5 jobs PASS. Full Hermes fidelity, remaining screens,
real realtime voice and later roadmap still pending; no merge to main yet.
Runtime PID1327 active on8769 with .sanctum/runtime-dispatch.json for next UI slice;
source/model datasets previously untracked remain untouched.
