# ADR 0046: Measure a smaller inference CPU budget alongside speech

Proposed experiment 2026-10-11, not a production profile decision. Corrected voice
timer passed its contract but mixed run FAILED ASR p95 8.550405s after183.519277s;
chat4.727241s still within5s, health/models within250ms, no foreground errors.
Preserve `slot-policy-mixed-overload-voice-accounting.json`; do not attribute the
tail solely to the timer. Cold idle ASR2.347–2.619s indicates available compute can
meet the file gate, but admission alone does not bound an already-running engine's
CPU/memory-bandwidth contention.

Use the existing runtime config field to test inference threads2 instead of4
(all three inference roles), keeping ASR6, model hashes, context2048, slot policy,
caller deadlines and every latency/resource/cancellation bound unchanged. Config
is `.sanctum/runtime-dispatch-inference-threads2.json`; original profile/config
remain unchanged during this experiment. No kernel change or process suspension.

Cost: embedding/rerank throughput and latency may worsen. If mixed lanes pass,
measure cancellations and throughput before adopting the profile; if a bound fails,
do not raise it. A per-role budget may be needed rather than reducing every engine.
The entire real reference gate must pass before any production default is changed.

## Adoption evidence, 2026-10-11

Adopt threads2 in `profiles/runtime-cpu.json` for this reference; ASR6 unchanged.
Other hardware is not claimed benchmarked. Mixed182.050947s: health/models p95
0.007744/0.006122s, chat3.121071s, ASR2.552289s, TTS0.870216s; no foreground errors.
Queue2, peakRSS3416240KiB, retained per-role worst14116KiB. Final500 cancellation
and flood gates PASS with worst retained7376KiB; exact FD/socket/role restoration.
Active/repeated shutdown all<5s, zero survivors. No gate relaxed.

Same real3-doc/23-chunk paired corpus: one-input9.923005 docs/min,1.267940 chunks/s,
versus original four-thread one-input8.073704/1.031640 (+22.905242% throughput).
Within two-thread config, one-input versus whole-document cost2.190560%; vector
difference0.0. All repetitions retained. This limited corpus is not a universal
CPU scaling promise. Config/hardware/hash provenance is in named eval results.
