# ADR 0039: Explicit cancellation for the single-owner runtime

Accepted 2026-10-10. Add authenticated POST /v1/cancel with an empty body to cancel
currently forwarded active/queued engine requests. This is a local owner action,
not a tool or remote connector. It targets voice/chat/background contexts, leaving
control requests (including the cancellation response and health probes) running.
First terminal reason still wins. Return the count of targeted contexts and log a
content-free explicit-cancellation count. No mutation replay or inference retry.

This minimal endpoint permits real explicit-cancel storms in Step 0. It does not
implement WebSocket cancellation, per-message session control or the Privacy Ledger.
Headers/body-in-progress have not been forwarded and retain their existing strict
idle/total/shutdown bounds. Gate: unauthorized calls rejected; real engine jobs
cancel through the same context, clean their owned work and meet ADR 0031 bounds.
