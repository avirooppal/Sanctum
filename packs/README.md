# Sanctum Packs Layer (`packs/`)

The **Packs** module houses modular, opt-in capability extensions (RAG, Speech, Research, Agents) designed to extend the core platform without polluting the foundational layers.

## Packaging Standards
Each pack is isolated in its own directory with a declarative `pack.json` manifest specifying:
1. `name`: Unique identifier.
2. `version`: Semantic version.
3. `description`: Human-readable summary of capability.
4. `capabilities`: Array of features enabled.
5. `dependencies`: Underlying dependencies (e.g. WhisperX, SentenceTransformers).
6. `engine_requirements`: Compute, minimum VRAM, and runtime requirements.

## Current Packs
- `speech/`: Speech-to-text with WhisperX audio alignment and fallback Web Speech APIs.
- `rag/`: Retrieval-Augmented Generation with chunking, local vector storage, and document grounding.
- `research/`: Autonomous deep research workflows and web verification synthesis.
- `agents/`: Multi-agent tool execution and autonomous loops.

## Testing & Validation
All pack manifests are validated for schema conformity in `tests/packs_manifests.test.ts`.
