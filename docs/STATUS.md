# Current state

- Slice: M0 legacy UI retirement on jan-style; ADR0084 and ADR0085.
- Archive tag: pre-pivot-2026-10-20 -> 1bee37bc777318b1913aac0a95eb9315e29cfa05.
- Fresh before-change baseline: source187, Rust70/38 denial probes, web95,
  all19 old implemented-feature smoke stages PASS.
- Retired1017 tracked paths, each archived Git-blob SHA256 in legacy-ui-removal.json.
  Website/docs HTML, old shell, reference/mock bridge, themes/assets and their
  fidelity/browser gates are gone. Eleven first-party modules remain as a dev library.
- Rechecked: source183, Rust70/38 probes, web45, types/build PASS, npm audit0.
  Test reductions are explicit ADR0085 scope changes; numeric budgets unchanged.
- Real smoke: all8 stages PASS: chat, RAG, file ASR/TTS, tickets, purge safety,
  12 journey readiness checks, and real retired-route/browser Markdown safety.
  Full journey acceptance remains false. Supervision checks: zero surviving children.
- Red contracts preserved: old root returned200 instead of404; old runtime bundle
  included web assets. Both fixed without weakening assertions.
- React19.1.1 and React DOM license exact bytes verified at upstream source;
  remaining dependency admission gates pass; no Jan code or MPL exception introduced.
- Old ignored upstream environment/dist and67 untracked UI result files quarantined
  locally under .sanctum/retired/2026-10-20; unrelated user files preserved.
- Main remains a1342cdb3a8b06b74b61e79954740a39e36b3d7b (remote observed).
  Hosted CI must be polled after this slice is pushed; earlier SHA receipts do not
  certify this change. Consult the exact-SHA receipt and final slice report.
- M1 next: pin/study Jan, verify LICENSE/NOTICE, choose shell/MPL policy and record
  packs/settings/permissions/egress/assurance architecture. M2–M12 remain PENDING.
- No replacement app UI, native installer, native performance acceptance or full
  product security claim. PERFORMANCE.md retains scoped legacy measurements only.

## Commands and evidence

`bash tools/run_source_gate.sh evals/results/pivot-removal-source-final.log`: PASS183.
`bash tools/check_rust.sh`: PASS70/38, pivot-removal-rust-attempt1.log.
`npm test --prefix apps/web`: PASS45, pivot-removal-web-final.log.
`npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`: PASS.
`npm audit --prefix apps/web --json`: zero, pivot-removal-audit.json.
Provisioned README environment, then `bash tools/smoke_all.sh`: PASS8,
pivot-removal-smoke-attempt1.log and pivot-removal-smoke-all-reference.json.
All are development checks, not full owner journey acceptance. Current smoke
scope is in docs/contracts/smoke-all-v1.md. No new desktop feature is exposed.

## Preserved history

ARCHIVE.md records exact prior STATUS/workflow/checklist SHA256 values and paths.
Named baseline, expected red failures and post-change results use pivot-removal-*.
Earlier UI-only evidence lives in the archive commits, not the active results tree.
