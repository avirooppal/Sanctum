# Move Map (docs/refactor/MOVE_MAP.md)

| Original Path | Target Path | Concern / Layer | Status |
| :--- | :--- | :--- | :--- |
| `src/types/index.ts` | `contracts/types/index.ts` | Data schemas & contracts | Completed (R2) |
| `src/lib/constants.ts` | `contracts/constants/index.ts` | Default configuration & catalogs | Completed (R2) |
| `(new)` | `contracts/errors/codes.ts` | Standard error-code registry | Completed (R2) |
| `(new)` | `contracts/api/client.ts` | Typed client for core endpoints | Completed (R2) |
| `src/lib/engine.ts` | `core/ai/inference/engine.ts` | Local engine client & streaming | Completed (R3) |
| `src/lib/vectorStore.ts` | `core/ai/rag/vectorStore.ts` | In-memory semantic vector store | Completed (R3) |
| `(new)` | `core/ai/inference/format.ts` | Reasoning & thinking tag parser | Completed (R3) |
| `(new)` | `core/ai/prompts/index.ts` | Centralized prompt templates | Completed (R3) |
| `(new)` | `core/ai/hardware/fit.ts` | VRAM & model fit heuristics | Completed (R3) |
| `(new)` | `core/domain/threads.ts` | Domain entity logic for chat sessions | Completed (R4) |
| `(new)` | `core/domain/models.ts` | Domain categorization for models | Completed (R4) |
| `(new)` | `core/domain/documents.ts` | Domain types & MIME rules for documents | Completed (R4) |
| `(new)` | `core/infra/storage/persistence.ts` | Storage interface & LocalStorage port | Completed (R4) |
| `scripts/whisperx_server.py` | `core/ai/speech/whisperx_server.py` | Speech-to-text inference service | Completed (R5) |
| `(new)` | `packs/speech/pack.json` | Speech pack manifest | Completed (R5) |
| `(new)` | `packs/rag/pack.json` | Knowledge Vault RAG pack manifest | Completed (R5) |
| `(new)` | `packs/research/pack.json` | Deep research pipeline manifest | Completed (R5) |
| `(new)` | `packs/agents/pack.json` | Supervised computer use manifest | Completed (R5) |
| `src/store/slices/*` | `core/domain/*` & `apps/ui/state/*` | Pure domain state & UI stores | Planned (R6) |
| `src/components/*` | `apps/ui/components/*` | Pure presentation UI components | Planned (R6) |
