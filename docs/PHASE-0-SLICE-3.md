# Phase 0 completion slice: usable isolated HTTP runtime

Tasks: define health contract; add process-level tests; implement a Rust loopback
HTTP gateway inside a private user/network namespace with a prebound ingress socket;
lock namespace/host IPC escape paths with seccomp; test inherited confinement across
exec and threads; record evidence and complete Phase 0 for Linux x86_64.

Interfaces: GET /healthz (OpenAPI), JSON startup record, Rust runtime containment API.
Tests: actual HTTP request from host, denied external TCP/UDP v4/v6 and host Unix
sockets, blocked namespace changes, thread support, child exec inheritance, failure
outside isolated namespace. Risks: kernel namespace availability, unsafe ABI glue,
inherited descriptors, differences between full agent sandboxing and egress isolation.
Unsupported OS/hardware stays unverified, with runtime startup failing closed.
