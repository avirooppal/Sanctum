# ADR 0016: Measure voice first-audio latency at p95

- Status: Accepted
- Date: 2026-10-10

## Context

`plan.md` sets an end-of-speech-to-first-audio target below 800 ms but does not define
how a multi-turn benchmark aggregates latency.

## Decision

Report p50, nearest-rank p95, and maximum first-audio latency. Use p95 <800 ms as the
phase SLO gate so a fast median cannot hide a meaningful tail. Preserve individual
records and do not claim a pass unless the report states hardware tier T1.

## Consequences

The 800 ms threshold remains the plan's value; p95 is the explicit aggregation rule.
Results from T0/T2 or synthetic clocks remain informative measurements but do not pass
the Phase 3 T1 latency exit criterion.
