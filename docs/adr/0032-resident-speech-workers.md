# ADR 0032: Warm supervised speech workers (implementation deferred)

Proposed 2026-10-10 for Step 1b/1c, required before either starts. Current per-request
ASR/TTS CLI startup takes seconds in recorded CPU smoke runs and cannot establish
the plan's <800ms end-of-speech-to-first-audio SLO. Keep models resident in warm
supervised workers behind the existing swappable speech interfaces. This decision
does not claim warm workers alone will meet the SLO.

Use versioned, length-bounded confined IPC with request IDs, audio format and size,
remaining deadline, start/chunk/end/cancel/result/error messages. Separate control
from bounded audio queues so cancel is never stuck behind audio. Worker readiness
requires loaded-model health, not process existence. Heartbeat/deadline failures
trigger the ADR 0031 group supervisor. Restart backoff 100ms, 500ms, 2s (three tries
per minute), then unavailable until cooldown; never silently switch to cloud.
Cancellation uses the S0 context, suppresses stale output and proves compute stops.
Step 1c adds chunked TTS; Step 1d validates barge-in end to end.

Proposed profile budgets (configuration to implement, NOT measured footprints):
T0 speech residency cap 1.25GiB total (ASR 1GiB, TTS 0.25GiB); T1 cap 3GiB
(ASR 2GiB, TTS 1GiB). These are sub-budgets of total available RAM after OS reserve,
chat/KV cache, embeddings and Knowledge; never additive promises that every model
fits. Doctor must subtract measured/pinned resident requirements and keep at least
25% system RAM reserved. Reject profiles that cannot fit; evict idle optional
workers before admitting speech, with cold status visible to the owner. One warm
ASR and one TTS worker maximum initially; buffers/queues have separate caps.
Measure peak RSS and model loading on T0/T1 before promoting any profile.

For CLI-only engines, retain a confined supervised CLI adapter as a visibly cold
fallback for file transcription or explicit degraded voice mode. Preloading a
wrapper cannot remove model reload inside a CLI. Never count that fallback as the
voice latency gate; prefer an upstream persistent server/library adapter when its
license and cancellation semantics are verified. No inference kernels are rewritten.
