# Desktop release checklist

This is a development pivot, not a release. No GitHub release may be created.
ADR0084/0085 supersede website/Hermes requirements; prior checklist history is
archived with SHA256 in ARCHIVE.md. Main is not changed by this branch.

| Gate | State | Evidence / owner action |
|---|---|---|
| Archive | Recorded | `git rev-parse 'pre-pivot-2026-10-20^{commit}'`: 1bee37bc777318b1913aac0a95eb9315e29cfa05 |
| UI retirement | Implemented | ADR0085, docs/legacy-ui-removal.json; gateway refuses retired routes |
| Retained runtime/library | Checks recorded in STATUS | Source/Rust/web tests and eight-stage real smoke; not desktop acceptance |
| Native desktop metrics and enforced budgets | PENDING | PERFORMANCE.md contains legacy measurements only; M1/M2 must implement native runners |
| Jan source/LICENSE/NOTICE; shell/MPL | PENDING M1 | No Jan adaptation or MPL exception admitted |
| Providers, tools/MCP, computer use, packs | PENDING | Full contracts, safety, evaluation and journey evidence required |
| Windows .exe, Linux .deb/AppImage | UNVERIFIED | Build/install runners absent; M11 must implement before exact owner install commands can exist |
| macOS artifacts | UNVERIFIED | No Mac session or installer runner |
| Signatures, SHA256SUMS, SBOM, clean installs | UNVERIFIED | No current native artifacts; old ignored dist quarantined; legacy package_linux.sh refuses output |
| Native OS egress assurance | UNVERIFIED | Linux kernel checks do not certify Windows/macOS helper enforcement |
| Hosted CI exact head | Must be observed after each push | Raw receipt in evals/results/pivot-removal-hosted-ci.json when observed; an earlier SHA does not certify a later commit |
| Full acceptance | PENDING | No full journey or native size/RSS/CPU/cold-start claim |

## Available development verification commands

Run `bash tools/run_source_gate.sh`, `bash tools/check_rust.sh`,
`npm test --prefix apps/web`, `npm run typecheck --prefix apps/web`,
`npm run build --prefix apps/web`, `npm audit --prefix apps/web`.
Provision the documented README smoke environment and real runtime, then run
`bash tools/smoke_all.sh`. `SANCTUM_RELEASE_GATE=1` must refuse release acceptance.
These are executable development checks, not invented native installer commands.
Missing native runners remain software blockers, not accepted OS exceptions.

## Full journey status

| ID | Status | Acceptance test ID | Blocker |
|---|---|---|---|
| J1 | PENDING | journey:J1 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Signed installers/bundle verification absent |
| J2 | PENDING | journey:J2 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Real hardware onboarding/import progress missing |
| J3 | PENDING | journey:J3 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Journey budgets/chaos/ledger not established |
| J4 | PENDING | journey:J4 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Folder/progress/restart and quality gates incomplete |
| J5 | PENDING | journey:J5 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Full resident WebSocket voice/barge-in absent |
| J6 | PENDING | journey:J6 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Recording,diarization and speaker-note pipeline absent |
| J7 | PENDING | journey:J7 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Vision/OCR/indexing/evaluation absent |
| J8 | PENDING | journey:J8 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Governed agent runtime/policy/ledger absent |
| J9 | PENDING | journey:J9 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Startup self-test exists;Privacy Ledger absent |
| J10 | PENDING | journey:J10 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Prerequisite policy/ledger/broker absent |
| J11 | PENDING | journey:J11 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. LAN/crypto/update/full-purge contracts incomplete |
| J12 | PENDING | journey:J12 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Unified recovery,diagnostics and chaos evidence absent |
