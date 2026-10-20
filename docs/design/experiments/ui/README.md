# B3 UI Stack Experiments

Isolated experiments comparing UI stack candidates for Sanctum Desktop (Milestone 3).

## Scope
- Not product code; isolated from `apps/web`.
- Candidates evaluated: React 19 vs Preact 10.
- Chat-screen skeleton: thread list, streaming message list, composer, collapsible settings drawer.
- Measurements: gzipped JS bundle size, dependency count, license surface, `npm audit`, memory overhead.
- Authority: ADR 0092 (B3 UI stack candidate evaluation).
