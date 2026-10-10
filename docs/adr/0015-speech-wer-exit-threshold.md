# ADR 0015: Do not invent the Phase 3 WER threshold

- Status: Accepted
- Date: 2026-10-10

## Context

`plan.md` sets a T1 voice-turn first-audio target below 800 ms and says Phase 3 exits
when voice latency and WER meet SLOs on T1 hardware. It does not specify a WER value,
language mix, normalization policy, or named evaluation set. The available host is T0
and has no verified microphone/speaker path.

## Decision

Implement a WER harness that reports normalized reference/hypothesis counts and WER,
but do not declare a WER pass threshold or a Phase 3 pass. Preserve threshold as
unverified until an explicit requirement is established. Likewise, report the T1
latency as unverified until benchmarked on qualifying hardware.

## Consequences

Phase 3 implementation can proceed behind stable interfaces and measured evaluation
tools. The phase cannot exit, and Phase 4 cannot start, until a numeric WER target is
defined and both required SLOs are measured on T1 hardware. No performance value is
fabricated from this T0 environment.
