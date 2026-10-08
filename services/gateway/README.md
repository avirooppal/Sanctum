# Gateway
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
