# Architecture

## Current implementation (2026-10-10)

Linux x86_64 Rust gateway binds host loopback before entering a private namespace
and installing seccomp. Hash-verified llama.cpp children share private loopback;
authenticated clients use OpenAI chat/embedding/models and SQLite conversation history.
Knowledge uses a separately confined Python JSONL worker and retrieval-time ACLs.
The solo vector store is SQLite-vec under ADR 0010, not the planned LanceDB default.

Optional file speech launches a bounded Python worker through the same confined
engine-child entry. A versioned profile selects Whisper or Parakeet and optional
Silero VAD. Uploaded bytes are transient; no remote engine fallback exists. The gateway
derives the current solo request context. ASR is real and SDK-tested; TTS hosting,
streaming, diarization and a microphone/speaker loop remain incomplete.

React/Tailwind chat is implemented. Desktop, vision, agents, declarative policy,
Privacy Ledger, OIDC, Postgres, OpenTelemetry and signed releases remain planned.
The paragraphs below retain early foundation design history; use STATUS.md and
PLAN_COVERAGE.md for current verification scope rather than those historical limits.

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

## Phase 1 runtime
The host listener is bound before user/network isolation. Rust gateway and both trusted llama.cpp processes share private loopback only. Engine requests use a replaceable Rust trait; clients see OpenAI HTTP/SSE. SQLite and the local key live in a private state directory; UI assets are same-origin. Explicit artifact provisioning happens outside runtime and is locally logged.
