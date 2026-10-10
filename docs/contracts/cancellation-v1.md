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

Initial implementation scope: context shared through ingress/queue and Rust engine
entry points. The backward-compatible default send_with_context rejects already
cancelled work but delegates to legacy send; it does not interrupt in-flight I/O.
Knowledge nested Python calls and speech children are not yet cancellation-aware.
S0-2/S0-3 must replace these blocking paths before S0-1 propagation can be called
complete end to end. Do not infer acceptance from the presence of the parameter.
