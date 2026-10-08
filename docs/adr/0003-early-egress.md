# ADR 0003: Fail-closed network prototype before service startup

Date: 2026-10-08
Status: accepted

## Context
The user moves egress protection ahead of Phase 5. A configuration flag or timed-out
connection does not prove enforcement. Native Windows/macOS isolation is not built.

## Decision
Add a Linux development launcher using OS user/network namespaces with no network
interfaces other than down loopback. Run kernel-error-checked IPv4/IPv6 TCP/UDP
probes before a child command. No DNS lookup or Internet probe happens on the host.
Do not expose product services yet. Doctor always reports runtime egress unverified
and startup blocked. Cloud connectors remain disabled in the foundation contract.

## Consequences and verification
This cannot connect separate services yet, and is not containment for hostile
code. Before Phase 1 startup, provide an enforceable transport/IPC design, drop
privileges, prevent host socket access and prove denied egress per process. Add
native Windows/macOS containment, or document supported runtime environments.
No host firewall changes are made by doctor. CI runs the real Linux namespace test;
negative tests ensure refusal/timeouts/success are not mistaken for firewall denial.
