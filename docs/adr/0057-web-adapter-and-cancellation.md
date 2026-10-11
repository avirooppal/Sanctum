# ADR0057: typed same-origin adapter before the renderer port

2026-10-11. Use the existing Sanctum HTTP and realtime contracts; do not import
Hermes API/Portal/Electron clients. Owner token is an instance-only field. Requests
omit cookies, refuse redirects, do not retry writes, and forward AbortSignal.
Chat models/history/streaming are wired into the existing screen now; voice
transport helper does not advertise a speech pipeline that the backend lacks.

Models/history are checked at runtime; streamed UTF8 and SSE line fragments are
decoded incrementally. Consumer stop or AbortSignal cancels the reader and removes
the listener, including a stalled test source whose fetch ignores abort. The
tests-first stalled-reader case uses a2000ms test-runner guard; it originally
timed out, then passed after reader cancellation was wired. This is a unit-test
hang guard, not a changed server deadline or measured engine p95 gate.

Actual browser execution found native fetch receiver binding failure missed by
arrow-function fakes. Preserve that failed run, add a strict-receiver regression,
bind the default native fetch to globalThis, rebuild and rerun actual HTTP chat,
saved turns and ticket-authenticated WebSocket. Actual close1000, transport-only
capabilities, no credential/draft storage and zero foreign HTTP origins observed.
Do not call this whole-UI egress/fidelity completion: all new screens and a
WebSocket-aware all-origin blocking harness remain necessary for U6.

The browser adapter check intercepts only a same-origin test module containing
compiled first-party adapter code. All gateway/model/storage/WebSocket requests
are real. No mock model or gateway, no CSP weakening, no production debug export.
No new dependency, product timeout, threshold or scope exception.

Strict-receiver tests-first console output contains trailing spaces produced by
Node's assertion formatter. Preserve its exact bytes with a path-specific Git
whitespace exception, analogous to0042; retain the failed whitespace check too.
No code/test formatting exception. STATUS milestone narratives are archived
verbatim under the same0042 policy, with SHA256 recorded.
