# Gateway

Admitted HTTP requests now use six bounded workers: control 2, voice 1, chat 2,
background 1; eight waiting requests, ten-second queue expiry. Overload returns
503 with Retry-After=1. See `docs/contracts/gateway-dispatch-v1.md` and ADR 0028.
Run `cargo test -p sanctum-gateway --test dispatch`; live integration is
`python evals/gateway_dispatch.py --token-file <path> --output <path>` on port 8769.
Connection/parser bounds, disconnect cancellation and bounded slow-client shutdown
remain pending; this is not a completed realtime transport or Step 0 gate.
Rust local HTTP gateway and strict foundation diagnostic. OpenAPI contracts live
in docs/contracts/{chat,runtime,diagnostics}.openapi.json. Chat requires a random
local bearer key, stored mode 0600 under a mode 0700 state directory. SQLite stores
request/response turns and owner IDs. The current principal is local-owner;
workspace authorization arrives in Phase 2. Bound to 127.0.0.1 only.

Run `target/debug/sanctum-runtime --config profiles/runtime-cpu.json`. Omit config
for health-only diagnostics. Config selects engine files/hashes, model aliases,
ports, context, threads, state directory and UI directory. Runtime startup first
creates private user/network namespaces, drops capabilities and installs inherited
seccomp restrictions; each engine child rechecks the boundary before exec. No
network route, host Unix sockets, namespace escape or cloud downloads are allowed.

Run `bash tools/check_rust.sh`; official SDK integration uses evals/sdk_chat.py.
Signals stop the gateway and reap children; parent-death signals stop orphan engines.
This is trusted-engine egress containment, not a hostile-code filesystem sandbox.

Public ingress limits and framing restrictions: `docs/contracts/ingress-v1.md`
and ADR 0029. HTTP keep-alive is disabled; uploads require Content-Length.
Run `python evals/ingress_limits.py --binary target/debug/sanctum-runtime --output
evals/results/ingress-limits.json` and the same arguments with
`evals/ingress_overload.py` (180 seconds). These tests use a real isolated listener
without engines; they do not prove engine cancellation or full graceful shutdown.
Browser speech/meeting harnesses accept `SANCTUM_BASE_URL` for the tested listener.
