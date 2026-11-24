# Sanctum A2UI Rich Replies — Phase 3b-1 Spike & Design Document

## 1. Specification & Package Audit
- **Project**: [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) / [a2ui.org/specification](https://a2ui.org/specification/)
- **License**: **Apache-2.0** (compatible with Sanctum's MIT license; attribution required in `THIRD_PARTY_NOTICES.txt` / `NOTICE` if any `@a2ui/*` package is bundled).
- **Version Pin Decision: Pin to `v0.9.1` wire subset (wrapped behind a single versioned adapter)**
  - `v0.9.1` defines the four core declarative surface messages: `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`, plus `userAction` (renderer -> agent).
  - `v1.0` adds bidirectional RPC (`callRendererFunction`, `callAgentFunction`, `rendererFunctionResponse`, `agentFunctionResponse`) and `@`-prefixed envelopes.
  - **Why `v0.9.1` subset for Sanctum**: Sanctum's product security rules explicitly forbid agent-generated UI from invoking host/renderer functions directly (`userAction` must ONLY emit an untrusted user-input event back to the harness). Pinning to the `v0.9.1` declarative subset eliminates RPC attack surface while keeping a single versioned adapter (`src/lib/a2ui/adapter.ts`) so upgrading to `v1.0` touches one file.
- **Local-Only & React 19 Dependency Audit**:
  - Sanctum runs **React 19.0.0** (`package.json`) with Next.js 15 static export in embedded WebView2.
  - There is **no C# A2UI SDK**.
  - **Architecture Split (Defense in Depth)**:
    - **C# Host (`tools/native/harness/A2uiValidator.cs`)**: Owns protocol events (`a2ui_surface`), append-only session log storage (raw, size-capped <= 64 KB, secrets-redacted, replayable by `seq`), structural validation (version pin, max 50 components, max nesting depth 8, max string 4096 chars, max data model 32 KB, max 3 surfaces/message, strict catalog allowlist, workspace-scoped path validation for `FileCard`/`Citations`, no `javascript:`/`http:` remote images), and deterministic **text flattener (`A2UI -> Markdown`)** for CLI, export, copy, search, and fallback.
    - **React 19 UI (`src/components/a2ui/`)**: Zero-network, zero-eval native React 19 renderer adapter implementing Sanctum's allowlisted catalog (`Column`, `Row`, `Card`, `Text`, `Button`, `TextField`, `Checkbox`, `Select`, `Table`, `FileCard`, `DiffSummary`, `TodoList`, `CodeBlock`, `Citations`, `TerminalOutput`) styled with Sanctum theme tokens, wrapped in per-surface React Error Boundaries and a clearly labeled `"Agent-generated UI"` frame. Zero remote CDN/font/script fetches, zero `eval`/`new Function`, zero iframes/raw HTML, zero password/secret fields.
    - **Approvals are NEVER A2UI**: All approval cards, workspace trust prompts, egress notices, and permission dialogs remain host-owned native components outside the A2UI container.

---

## 2. Live Local Ollama Benchmark (Measured on This Machine)
Script: `tools/eval/a2ui_spike_bench.mjs` (`num_ctx=4096`, `num_predict=256`, `temperature=0.1`, `think=false`, 4 diverse UI prompts: Table, Form, TodoList, FileCard).

| Local Model | Tier | Approach (a) Delimited JSON | Approach (b) `render_ui` Tool | Approach (c) Ollama Structured Output |
|---|---|---|---|---|
| `smollm2:135m` | `minimal` | **0/4 (0%)** · 3966 ms (`missing_delimiters: 4`) | **0/4 (0%)** · 21 ms (`no_tool_call: 4`) | **0/4 (0%)** · 4335 ms (`json_parse_error: 4`) |
| `qwen3:1.7b` | `standard` | **0/4 (0%)** · 8496 ms (`missing_delimiters: 3, json_parse_error: 1`) | **2/4 (50%)** · 6518 ms (`no_tool_call: 2`) | **3/4 (75%)** · 7587 ms (`json_parse_error: 1`) |
| `qwen3:4b` | `full` (CPU/iGPU) | **0/4 (0%)** · >25000 ms timeout (`exception: 4`) | *timed out (>25s/turn on this machine)* | *timed out (>25s/turn on this machine)* |

### Key Findings
1. **Approach (a) Delimited JSON blocks failed 0% across all tested models** — small local models reliably drop delimiters or emit invalid JSON. **Rejected.**
2. **Approach (c) Ollama Structured Output (`format: schema`) achieved the highest validity (75% on `qwen3:1.7b`)**, because grammar-constrained decoding enforces the schema; however, it forces JSON on every turn and cannot be enabled globally for normal markdown chat without a classifier or explicit tool trigger.
3. **Approach (b) `render_ui` tool achieved 50% on `qwen3:1.7b` (6.5s median)**, works cleanly inside the existing harness tool loop without delaying plain-text turns, and can be paired with constrained decoding when the model invokes `render_ui` (behind an `IA2uiProducer` interface).
4. **Minimal-tier models (`smollm2:135m`) scored 0% on all 3 approaches** — A2UI MUST stay disabled in `Auto` mode for models below the measured validity threshold (e.g. `< 70%`).

---

## 3. GO / NO-GO Gate Recommendation
Per Phase 3b-1 gate criteria:
> *"If supported tiers cannot reach a useful validity rate even with constrained decoding, limit A2UI to forms and tables through the `render_ui` tool and ship it as Experimental, off by default."*

- **Recommendation: CONDITIONAL GO — Experimental (`render_ui` tool + scoped catalog, Off by default / Auto only for models with >= 70% measured validity)**.
- **Option 1 (Recommended)**: Proceed with **3b-2 through 3b-5** using the **`render_ui` tool** (behind `IA2uiProducer`), shipping the full Sanctum host validator + text flattener + React 19 error-bounded catalog (`Table`, `Form`/`TextField`/`Button`, `FileCard`, `DiffSummary`, `TodoList`, `CodeBlock`, `Citations`, `TerminalOutput`), defaulting Rich Replies to **Experimental (Off / Auto >= 70% measured validity)** so weak local models always get fast, reliable markdown.
- **Option 2**: Limit 3b-2..3b-5 strictly to **Forms + Tables** via `render_ui` as Experimental (off by default).
- **Option 3**: Skip Phase 3b and proceed directly to **Phase 4 (Agent Features)**.
