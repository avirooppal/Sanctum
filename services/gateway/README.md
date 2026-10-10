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

`--engine-child` is a confined guardian that supervises a separate worker process
group and reaps descendants. See `docs/contracts/process-supervision-v1.md`.
The full Rust check includes `python tools/verify_supervision.py
target/debug/sanctum-runtime`: actual TERM, gateway parent death and natural-exit
fixtures. These are process-ownership tests, not real-engine cancellation latency.

Cancellation I/O and measurement contracts: `docs/contracts/cancellable-io-v1.md`
and `dispatch-observation-v1.md`. Run `python evals/cancellation_release.py --pid
<runtime-pid> --token-file <state>/local.token --mode chat --output <result.json>`
with a ready reference runtime; repeat modes knowledge, asr, tts. This measures
lane release and recovery, not full leak or shared-model compute-stop acceptance.

Response delivery limits are in `docs/contracts/response-flow-v1.md` (ADR 0034).
Run `python evals/response_backpressure.py --token-file <state>/local.token --output
<result.json>` against the ready reference runtime for actual embedding/SSE and
burst-then-trickle upload probes.

`evals/active_shutdown.py --pid <gateway-pid> --token-file <state>/local.token
--output <result.json>` intentionally terminates that ready reference gateway after
starting real chat, ingestion, ASR, queued chat and a slow upload. It asserts the
shutdown contract in `docs/contracts/shutdown-v1.md`.
