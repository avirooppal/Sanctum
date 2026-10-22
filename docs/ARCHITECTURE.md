# System Architecture Specification

## 1. Overview
Sanctum is structured as a modular, sovereign local-first AI workspace. Presentation layers are strictly decoupled from AI inference, document retrieval, and system supervision.

```text
contracts/            OpenAPI, JSON schemas, typed clients, error-code registry
core/
  api/                Routes, request validation, SSE/ndjson streaming, error mapping
  domain/             Threads, assistants, settings schema, model registry, data classes
  ai/
    inference/        Engine ports & Ollama / LM Studio adapters, streaming parser
    tools/            Tool-call execution loop, MCP host/client, sandbox abstractions
    rag/              Vector store, chunking, semantic similarity, citations
    speech/           WhisperX server integration & audio transcription adapters
    prompts/          System prompt templates & prompt assembly
    hardware/         VRAM detection, telemetry heuristics, engine diagnostics
  infra/              LocalStorage persistence, process supervision, platform layers
apps/
  ui/                 Frontend components, layout, state hooks, styling tokens
tests/                Integration suites, characterization tests, fixtures
tools/                Architecture verification scripts, benchmark harnesses
```

## 2. Invariant Rules
1. **Unidirectional Dependency Flow**:
   `ui` -> `contracts` -> `domain` -> `ai` -> `infra`
2. **Zero AI Logic in UI**:
   UI components render data received from core domain/API clients. Prompt strings, reasoning extraction regular expressions, token math, and hardware fit formulas are forbidden in `apps/ui`.
3. **No UI in Core**:
   Core modules never import React components, JSX elements, or UI styling libraries.
4. **Contract Supremacy**:
   All inter-boundary data structures are governed by explicit TypeScript interfaces in `contracts/`.
