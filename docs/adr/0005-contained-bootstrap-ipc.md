# ADR 0005: Kernel-contained bootstrap IPC before product services

Date: 2026-10-08
Status: accepted

## Context
The namespace prototype prevents Internet access but still permits host Unix socket
access via filesystem paths. Production service transport and Rust types are absent.
The host has Linux x86_64 via WSL2; other runtime containment is not validated.

## Decision
Build a Rust foundation diagnostic using a supervisor-created Unix socket pair.
Each process closes unneeded descriptors, clears capabilities, sets no_new_privs,
and installs an architecture-checked seccomp allowlist before reading request data.
Socket creation/connect, filesystem opens, exec, namespace operations, descriptor
passing, io_uring and unknown syscalls are denied. Only inherited descriptors support
communication. Startup probes must return EPERM, never merely time out.

The diagnostic uses bounded length-prefixed JSON (64 KiB maximum), carrying the
same OpenAPI envelope. This is a bootstrap test protocol, not a replacement for
the plan's HTTP/gRPC product-service interfaces. Later HTTP/gRPC adapters must run
over explicitly brokered channels with equally enforceable containment. Do not
weaken this profile to fit an engine without separate tests and an ADR.

## Consequences and verification
No network listener, model, tenant authentication, or agent sandbox is claimed.
The trusted launcher and OS remain trusted. Authorized IPC itself is a data-flow
boundary requiring later declarative policy; kernel isolation cannot infer intent.
This profile cannot run arbitrary ML engines (file opens, threads, GPU ioctls denied).
Only Linux x86_64 is supported; other targets fail closed. WSL2 tests measure this
environment, not native Windows isolation. Rust installation is developer setup,
the only online step; runtime diagnostics and subsequent tests run offline.

Kernel reference: https://docs.kernel.org/userspace-api/seccomp_filter.html
(architecture validation, no_new_privs and filter persistence). CI/runtime scripts
pin Rust 1.99.0 and Cargo.lock; crates are reviewed in profiles/registry.json.
