# Cancellation v1

Internal Rust contract: Cancellation::new(absolute_monotonic_deadline), clone(),
cancel(Reason), check(), remaining(). Clones share terminal cancellation state.
Reasons: Disconnect, Deadline, Shutdown, Explicit. First observed reason wins;
cancellation is idempotent and irreversible. Expiration is cancellation even if no
timer thread runs. check returns an error before starting new work after cancel.

The admitted HTTP job or authenticated WebSocket session owns the context. Every
inference, Knowledge/ingestion and speech call receives it explicitly, including
nested operations. Transport maps private peer identity to context, never an
untrusted client header. Deadline uses Instant internally; future IPC must convey
remaining duration rather than trusting a client wall clock. No public API schema
is removed. Existing Engine::send callers remain source-compatible; the additive
send_with_context method is the supervised-runtime entry.

Completion removes association/leases. Cancellation must close request-specific
engine I/O, cancel owned work, and release the worker only after cleanup. Context
unit tests alone do not prove those effects. ADR 0031 defines measured acceptance.

Runtime implementation: context-aware nonblocking pipes interrupt Knowledge and
request-specific inference helpers. Cancellation terminates their owned process
groups, closing nested HTTP requests. Speech polls the same context and terminates
its guardian group. Knowledge restarts on a subsequent request without mutation
replay. The legacy default Engine method remains preflight-only; the runtime uses
the supervised override. Shared-model compute cessation, global engine permits,
resource storm recovery and authenticated WebSocket propagation require their own
gates; context presence alone proves none of them.
