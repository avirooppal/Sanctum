# Response flow v1

Transport-independent delivery budget: advance(elapsed_delivery_time, sent_bytes)
returns an error if a two-second window averages below 1024 bytes/second. Only
pending-byte delivery time counts; inference pauses do not. Cancellation/deadline
and shutdown are checked on every nonblocking send attempt. No-progress writes
expire at 1800ms. Both fixed and streamed responses share this path. No retries
or replay after partial response delivery. Uploads use a rolling wall-time budget.
