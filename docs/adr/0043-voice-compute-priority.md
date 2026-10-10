# ADR 0043: Reserve new compute admission for voice on the CPU reference

Accepted 2026-10-10. First >=180s mixed run FAILED file-ASR p95: 8.121609s >5s.
No foreground errors; health/models/chat passed, queued peak three, owned RSS peak
3404240KiB. Retain `mixed-engine-overload-asr-failure.json`. Idle five-file timings
3.502–4.283s show compute contention rather than dispatch: voice admission p95
was 75.422ms. Measured thread candidates (same transcript in every case): four
threads 3.004–3.345s; six threads 2.559–2.852s on this 12-logical-CPU reference.

Use six threads in the named reference ASR profile; record the actual profile in
the test result. Other hardware must select an appropriate profile, not assume six.
Add an owner-private voice-priority lease while speech executes. New inference
execution waits cancellably while this lease is held; current model work finishes
normally, with no process suspension, replay, kernel replacement or warm speech
implementation. Both Rust and Python obey the lease; health/control bypass it.
This implements voice > inference admission on the CPU reference while retaining
all existing bounds. It must meet both five-second speech/chat gates under load;
if either fails, fix/rerun rather than changing thresholds.

Second mixed run FAILED chat p95 11.261964s >5s; speech now passed (ASR p95
3.837983s). Preserve `mixed-engine-overload-chat-failure.json`. Narrow voice compute
yielding to background work; interactive chat remains admitted. No latency bound
changed. Retain the background wait/cancellation test and add interactive progress
under the same held voice lease. The CPU reference keeps six ASR threads.

Third run with background-only yielding FAILED ASR p95 6.404672s >5s;
keep `mixed-engine-overload-background-asr-failure.json`. Refine foreground admission
to wait at most 2500ms while voice is active, then proceed even if voice continues.
Background still yields for the full voice job. This bounds chat starvation and
reduces overlapping compute. Caller cancellation remains checked every 10ms;
health/control and all five-second latency thresholds remain unchanged. Keep the
background cancellation test and verify foreground progress within three seconds
under a continuously held voice lease. Measure the actual combined gate again.
