# ADR 0006: Linux-first egress-isolated runtime with prebound ingress

Date: 2026-10-08
Status: accepted

Phase 0's exit is doctor printing tier/profile; early egress adds a usable runtime
boundary. Native Mac/Windows containment and real accelerator validation cannot be
claimed here. Support Linux x86_64, including WSL2, first; refuse unsupported runtime
platforms rather than making those platforms a prerequisite for every later phase.

Bind the gateway ingress to host loopback before creating private user/network
namespaces. Inherited listener sockets retain their host association. Bring up only
private loopback; separate local services use HTTP inside this isolated network.
No physical interfaces, veth, routes, DNS proxy or Internet gateway are added.
Drop capabilities; apply no_new_privs and a seccomp filter denying host Unix socket
creation, namespace changes, namespace-bearing clone, clone3 (ENOSYS for thread
fallback), io_uring, mount, ptrace and cross-process memory access. Only IPv4/IPv6
socket creation is permitted, within the unrouted namespace. Filters inherit across
exec and threads. The filter permits ordinary model file access and CPU threads.

This replaces neither declarative policy nor Phase 5 hostile-code sandboxes. Host
filesystem access and data written to authorized output paths are not a malicious
code boundary. Trusted engines must be pinned; arbitrary agents cannot use this
launcher. Model parsing/engine sandbox expansion requires separate review.

Cloud remains off; no escape hatch or egress proxy exists. Child startup repeats
real TCP/UDP no-route probes and kernel denial checks. A health response is emitted
only after success. Production inference still needs its own execution test in Phase 1.
Reference: https://man7.org/linux/man-pages/man7/network_namespaces.7.html
