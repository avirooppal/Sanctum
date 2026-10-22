# Sanctum Core Layer (`core/`)

The **Core** module encapsulates all business domain rules, pure AI logic, inference abstraction, and infrastructure persistence ports. It operates independently of presentation frameworks (React/Next.js).

## Layer Hierarchy & Boundary Rules
The allowed dependency direction flows strictly downwards:
```
apps/ui -> contracts -> core/domain -> core/ai -> core/infra
```
- `core/` **NEVER** imports from `apps/` or React components.
- `core/` contains no UI presentation code or JSX.
- Errors are emitted as typed error codes from `contracts/errors/codes.ts`.

## Structure
- `domain/`: Pure domain operations without I/O dependencies.
  - `threads.ts`: Thread creation, message factory with timestamping.
  - `models.ts`: Model categorizations (coding, reasoning, general) and architecture mapping (GGUF, Safetensors).
  - `documents.ts`: Document classification and indexing helpers.
- `ai/`: AI capabilities, prompt engineering, and hardware detection.
  - `inference/format.ts`: Response parsing, streaming thought tag extraction (`splitThinking`).
  - `inference/engine.ts`: Local Ollama & llama.cpp orchestration contracts.
  - `hardware/fit.ts`: Hardware detection, VRAM capacity calculation, and offloading heuristics.
  - `rag/vectorStore.ts`: In-memory vector store, cosine similarity, TF-IDF / embeddings, chunking.
  - `prompts/index.ts`: Versioned system prompts and system prompt composition.
  - `speech/whisperx_server.py`: Isolated FastAPI service for WhisperX transcription.
- `infra/`: Persistence and I/O implementations.
  - `storage/persistence.ts`: Local storage wrappers, serialization, and cache adapters.

## Testing & Validation
- `tests/core_ai.test.ts`: Tests `splitThinking`, VRAM fitting heuristics, prompt templates.
- `tests/core_domain.test.ts`: Tests session models, thread factories, and architecture identification.
- `tests/vector_store_rag.test.ts`: Tests vector embeddings, cosine distance, and top-k retrieval.
- `tools/check_architecture.py`: Verifies zero UI imports and enforced unidirectional dependency flow.
