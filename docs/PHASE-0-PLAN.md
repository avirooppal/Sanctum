# Phase 0 â€” slice 1: offline doctor and foundation contracts

Tasks: preserve plan; establish section 13 directories; specify request envelope,
diagnostic JSON and registry; implement hardware probes/profile selection; add early
Linux network-isolation prototype; establish CI and honest evaluation records.

Interfaces: OpenAPI 3.1 components, JSON Schema registry, CLI exit codes and network
launcher contract. Tests precede implementations. Product services remain unimplemented.

Tests: schema validation and rejection, hardware boundaries and failures, process
CLI checks, egress gate negative cases, actual isolated execution on Linux, formatting,
lint, CLI type checks, dependency license allowlist, deterministic profile evaluation.

Risks: hardware API gaps, no native Windows isolation, namespace restrictions in CI,
no model benchmarks. Explicitly mark these; never turn unknown into passing readiness.

Next slice: Rust control-plane contracts/toolchain and transport-aware containment
with enforced startup checks on supported platforms, before Phase 1 inference.
