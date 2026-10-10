# ADR 0034: Bound response backpressure without penalizing generation pauses

Accepted 2026-10-10, before measurement. Preserve the existing two-second write
bound: pending response bytes with no progress for 1800ms cancel the request.
Use nonblocking sends checked every 5ms for cancellation and shutdown. Across
successive writes, accumulate only time actively attempting delivery, excluding
upstream generation pauses. In each two-second delivery window require >=1024
bytes/second; reset the window, not the request deadline, after each successful
window. Socket send buffer request is 16KiB (Linux may double it). Application
response buffering stays bounded to the existing 16KiB read/header limits.

Uploads retain the 15-second total and 1800ms idle bound; apply a rolling two-second
1024 byte/second floor so an initial burst cannot subsidize an indefinite trickle.
No increased timeout or weaker threshold. A stalled write must cancel within two
seconds of the last successful kernel send; worker cleanup then obeys ADR 0031.
Socket tests exercise fixed and streaming bodies with a deliberately non-reading
client. Real-engine storm and overload measurements remain separate gates.

The first socket test exceeded two seconds because kernel progress briefly reset
its idle clock. Keep the test unchanged and add a stricter 1800ms absolute bound
per pending output block (production blocks are at most about 32KiB including
headers). This also prevents a trickle from holding one block indefinitely.
