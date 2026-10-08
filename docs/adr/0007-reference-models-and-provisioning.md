# ADR 0007: Small verified CPU reference models and explicit provisioning

Date: 2026-10-08
Status: accepted

Use official Apache-2.0 Qwen GGUF artifacts for initial CPU integration, selected
after current source verification. A small reference model exercises the real
pipeline within available memory; it is not a claim of best quality or latest
family. Model/profile IDs, revisions, URLs and hashes live only in configuration.

Provisioning is an explicit developer/user command outside runtime containment.
It may access public artifact URLs only with --allow-network and records each
download locally. Runtime services never download weights or activate cloud fallback.
Offline imports are hash verified. Speed remains unknown until an actual benchmark;
memory-fit estimates are conservative estimates, not measured guarantees.

Phase 1 Linux reference uses llama.cpp; MLX requires an Apple environment and remains
unverified. Linux reference exit measurements cannot be generalized to other platforms.
