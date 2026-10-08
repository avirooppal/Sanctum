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

Pending mandatory gates: authenticated envelope creation; retrieval-time tenant/doc
ACLs; untrusted-content separation; policy-gated tools and approvals; signed manifests;
hash-chained ledger; per-service egress capture; encrypted storage and OIDC. No tests
for these future modules are claimed to pass. See STATUS.md and ADR 0003.
