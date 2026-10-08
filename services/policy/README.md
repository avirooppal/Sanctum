# Policy foundation (Rust)

Implemented: Linux x86_64 containment primitives for the foundation diagnostic.
Declarative OPA/Cedar authorization, data-flow rules and agent approvals are pending.

Contract: docs/contracts/bootstrap.md; design: docs/adr/0005-contained-bootstrap-ipc.md.
The launcher calls close_extra_fds, validates inherited transport, then install and
self_test in each newly launched single-threaded process before processing data.
Filters validate architecture and default-deny unknown syscalls with EPERM.
Capabilities are cleared; no_new_privs prevents privilege acquisition on execution.
The worker cannot create sockets, open files, exec, pass descriptors or change namespaces.

Configuration is intentionally fixed for this diagnostic; there is no insecure
override. Do not reuse for ML engines without a separately reviewed syscall profile.
This does not provide filesystem/CPU/memory quotas or a hostile-code sandbox.
The trusted OS/launcher and explicit IPC peers remain security boundaries.

Tests: `cargo test --locked --offline -p sanctum-policy` for descriptor validation;
`cargo test --locked --offline -p sanctum-gateway --test contained` for real processes
and kernel enforcement. Run all checks with `bash tools/check_rust.sh` on Linux x86_64.
