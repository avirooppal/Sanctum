# Solo storage/auth v1

SQLite (WAL) local store: conversations(id, owner), turns(conversation, request JSON,
raw JSON/SSE response, stream flag). Parameterized queries always constrain owner.
Single local principal `local-owner`; Phase 2 adds authenticated workspace/ACL context.
API keys are 256 random bits, stored in a mode-0600 file. Existing unsafe file modes
or malformed tokens refuse startup. Comparison does not short-circuit on byte mismatch.
API never accepts user IDs as identity. All /v1 routes require Bearer authentication.
Static UI and health are local; no telemetry/third-party assets. CORS is not enabled.
