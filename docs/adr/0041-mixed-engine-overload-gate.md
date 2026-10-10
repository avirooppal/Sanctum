# ADR 0041: Measured mixed-engine overload on the CPU reference

Accepted 2026-10-10 before running this gate. Duration >=180 seconds. Run two
parallel real short chat streams (16-token budget), six background ingestion
producers, alternating real file ASR and TTS, health/models probes, dispatcher
observation, and one held-upload actor. Its idle connection is reclaimed at the
existing <=2s bound and renewed; this is not a persistent voice session. The held
authenticated WebSocket remains PENDING Step 1a, as explicitly requested.

Retain health/models p95 <=250ms, completed short chat p95 <=5s, overload refusal
<=1s. Require zero foreground request errors. Add reference file-ASR/TTS response
p95 <=5s and voice dispatch admission p95 <=250ms, measured separately. These are
Step 0 scheduling metrics, not the plan's <800ms end-of-speech/first-audio voice
turn gate, which needs the real WebSocket/warm-worker path later.

Sample queued/active counts: global queued <=8, active <=[2,1,2,1]. Sample owned
process RSS with a peak ceiling baseline persistent RSS +2GiB (covers one cold
speech job and bounded buffers), process count <=baseline+8. Background shedding
must occur. After ten seconds quiescence, exact process-role/FD/socket restoration,
threads +2 and retained RSS +16MiB per persistent role remain unchanged. Preserve
all individual latencies and sample counters. Fail on errors/bound violations;
no automatic retry, discarded samples or threshold relaxation.
