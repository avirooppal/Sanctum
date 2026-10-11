# ADR 0045: Count voice-blocked time separately from engine-queue waiting

Proposed 2026-10-11 before implementation/rerun. Candidate slot reuse passed500
cancellation/resource checks, then FAILED183.030373s mixed load: ASR p95 6.597817s
>5s; health/models/chat and voice admission remained within their bounds, no
foreground errors. Preserve `slot-policy-mixed-overload-asr-failure.json`.
Five idle ASR files took2.346713–2.618517s with identical transcripts (named result).
This indicates contention; the timer issue below is a hypothesis to verify, not a
claim that it is the sole cause.

Current foreground deferral uses elapsed time since entering the execution wait.
Time waiting behind an already-running model spends that budget even when no voice
job exists. If voice starts later, it gets less than the intended2500ms protection.

Track only intervals blocked by the voice lease. Keep cumulative foreground
voice deferral capped2500ms per request, background yielding for the full voice job,
10ms cancellation polling, original absolute caller deadline and all existing
health250ms/chat5s/speech5s/resource/cancellation/shutdown gates. No replay or pause
of an executing engine. A queued foreground request may wait longer overall because
its earlier model wait no longer consumes voice protection; measure that cost.

Contract regression: hold execution first, start foreground waiting, introduce
voice after700ms, release execution, and require the original2500ms voice allowance
to remain available. Existing continuously-held-voice <3s and canceled-background
tests remain unchanged. All real candidate gates must be rerun; if either lane
misses its unchanged latency gate, fix or restore policy rather than raising it.

## Follow-up evidence, 2026-10-11

The corrected-timer four-thread mixed run FAILED ASR8.550405s, so accounting alone
did not solve contention. Keep that failure and the original regression evidence.
Adopt the contract-correct accounting only with ADR0046's measured CPU budget;
that combined configuration passed mixed lanes,500 cancellations/resources and
active/repeated shutdown. All original tests and numeric bounds retained.
