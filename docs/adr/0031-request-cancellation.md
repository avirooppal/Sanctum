# ADR 0031: Shared cancellation and owned engine work

Accepted 2026-10-10. Every admitted request owns one cloneable cancellation context
with a monotonic absolute deadline and first-wins reason: disconnect, deadline,
shutdown or explicit cancel. A future authenticated WebSocket owns the same type;
its implementation remains Step 1a. No engine may create a fresh deadline that
extends its caller's budget. Context lives in the inference interface crate to avoid
a gateway/inference dependency cycle. Existing Engine::send remains compatible;
the gateway uses the additive context-bearing interface.

The ingress associates the private upstream socket address with the context before
sending headers; caller headers cannot forge this association. Dispatcher jobs own
context clones even after ingress cleanup. Removing the association must not retain
completed requests. Transport completion is not evidence of engine cancellation.

Predeclared Step 0 acceptance: per-engine disconnect-to-slot-release p95 <=2s over
at least 50 cancellations per engine, no sample >3s; active shutdown <=5s.
Cooperative cancellation gets 100ms, process-group SIGTERM gets 400ms, then SIGKILL
and reap within another 500ms. Polling I/O/cancellation interval <=50ms. Child
processes inherit confinement, have a separate owned group, and parent-death
handling. Persistent workers restart after cancellation/failure with bounded
backoff; only the affected request fails. Never kill a shared engine to cancel
another caller's work. Engine request cancellation must be tested independently
from gateway slot release.

Retain ADR 0028/0029 thresholds: health/models p95 <=250ms, short chat <=5s,
overload rejection <=1s, process/FD/socket counts return to warmed baseline,
threads within +2, retained RSS within +16MiB after 10s quiescence. For loaded
engines compare each process with its warmed baseline; model-residency memory is
not an allowed leak. Mixed-engine overload lasts >=180s with sampled queue depths
and RSS. No results or threshold exemptions are implied by this ADR.

Implementation order: context and propagation, owned process supervision, polling
engine I/O, response throughput, shutdown, shared engine admission, real storms
and soak. Intermediate green slices do not satisfy the aggregate Step 0 gate.
