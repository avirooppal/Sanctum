# Refactor Baseline Record (R0.a)

**Date**: 2026-10-22  
**Branch**: `refactor-modular`  
**Starting Tag**: `pre-refactor-2026-10-22`  
**Commit**: `5aded73`  
**Node.js**: `v24.14.0`  
**Python**: `3.10.0`  
**OS**: Windows 11  

---

### 1. Test Suite Results
Command: `node --experimental-strip-types --test tests/vector_store_rag.test.ts tests/constants_catalogs.test.ts tests/api_contracts.test.ts`

```text
▶ API Surface & Route Contracts Characterization
  ✔ all required API endpoints are documented with schemas (1.5034ms)
  ✔ route paths exist in project filesystem (3.4437ms)
✔ API Surface & Route Contracts Characterization (12.3675ms)
▶ Application Constants & Contracts Characterization
  ✔ default endpoints are pinned (1.9015ms)
  ✔ Jan-style curated download catalog contains expected models and categories (1.4294ms)
  ✔ benchmark presets and options are non-empty and well-formed (0.54ms)
✔ Application Constants & Contracts Characterization (6.5577ms)
▶ VectorStore & RAG Ingestion Characterization
  ✔ generates 1024-dimensional normalized embeddings (5.8014ms)
  ✔ cosine similarity produces higher scores for semantically identical terms (1.0437ms)
  ✔ indexes chunks and retrieves top-k matching documents (1.4461ms)
  ✔ chunkText splits text cleanly and creates indexed chunks (0.868ms)
✔ VectorStore & RAG Ingestion Characterization (11.2973ms)
ℹ tests 9
ℹ suites 3
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 699.247
```
**Total Tests**: 9  
**Passing**: 9  
**Failing**: 0  

---

### 2. Type & Compilation Checks
Command: `npx tsc --noEmit`
- Exit Code: `0`
- Errors: `0`

---

### 3. Production Build & Bundle Metrics
Command: `npm run build`
- Exit Code: `0`
- Compiled Modules: `785`

```text
Route (app)                              Size     First Load JS
┌ ○ /                                    45.2 kB         151 kB
├ ○ /_not-found                          979 B           106 kB
├ ƒ /api/audio/transcribe                144 B           106 kB
├ ƒ /api/audio/whisperx                  144 B           106 kB
├ ƒ /api/ollama/models                   144 B           106 kB
└ ƒ /api/ollama/pull                     144 B           106 kB
+ First Load JS shared by all            105 kB
  ├ chunks/4bd1b696-5137e7b1aa00ddaa.js  52.9 kB
  ├ chunks/517-4d17caf4147677ed.js       50.5 kB
  └ other shared chunks (total)          1.97 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

### 4. License Scan
Direct Dependencies in `package.json`:
- `autoprefixer` (MIT)
- `class-variance-authority` (Apache-2.0)
- `clsx` (MIT)
- `lucide-react` (ISC)
- `next` (MIT)
- `react` (MIT)
- `react-dom` (MIT)
- `tailwind-merge` (MIT)
- `zustand` (MIT)

All dependencies are permissively licensed with zero GPL/copyleft infections.

---

### 5. API Surface Endpoints
- `GET /api/ollama/models`
- `POST /api/ollama/pull`
- `POST /api/audio/transcribe`
- `GET /api/audio/whisperx`
