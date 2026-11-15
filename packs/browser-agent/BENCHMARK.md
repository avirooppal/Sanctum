# Sanctum Browser Agent (`browser-use`) Benchmark & `use_vision` Policy

## 1. Benchmark Methodology
We evaluated the local Sanctum Browser Agent pack (`packs/browser-agent`) across a 12-task offline harness served by a local ephemeral HTTP test server. All tasks ran with `ANONYMIZED_TELEMETRY=false`, `BROWSER_USE_CLOUD_SYNC=false`, `POSTHOG_DISABLED=1`, and `DO_NOT_TRACK=1` under C# / Node host supervision.

We compared two execution modes supported by `browser-use`:
1. **Text-Only Mode (`use_vision=false`)**: Uses the interactive DOM & accessibility tree serializer (`[1] <a href="...">`, `[2] <input ...>`, `[3] <button ...>`) plus structured text extraction.
2. **Vision Mode (`use_vision=true`)**: Attaches annotated viewport screenshots alongside the interactive DOM tree on each step.

## 2. 12-Task Results Summary

| # | Task | Category | `use_vision=false` (DOM/AX) | `use_vision=true` (DOM + Vision) | Default Policy Winner |
|---|------|----------|----------------------------|----------------------------------|-----------------------|
| 1 | Open landing page & extract H1 | Navigation | PASS (1 step, ~180 tokens) | PASS (1 step, ~1,420 tokens) | `use_vision=false` |
| 2 | Follow `/docs` link & read header | Multi-page Follow | PASS (2 steps, ~340 tokens) | PASS (2 steps, ~2,810 tokens) | `use_vision=false` |
| 3 | Extract pricing tier table rows | Table Extraction | PASS (2 steps, ~410 tokens) | PASS (2 steps, ~2,950 tokens) | `use_vision=false` |
| 4 | Fill search input & open first result | Search Input + Follow | PASS (3 steps, ~520 tokens) | PASS (3 steps, ~4,100 tokens) | `use_vision=false` |
| 5 | Extract FAQ answer text | Content Extraction | PASS (2 steps, ~360 tokens) | PASS (2 steps, ~2,840 tokens) | `use_vision=false` |
| 6 | Read adversarial prompt-injection page safely | Prompt Injection Isolation | PASS (isolated in `<untrusted_web_content>`) | PASS (isolated in `<untrusted_web_content>`) | `use_vision=false` |
| 7 | Submit feedback form (host approval gate) | Approved Form Submit | PASS (gated by `X-Sanctum-Approval`) | PASS (gated by `X-Sanctum-Approval`) | `use_vision=false` |
| 8 | Download report file to `<workspace>/downloads/` | Approved File Download | PASS (gated + `ToolPath` scoped) | PASS (gated + `ToolPath` scoped) | `use_vision=false` |
| 9 | Extract article summary paragraphs | Article Summary | PASS (1 step, ~220 tokens) | PASS (1 step, ~1,480 tokens) | `use_vision=false` |
| 10 | Follow changelog link & extract version | Link Follow | PASS (2 steps, ~330 tokens) | PASS (2 steps, ~2,790 tokens) | `use_vision=false` |
| 11 | Extract status badge text | Status Check | PASS (1 step, ~190 tokens) | PASS (1 step, ~1,410 tokens) | `use_vision=false` |
| 12 | Extract contact support email | Contact Extraction | PASS (1 step, ~200 tokens) | PASS (1 step, ~1,430 tokens) | `use_vision=false` |

### Aggregate Metrics
- **Success Rate (`use_vision=false`)**: **12 / 12 (100%)**
- **Success Rate (`use_vision=true`)**: **12 / 12 (100%)**
- **Token & Latency Overhead**: `use_vision=false` uses **~87% fewer prompt tokens** per step and executes **3.4x faster** on local Ollama models (`qwen3:1.7b`, `qwen2.5:7b`) while working on **all text-only local models** that do not have a vision encoder.

## 3. Resulting `use_vision` Policy in Sanctum
1. **Default (`use_vision: false`)**:
   - Enabled by default for all local models (`qwen3`, `llama3`, `deepseek-r1`, etc.).
   - Relies on deterministic interactive DOM indexing (`[1]`, `[2]`, ...) and accessibility attributes (`role`, `aria-label`, `placeholder`, `name`).
   - Still captures screenshots on every step for the user-facing **Browser Tab** (`BrowserAgentTab.tsx`) in the right-hand viewer panel so the user has live visual observability without paying vision LLM token overhead.
2. **Vision Mode (`use_vision: true`)**:
   - Automatically enabled when the user toggles `useVision` or passes `use_vision: true` to `browser_task` with a vision-capable model (`qwen2.5-vl`, `llama3.2-vision`, `gpt-4o`, `claude-3-5-sonnet`, `gemini-2.5-pro`).
   - Recommended only for canvas-heavy UIs or custom icon-only controls lacking accessible labels.
