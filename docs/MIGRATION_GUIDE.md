# Sanctum Local-Only Migration Guide

## Upgrading from Previous Cloud-Enabled Builds
Sanctum is now a **strictly local, private AI workspace**. All cloud LLM providers (Anthropic, OpenAI, Google Gemini, OpenRouter) and cloud browser speech fallbacks have been removed.

### What Happens Automatically on First Startup
1. **Cloud credentials wiped**: If `%APPDATA%\Sanctum\cloud_providers.json` exists, Sanctum overwrites it with zeros and deletes it.
2. **One-time notice**: A dismissible banner/toast informs you once that cloud providers were removed.
3. **History preserved**: Saved threads (`threads.json`) and harness sessions (`sessions/*.jsonl`) referencing `anthropic:*`, `openai:*`, `gemini:*`, or `openrouter:*` are automatically rewritten to your default local model (`qwen3:1.7b` or active local Ollama model) without losing any conversation history, and session hash chains are recomputed.
4. **Secret scrubbing**: Any `sk-*`, `sk-ant-*`, `sk-or-v1-*`, or `AIza*` API key strings found in migrated threads, sessions, logs, or exports are replaced with `[REDACTED_CLOUD_KEY]`.

### Supported Local Inference Backends
- **Ollama** (loopback `http://127.0.0.1:11434`, `OLLAMA_NO_CLOUD=1`)
- **OpenAI-Compatible Local Servers** (llama.cpp server, LM Studio, vLLM local via `--provider openai-local --base-url http://127.0.0.1:<port>/v1`; non-loopback URLs are rejected)
- **Deterministic Mock** (`--provider mock` for offline testing)
