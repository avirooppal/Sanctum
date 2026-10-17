# Current state

- Step:cozy direction slice1;ADR0078;research/acceptance docs only.
- Last green:1df42865fe808ffcd6a404bba016cf38806deaed;hosted39055637580/all5 completed success.
- Branch:codex/cozy-design-direction;default reference/palette unchanged.
- Baseline:source182,Rust70,web81/types/build,audit0;38 denial probes;15 smoke PASS.
- Gate:new packs/gallery/contrast/screenshots/axe/performance NOT DONE;no recommendation yet.
- Blockers:two critique iterations and owner comparison;all prior backend/install gaps remain.
- Next3:contrast contract/tests;add three theme packs/gallery;real matrix/screenshots/critique.
- Default stays reference until explicit owner choice;human research UNVERIFIED.
- No full-journey,phase or release promotion;current commit/CI recorded after push.

## Evidence and boundaries

Commands:bash tools/run_source_gate.sh;bash tools/check_rust.sh;apps/web npm
 test,typecheck,build,audit --audit-level=low;bash tools/smoke_all.sh.
Actual outputs:evals/results/design-baseline-*. Baseline all green before edits.
DIRECTIONS cites22 public primary references;these are interpreted principles,
not authenticated product UI/asset audits. Prompt-kit homepage fetch failed;
upstream repository used. Perplexity homepage had no useful text;help center used.
No product code/dependency/asset changed. Existing11px design-floor conflict is
explicit in ADR0078. Default recommendation waits for actual comparison images;
there are no invented contrast/fidelity/participant numbers. First-docs slice
uses existing consistency/secret/license gates;exact-SHA CI follows push.

## Preserved history

[Previous STATUS](status-archive/2026-10-17-before-cozy-design.md),SHA256
`8019cf0889d6a2b31025a03ab418cca8c6e8c56ff12c580d689f85f27d6bf7de`. Bytes retained verbatim;older narratives remain linked.
