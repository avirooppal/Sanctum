# Bootstrap diagnostic IPC v1

`sanctum-foundation check` reads one JSON request envelope from stdin (max 64 KiB)
and emits one bootstrap.schema.json response on stdout. It is an offline diagnostic,
not an authenticated public endpoint. Identity fields are fixtures/caller assertions;
product gateway authentication must construct envelopes in Phase 1.

Supervisor and worker are separate processes; no listening port. On their inherited
Unix stream, each frame is a 4-byte big-endian unsigned length followed by UTF-8 JSON.
Zero-length, oversized, truncated, malformed and schema-invalid frames fail closed.
IPC sockets have a five-second idle timeout. Only one request/response per child;
the supervisor always reaps or kills/reaps the child. Unknown JSON fields are rejected.
Success preserves trace_id; no prompt/doc content is returned by this diagnostic.

Both processes must pass their own kernel startup self-test before handling the
envelope. Failure returns a nonzero exit and never an accepted response. Direct
`--worker` requires inherited Unix stream stdin/stdout; ordinary terminal invocation
is refused. No override disables containment. Linux x86_64 only at this stage.
