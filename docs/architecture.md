# Architecture

plan.md is the architecture and phase source of truth. Gateway/control plane
(Rust) is the sole ingress. Inference, speech, vision-docs, knowledge and agents
are separate processes behind versioned contracts. Engines are replaceable adapters.
Every data-plane request carries user/workspace/data_class/trace_id/policy_context.
Gateway derives identity and policy from authenticated context, never client claims.

Solo: SQLite + LanceDB. Team: Postgres/pgvector + OIDC, optional queue.
Web: React or SvelteKit/Tailwind; desktop: Tauri. These are planned, not implemented.
OpenAI API compatibility, MCP and local-only OpenTelemetry are planned boundaries.

Current executable: offline Python doctor. Model/runtime selection is read from
profiles/hardware.json. No inference server, model download, data store or telemetry
exists. tools/isolated_run.py is an early Linux network prototype with startup tests;
its lack of IPC/filesystem isolation prevents production-service readiness claims.

Slice 2 adds a Rust workspace: gateway contains envelope types and a bounded local
IPC diagnostic; policy contains Linux x86_64 seccomp enforcement. The diagnostic
supervisor and worker each close unused handles and install default-deny kernel
filters before request processing. They communicate over an inherited Unix socket
pair; no ports are opened. Host Unix sockets/file opens are denied. This bootstrap
transport does not replace planned product HTTP/gRPC contracts (ADR 0005).
