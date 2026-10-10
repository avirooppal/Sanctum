# ADR 0029: Bounded ingress before the existing application dispatcher

Accepted 2026-10-10. Retain existing tested HTTP handlers and put a Rust loopback
ingress guard in front of their private-namespace listener. Parse headers with
MIT OR Apache-2.0 httparse 1.10.1, checked against crates.io metadata and archive
checksum. Do not expose tiny_http's independently accepting listener on the host.

Limits: OS accept backlog 32; at most 24 admitted TCP connections, at most 8 parsing
headers; header completion 2 seconds, 16 KiB, 64 fields. Lane connections:
control 4, voice 2, chat 4, background 2. One HTTP request per connection, explicit
Connection: close (HTTP keep-alive is disabled; idle keep-alive count is zero).
HTTP framing ambiguity is rejected. Fixed-length body maxima: voice upload 8 MiB,
TTS/chat 1 MiB, background 15 MiB, control zero. Transfer-Encoding requests are
rejected with 411 in this first transport slice; this is a documented transport
compatibility restriction, not removal of any existing API payload contract.
SDK and browser clients use Content-Length and must be reverified.

Body completion <=15 seconds, >=1024 bytes/second after a 2-second grace, response
write stall <=2 seconds, total connection lifetime <=330 seconds (existing Knowledge
deadline is 300). Connections above limits close immediately with bounded stderr
reason counts (no credentials, paths or content); lane overload returns 503 and
Retry-After=1. Transport disconnect closes both sockets; cancellation of underlying
engine work is a separate remaining Step 0 requirement, not inferred from closure.

Shutdown stops accepts and closes transport sockets; application worker/process
shutdown bound remains unverified until cancellation is integrated. WebSocket
upgrade plumbing is reserved for the same connection leases, but the first slice
returns 501 for Upgrade. PENDING: re-run against the real authenticated WebSocket
in Step 1a. Step 0 is not complete on these results alone.

Leak-test tolerance for forthcoming full stress gates: processes and FDs return
exactly to warmed baseline, threads within two persistent HTTP helper threads,
RSS growth <=16 MiB after 10-second quiescence (allocator retention), zero surviving
test client sockets. Soak must also show no increasing retained-resource trend.
Retain ADR 0028 responsiveness/overload thresholds; do not change them to fit results.
