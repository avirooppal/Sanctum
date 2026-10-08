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
