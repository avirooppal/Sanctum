# Web adapter v1

Browser adapter over existing Sanctum contracts, not an upstream gateway client.
Owner credential exists only in the client instance's memory. Every HTTP request
uses a fixed same-origin /v1 route, credentials:omit, cache:no-store, redirect:error
and caller cancellation signal. No retries, storage, analytics or external URLs.
Conversation IDs are encoded as a single path component. Models and conversation
response shapes are checked before use; backend errors surface once.

Streaming chat is decoded incrementally across UTF8/network/line boundaries.
Yield only actual content deltas; accept [DONE], reject malformed events, cancel
the reader when the caller stops consuming. A canceled request must not yield
stale output, including when a test fetch ignores abort.

Realtime obtains an empty authenticated POST ticket, validates the version and
64-hex single-use ticket, then connects to the current origin's /v1/realtime
using the protocol header. Never put credentials in a URL. No reconnect/retry.
Abort before handshake cancels ticket issuance; abort after connection closes
the socket. Speech remains unavailable until the server advertises it.

Tests: no storage/foreign paths/cookies/redirects/retries, malformed responses,
encoded identifiers, fragmented Unicode/SSE, abort and reader release, invalid
ticket, same-origin WebSocket ticket headers and post-ticket abort.
