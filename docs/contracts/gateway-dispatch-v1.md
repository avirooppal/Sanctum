# Gateway dispatch v1 — admitted HTTP requests

Four lanes: control (health/models/static metadata), voice, interactive chat,
background Knowledge work. Defaults: active limits 2/1/2/1, total six workers,
eight queued requests. Select voice before chat before background, with separate
control capacity. Admission never blocks: full/closed queues return 503 with
`Retry-After: 1`. Queued jobs expire after 10 seconds and return the same response.
Existing routes/auth/body-size contracts remain unchanged. SQLite and Knowledge
IPC are individually serialized; never hold their locks during unrelated inference.

This contract covers admitted requests only. The current tiny_http accept/parser
connection limits, slow-client timeouts, WS limits, per-engine coordination across
Knowledge/chat, and disconnect cancellation are not established by this slice.
Do not declare Step 0 complete on dispatch tests alone.
