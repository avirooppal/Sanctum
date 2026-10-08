# Gateway foundation (Rust)

Implemented: typed, validated request envelope; bounded bootstrap framing; a separate
supervisor/worker diagnostic. No public HTTP API, authentication or model routing yet.

Contracts: docs/contracts/diagnostics.openapi.json (RequestEnvelope),
docs/contracts/bootstrap.md and bootstrap.schema.json. The diagnostic takes caller
assertions, not authenticated identities. HTTP/gRPC product interfaces remain pending.

On Linux x86_64 (including WSL2), after explicitly online Rust setup and
`cargo fetch --locked`, run from repository root:

```sh
cargo build --locked --offline --workspace
python3 tools/verify_containment.py target/debug/sanctum-foundation
bash tools/check_rust.sh
```

Config: maximum IPC payload 64 KiB, five-second socket idle timeout. Cloud connectors
must be empty. Unsupported platforms and all startup probe failures return exit 78.
No flag bypasses kernel containment. Supervisor stdin/stdout/stderr cannot be sockets.
The child receives a cleared environment, inherited Unix stdin/stdout and null stderr.

Tests: `cargo test --locked --offline -p sanctum-gateway`. Includes shared schema
fixtures, frame bounds/truncation, separate-process security probes, invalid inputs,
and rejection of unapproved process transport. No production privacy claim yet.

Runtime health (Linux x86_64): `target/debug/sanctum-runtime --port 8765`.
GET /healthz is served through a host-loopback socket after entering private
user/network namespaces and applying the runtime filter. No external route exists.
`--test-child` verifies exec inheritance; `--once` serves one health request.
Contract: docs/contracts/runtime.openapi.json; ADR 0006 describes the boundary.
