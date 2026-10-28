# Sanctum Defect Ledger

All defects discovered during pipeline verification are recorded here with symptoms, root causes, fix commits, and regression tests.

## Defect Index

| Defect ID | Discovered In | Symptom | Root Cause | Status | Fix Commit | Regression Test |
|---|---|---|---|---|---|---|
| **D-001** | V0 Baseline | Engine offline yields synthetic response: `"Local engine (...) processed your prompt"` with invented metrics `44.2 tps`. | `core/ai/inference/engine.ts` had a catch-all synthetic fallback generator on fetch failure instead of raising an engine error. | **FIXED** | Pending | `tests/observability.test.ts` (`engine unreachable throws EngineUnavailableError and yields NO text`) |
| **D-002** | V0 Baseline | Engine offline lists a synthetic `llama3.2` 3.2B model when 0 real models are detected on disk or daemon. | `LocalEngineClient.fetchOllamaModels` hardcoded a fallback `llama3.2` object when raw models list was empty. | **FIXED** | Pending | `tests/observability.test.ts` (`fetchOllamaModels returns empty array when engine offline`) |
| **D-003** | V0 Baseline | Desktop host returns synthetic `"Local inference loopback active"` on engine connection failure. | `tools/compile_desktop_host.py` catch block returned simulated completion JSON rather than propagating HTTP 502/503. | **FIXED** | 9324363 | `tests/observability.test.ts` |
| **D-004** | V1 P2 Verification | Ollama reasoning models (qwen3, deepseek-r1) stream internal tokens in `message.thinking`. Client ignored them, yielding empty responses or 0 deltas. | `core/ai/inference/ollama_client.ts` only read `message.content`. | **FIXED** | Pending | `tests/pipeline_p2_chat_path.test.ts` |

---

## Detailed Defect Records

### D-001: Synthetic Fallback Chat Reply on Engine Unreachable
- **Discovered In:** V0 Baseline Reality Probe (`evals/results/pipeline/baseline/reality_probe_prefix.json`)
- **Symptom:** When Ollama or local inference daemon is not listening, sending a chat prompt returns a simulated response: `"Local engine (qwen3:1.7b) processed your prompt: '...'. Context window: 8192 tokens..."` with fake `metrics: { tps: 44.2, ttftMs: 14, totalTokens: 14, vramUsedGB: 1.8 }`.
- **Root Cause:** In `core/ai/inference/engine.ts:336-344`, if `response` is null, an unverified synthetic object was yielded to prevent UI breakage.
- **Fix:** Switched chat streaming to `core/ai/inference/ollama_client.ts`, which throws `EngineUnavailableError` with endpoint details and yields zero synthetic text.
- **Regression Test:** `tests/observability.test.ts` asserting `streamOllamaChat` throws `EngineUnavailableError` and delta count is 0.

### D-002: Synthetic `llama3.2` Model Injection When Engine is Offline
- **Discovered In:** V0 Baseline Reality Probe (`evals/results/pipeline/baseline/reality_probe_prefix.json`)
- **Symptom:** UI and API report that `llama3.2` (3.2B, Q4_K_M) is installed and available even when no models exist on disk or when Ollama is completely stopped.
- **Root Cause:** In `core/ai/inference/engine.ts:133-146`, fallback array `[{ name: "llama3.2", size: 2147483648, ... }]` was returned when `rawModels.length === 0`.
- **Fix:** Return empty list `[]` when daemon is offline or has no models, prompting user to download or pull via the Model Hub.
- **Regression Test:** Unit test asserting empty list when fetch fails.

### D-003: Synthetic Desktop Loopback Response
- **Discovered In:** Review of `tools/compile_desktop_host.py:828`
- **Symptom:** In standalone executable host, any failure communicating with `127.0.0.1:11434` returned a mock JSON: `"Local inference loopback active. Ready for instructions."`
- **Root Cause:** Fallback string returned instead of HTTP 502 Bad Gateway.
- **Fix:** Return HTTP 502 with structured error JSON `{"error": "Inference engine offline or unreachable at 127.0.0.1:11434"}`.

### D-004: Reasoning Token Drop in Ollama Streaming Client
- **Discovered In:** V1 P2 Verification (`tests/pipeline_p2_chat_path.test.ts`)
- **Symptom:** When calling reasoning models (`qwen3`, `deepseek-r1`), if generation ended during the reasoning phase or reasoning tokens were generated, `deltas` was empty and `text` was `""`.
- **Root Cause:** Ollama streams reasoning deltas in `message.thinking` rather than `message.content`. `ollama_client.ts` only checked `message.content`.
- **Fix:** Added support for `message.thinking` streaming wrapped in `<think>...</think>` tags matching `splitThinking` and the UI renderer, and added optional `think: false` parameter support.
- **Regression Test:** `tests/pipeline_p2_chat_path.test.ts` (streaming concatenation and reasoning capture).
