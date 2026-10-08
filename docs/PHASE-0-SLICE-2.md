# Phase 0, slice 2 — Rust contracts and kernel-contained local IPC

Plan, 2026-10-08 (written before implementation):

1. Specify a bounded bootstrap IPC contract and shared envelope fixtures.
2. Write Rust contract tests and subprocess security tests before implementation.
3. Add a Rust workspace with gateway envelope types and policy containment library.
4. Implement a Linux x86_64 foundation supervisor/worker diagnostic using inherited
   Unix socket pairs. Both processes install default-deny seccomp before requests.
5. Test blocked IPv4/IPv6 TCP/UDP, Unix sockets, filesystem opens, process execution,
   namespace changes, and allowed local IPC. Compare actual output to schema.
6. Run Python/Rust checks, inventory permissive dependencies, record real results,
   update STATUS and commit a green slice.

Interfaces: OpenAPI envelope; JSON Schema bootstrap request/response; bounded
length-prefixed local IPC. This diagnostic is not a public gateway/API or engine.

Risks: Linux syscall ABI differences, privileges/inherited handles, unbounded reads,
schema drift, toolchain download, CI kernel restrictions. Fail closed on unsupported
platforms or failed installation/probes. Retain native Windows/macOS as unverified.
