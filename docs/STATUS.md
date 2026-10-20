# Current state

- Step: M0 baseline/decision checkpoint; `jan-style`; ADR0084 and plan amendment.
- Archive tag pushed: `pre-pivot-2026-10-20` -> `1bee37bc777318b1913aac0a95eb9315e29cfa05`.
- Baseline observed: 184 source, 70 Rust, 95 web/types/build, audit0, 38 denial probes.
- Post-change checks: 187 source (3 new measurement tests), 70 Rust/38 probes, 95 web PASS.
- Full implemented-feature smoke: 19 stages PASS on attempt4; earlier failures retained.
- Initial chat JS101141B gzip; web build2139977B. Native desktop metrics UNVERIFIED.
- Gateway-only diagnostic: RSS5898240B, CPU1.498427% one core; not desktop acceptance.
- Starting head and remote main: hosted completed/success all5, receipts saved.
- New pivot-head hosted CI: pending commit/push and exact-SHA observation.
- M0 removals/salvage and M1–M12: PENDING; old website/Hermes work still present.
- Next: removal/salvage review, then pinned Jan study and architecture decisions.
- No merge, release, whole-product completion, or desktop performance claim.

## Evidence

`evals/results/pivot-m0-baseline-*`; `docs/PERFORMANCE.md`; ADR0084.
Failures: missing smoke environment, no gateway, history-search timeout.
Isolated history diagnostic and unchanged full rerun passed; timeout cause
unproven. Vite upstream directive warnings retained. Budget proposals do not
change existing thresholds. New measurement-tool verification recorded separately.

## Preserved history

[Previous STATUS](status-archive/2026-10-20-pre-pivot.md), SHA256
`e384a214c5e23d03965e5e7d396121c4a126e17910e6e26686a7692350d74ba1`.
