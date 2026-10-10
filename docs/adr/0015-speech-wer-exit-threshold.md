# ADR 0015: Do not invent the Phase 3 WER threshold

- Status: Superseded by ADR 0018
- Date: 2026-10-10

## Context

`plan.md` sets a T1 voice-turn first-audio target below 800 ms and says Phase 3 exits
when voice latency and WER meet SLOs on T1 hardware. It does not specify a WER value,
language mix, normalization policy, or named evaluation set. The available host is T0
and has no verified microphone/speaker path.

## Previous decision

Do not declare a WER pass threshold until one is explicitly established. Likewise,
report the T1 latency as unverified until benchmarked on qualifying hardware.

## Consequences

ADR 0018 establishes an initial dataset-specific numeric threshold and supersedes this
deferral. The phase still cannot exit until both required SLOs are measured on T1.
