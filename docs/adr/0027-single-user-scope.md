# ADR 0027: Single-user scope

Accepted 2026-10-10 by the owner's continuation brief. This supersedes conflicting
requirements in plan.md. Sanctum serves one owner; workspaces organize that owner's
data and restrict agents/tools, not collaboration among humans.

## Out of scope by decision

- Team/server product mode and collaboration, shared workspaces and multiple human accounts.
- Postgres, pgvector and Postgres FTS team storage; team NATS/Redis queues.
- OIDC/SAML SSO, multi-user RBAC, tenant isolation and per-user quotas.
- Multi-user load tests, including the 20-concurrent-user gate.
- Helm/Kubernetes deployment.

These are removed because the owner explicitly narrowed the product. Existing
contract fields/tests are retained for compatibility and security regression;
their presence does not claim a supported collaboration feature.

## Retained

Local owner token/authentication; SQLite and the planned LanceDB adapter (existing
ADR 0010's license-blocked substitution remains explicit); personal workspaces;
retrieval-time ACLs, data classes, agent scopes and cross-workspace leak tests.
Rust control plane, replaceable engines, privacy controls, MCP, OpenTelemetry,
hardware profiles and all modality/agent quality gates remain required.

An optional vLLM/SGLang engine remains useful to a single GPU-equipped owner.
Private-LAN engines require explicit egress allowlisting and ledger records.
Rootless containers, gVisor and available KVM/Firecracker remain sandbox choices.
Desktop packaging is pulled into the single-user Phase 6 requirement; the remaining
Phase 7 polish stays optional and gated.

## Replacement Phase 6 scope and gate

Implement owner resource governance (voice > chat > agents > background), memory
guards and model lifecycle; optional GPU/LAN backend; desktop packages for buildable
targets, single-user Compose and CLI installer; encrypted data/key rotation/backups;
signed offline bundles with SBOM and offline verification; single-owner workload
stress and at least one hour of soak testing with FD/process/memory monitoring.

The gate requires measured install -> doctor -> answer for each claimed package;
offline signed-bundle chat, speech and cited RAG; tamper rejection; encryption
wrong-key/canary/rotation/backup tests; and the concurrent voice/chat/ingest/agent
soak. Report latency degradation and retain the Phase 3 voice gate. Hardware gaps
are UNVERIFIED with commands, never green tags. A coverage audit must label all
dropped requirements "Out of scope by decision" and link this ADR.
