# ADR 0018: Set initial English speech WER gates

- Status: Accepted
- Date: 2026-10-10
- Supersedes: ADR 0015

## Context

`plan.md` requires WER to meet an SLO on T1 hardware but gives no numeric threshold or
dataset. ADR 0015 deferred the decision. The project instructions direct us to resolve
ambiguities with a documented, minimal decision. A clean-read benchmark alone would
miss degradation on harder audio.

## Decision

Use the licensed English LibriSpeech evaluation splits as the initial repeatable gate:
weighted corpus WER must be at most 0.10 on `test-clean` and at most 0.20 on
`test-other`. Use the evaluator's Unicode normalization, case folding, punctuation
removal, and whitespace tokenization. Record dataset/split identity, CC BY 4.0 license,
audio SHA-256 values, profile, and hardware tier in each result. Both targets must pass
on T1 hardware; T0/T2 results are diagnostic only. This English gate does not represent
accuracy in other languages, accents, or conversational audio, which remain future
coverage requirements.

## Consequences

The previously missing numeric threshold is now explicit. The dataset is available from
[OpenSLR 12](https://www.openslr.org/12/), which identifies LibriSpeech as CC BY 4.0.
No WER pass is claimed until real local inference runs over the licensed splits on T1.
