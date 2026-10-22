# ADR-001: Separation of AI Logic, Domain, and Presentation Layers

## Status
Accepted

## Context
Sanctum started as an integrated Next.js application where AI engine clients, vector embeddings, streaming loops, hardware heuristics, and presentation components lived in proximity under `src/`. As the application grows to support multiple local engines (Ollama, LM Studio, llama.cpp), speech-to-text (WhisperX), computer use agents, and document RAG, mixing AI logic into UI components creates tight coupling, hinders headless testing, and complicates native desktop/CLI packaging.

## Decision
Adopt a strictly decoupled, unidirectional layered architecture:
```
apps/ui (Presentation only)
   ↓
contracts (Types, Schemas, API Client)
   ↓
core/domain (Pure business entities & state interfaces)
   ↓
core/ai (Inference, Tools, RAG, Speech, Prompts, Hardware heuristics)
   ↓
core/infra (Process supervision, Local storage, Platform abstractions)
```

### Layer Rules
1. **Presentation (`apps/ui`)**:
   - Zero AI logic: no prompt templates, no hardware/fit heuristics, no retrieval or token counting, no direct engine communication.
   - Communicates only via typed clients and contracts.
2. **Contracts (`contracts`)**:
   - Single source of truth for all schemas, error codes, DTOs, and endpoint interfaces.
3. **Core AI (`core/ai`)**:
   - Self-contained inference engine adapters, RAG pipelines, prompt managers, and speech-to-text bridges.
   - Never imports UI components or framework-specific presentation helpers.
4. **Enforcement**:
   - Automated architecture gate (`tools/check_architecture.py`) run in CI to block boundary violations.

## Consequences
- Clean separation allows independent evolution, headless automated testing, and native CLI/Desktop packaging.
- Every cross-boundary interaction is typed and verified against contract snapshots.
