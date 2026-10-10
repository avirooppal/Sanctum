# ADR 0035: Cross-process admission per engine

Accepted 2026-10-10. Route worker limits are insufficient: Knowledge calls the same
chat/embedding engines as direct routes. Use owner-only advisory lock files under
<state>/engine-admission, keyed by numeric engine port. Rust and Python acquire the
same nonblocking flock slots before HTTP work. Chat/embedding have two admitted
requests total (including the engine's waiting request), one slot unavailable to
background work. Interactive callers prefer the reserved slot. Reranking has one
shared slot. ASR/TTS each have a one-slot permit held around their owned job.
These bound admitted work; llama.cpp still executes one model slot at a time.

No extra wait queue: exhaustion returns 503 with Retry-After: 1. OS releases locks
on cancellation/process death; hold inference permits through response-body drop,
not merely headers. Knowledge/meeting/ingestion nested calls are background;
health performs no engine admission. Existing dispatcher queues remain bounded.
Do not claim preemption of an already executing background operation. Mixed-load
latency must be measured separately. Stable runtime config remains compatible.
