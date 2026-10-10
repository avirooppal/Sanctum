# ADR 0033: Cancellable HTTP bridge while retaining the tested inference adapter

Accepted 2026-10-10. The existing ureq adapter blocks while waiting for HTTP headers
and response reads. Do not abandon blocking threads on cancellation, kill a shared
model server, or replace HTTP parsing with custom protocol code. The gateway's
context-bearing inference entry uses a small request-specific confined helper
supervised by the owned guardian. That helper runs the existing ureq adapter and
copies a bounded metadata frame followed by response bytes over pipes. Gateway
pipe I/O polls cancellation; dropping the reply terminates/reaps the helper group,
which closes that request's engine HTTP connection. Resident model servers remain.

This is not per-request model loading and does not implement the warm speech ADR.
It adds process overhead that must be measured in SDK/latency tests. No additional
dependency or network permission. Base URLs and paths retain numeric-loopback
validation; stdin/metadata have fixed caps. Real engine disconnect-to-compute-stop
still requires the Step 0 harness; helper exit alone is insufficient evidence.
Knowledge cancellation uses its owned worker boundary to close nested local HTTP
requests; persistent Knowledge restarts only on the next request, never replaying
a possibly committed mutation. Engine-wide shared admission remains S0-6 work.
