# Move Map (docs/refactor/MOVE_MAP.md)

| Original Path | Target Path | Concern / Layer | Status |
| :--- | :--- | :--- | :--- |
| `src/types/index.ts` | `contracts/types/index.ts` | Data schemas & contracts | Completed (R2) |
| `src/lib/constants.ts` | `contracts/constants/index.ts` | Default configuration & catalogs | Completed (R2) |
| `(new)` | `contracts/errors/codes.ts` | Standard error-code registry | Completed (R2) |
| `(new)` | `contracts/api/client.ts` | Typed client for core endpoints | Completed (R2) |
| `src/lib/engine.ts` | `core/ai/inference/engine.ts` | Local engine client & streaming | Planned (R3) |
| `src/lib/vectorStore.ts` | `core/ai/rag/vectorStore.ts` | In-memory semantic vector store | Planned (R3) |
| `scripts/whisperx_server.py` | `core/ai/speech/whisperx_server.py` | Speech-to-text inference service | Planned (R3) |
| `src/store/slices/*` | `core/domain/*` & `apps/ui/state/*` | Pure domain state & UI stores | Planned (R4) |
| `src/components/*` | `apps/ui/components/*` | Pure presentation UI components | Planned (R6) |
