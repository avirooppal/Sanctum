# Threat model

Assets: prompts, documents, identities, workspace memberships, model files, keys,
tool output and local hardware inventory. Trust OS administrators; distrust external
documents, models, web/email content and tool manifests/results.

Current doctor reads local hardware and prints locally; it opens no listening sockets
or network clients. It calls local powershell/sysctl/nvidia-smi from PATH (trusted
administrator-controlled executables). Do not run with an untrusted PATH or profiles.
Hardware reports may identify devices: review before sharing them.

Current mitigation: cloud disabled in envelope; no product services start; network
prototype requires explicit kernel denial before child execution. It is insufficient
for hostile code because Unix sockets/filesystem/host IPC are not isolated.

The Rust bootstrap diagnostic closes the host-socket gap: both processes close
unused descriptors, clear capabilities, set no_new_privs and install a seccomp
allowlist. Only inherited local IPC remains; new sockets, connect, file opens,
exec, namespace changes, descriptor passing and io_uring are rejected by the kernel.
Supervisor stdio cannot be sockets. Requests are size-bounded and envelope-validated.
The filter is for trusted foundation processes, not hostile agents: kernel bugs,
shared-kernel side channels, signals, resource exhaustion and malicious authorized
IPC peers remain outside this diagnostic's protection. Production HTTP/gRPC and
engine-specific containment still require separate integration tests.

Pending mandatory gates: authenticated envelope creation; retrieval-time tenant/doc
ACLs; untrusted-content separation; policy-gated tools and approvals; signed manifests;
hash-chained ledger; per-service egress capture; encrypted storage and OIDC. No tests
for these future modules are claimed to pass. See STATUS.md and ADR 0003.
