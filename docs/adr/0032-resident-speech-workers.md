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

## Step 1-pre evidence, 2026-10-11

Pinned installed whisper.cpp source SHA
`d1be6fde11ac6e0407606b4e42fe72d34add8037` (v1.9.5, MIT;
existing Parakeet weight/source notices and ADR0023 still apply). Inspection of
`include/parakeet.h` verifies reusable context/full-decode APIs, token callbacks,
encoder-begin cancellation and ggml abort callback. `examples/server/server.cpp`
uses Whisper contexts/full-decode APIs: it is not a verified Parakeet server.
Choose a small upstream-library IPC adapter in Step1b; do not claim that the CLI
wrapper or Whisper server makes Parakeet resident. Whisper's server is a resident
alternative only for its own compatible weights; retain the swappable interface.

Confined native experiment loads the model once and decodes the real JFK fixture
three times: load **0.393086s**, loaded RSS **421024KiB**, decode times
**1.035570/0.938416/0.855571s**, warmed/peak RSS **507168KiB**.
These are isolated T0 CPU measurements, not EOS latency or a production worker.
Machine MemTotal **7976128KiB**; OS reserve25% =1994032KiB, leaving5982096KiB
for all product work. The existing proposed ASR1GiB ceiling leaves541408KiB
above this measured small-fixture peak. Keep ceiling unchanged; longer recordings,
concurrency and allocator retention require the Step1b storm/peak tests.

Admission must subtract actual model/worker RSS reservations, chat/KV/embed/Knowledge
budgets and bounded PCM/IPC buffers from the shared usable budget. Refuse warming
when insufficient; evict only idle optional workers and expose cold status. The
supervisor must sample RSS and kill/refuse a worker exceeding the configured speech
ceiling; this enforcement is **not implemented by this evaluation slice**. T1's
proposed3GiB budget remains UNVERIFIED. No hard-cap enforcement claim yet.

Pinned Flite SHA `e9e2e37c329dbe98bfeb27a1828ef9a71fa84f88` retains its reviewed
CMU license. Thirty version-only launches and thirty SLT short-text syntheses
measure process/voice overhead separately (all samples in result JSON). Version
mode intentionally returns1 in pinned `main/flite_main.c`; the probe checks this
exact code plus its version output. The initial erroneous check=True run is
preserved as failed evidence. Short synthesis p95 **0.017940378s** does not justify
a permanent Flite model worker: retain supervised per-request Flite and implement
streaming/cancellation in Step1c. Neural TTS remains swappable; selecting it needs
its own measured resident budget and permissive-license evidence. This does not
claim negligible Python/service overhead, physical playback, or T1<800ms.

Contract: `docs/contracts/speech-residency-probe-v1.md`; source/launcher and offline
rerun command: `tools/measure_speech_residency.sh`. Raw artifacts/hashes/transcripts:
`evals/results/speech-residency-reference.json`. No threshold relaxed.
