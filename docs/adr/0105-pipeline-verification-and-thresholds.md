# ADR 0105: Pipeline verification method, observability contract and acceptance thresholds

**Date:** 2026-10-27
**Status:** PROPOSED — thresholds fixed BEFORE any pipeline measurement (V0). Loosening any value requires a superseding ADR and a REVIEW_QUEUE entry.
**Decides:** how every pipeline checkpoint in `docs/PIPELINE_VERIFICATION.md` is proven, what the observability layer must record, and the numeric pass criteria.

## 1. Context

Baseline (V0, commit `95a8faa`) showed the product could display output that no model produced:
`LocalEngineClient.streamChat` returned a synthetic "Local engine (…) processed your prompt" reply with
invented metrics when the engine was unreachable, `fetchOllamaModels` invented a `llama3.2` model when none
was found, and the desktop host returned "Local inference loopback active" on any engine error
(evidence: `evals/results/pipeline/baseline/reality_probe_prefix.json`, `docs/DEFECTS.md` D-001..D-003).
Earlier timing claims (e.g. TTFT 16.82 ms in ADR 0101 evidence) may have measured those synthetic paths and
are therefore not accepted as pipeline evidence until re-measured against a real engine.

## 2. Engines under test

| Role | Engine | Pin | Notes |
|---|---|---|---|
| Product chat/embedding engine (current) | Ollama | 0.40.11 (`ollama --version`) | What the shipped UI drives today. Exposes `/api/chat`, `/api/show`, `/api/ps`, `/api/embed`, usage counts. No tokenize / apply-template. |
| Ground-truth oracle (dev only, never shipped) | llama.cpp `llama-server` | `b11913`, zip SHA256 `55b31ccaf398e90457cfe28087297f5f3fdf1e3bfa7a28e1108f13d0af8e4621` (`tools/pipeline/fetch_llama_oracle.py`) | Loads the same GGUF blob Ollama loads (`~/.ollama/models/blobs/sha256-…`). Provides `/tokenize`, `/detokenize`, `/apply-template`, `/props`, `/slots`, `/metrics`. MIT license. |

Whether the product engine should move from Ollama to a supervised `llama-server` (plan.md §6.1) is an owner
decision queued in `docs/REVIEW_QUEUE.md`; this ADR does not decide it.

Reference model for integration runs: `qwen3:1.7b` (Ollama digest recorded per run). Integration runs use
`temperature=0`, `seed=42`, `top_k=1` unless the checkpoint tests sampling itself.

## 3. Method (per checkpoint)

1. Row written in `docs/PIPELINE_VERIFICATION.md` with an unambiguous pass criterion before the run.
2. Observable through trace spans / inspect records / engine endpoints — never code reading alone.
3. Three levels where applicable: unit/contract with a deterministic fake (tests only), integration with the
   real engine, end-to-end through the real UI (Playwright, clean data dir).
4. Mutation check: the step is deliberately broken and the test must turn red; the red run is kept under
   `evals/results/pipeline/<pipeline>/<checkpoint>.mutation.*`.
5. Raw output under `evals/results/pipeline/<pipeline>/<checkpoint>.*`.
6. Failures → `docs/DEFECTS.md` (symptom, root cause, fix commit, regression test), separate fix commit, re-run.

Statuses: `PASS`, `FAIL`, `UNVERIFIED` (with owner command), `PENDING` (not yet run in this programme).

## 4. Observability contract

- **Trace**: every send carries a `traceId` (128-bit hex, `crypto.getRandomValues`). Spans: `prompt.assemble`,
  `retrieval`, `rerank`, `tool.call`, `engine.request`, `engine.stream`, `persist`. Each span: name, start/end
  (ms, monotonic), status, attributes.
- **Content capture** default OFF: spans/inspect records store SHA-256 hashes and lengths of content, never the
  text. With `developer.traceContentCapture=true` the text is stored too.
- **Retention cap**: at most `developer.traceRetention` traces (default 200, max 2000), oldest evicted first;
  records older than 7 days are evicted on write.
- **Inspect request** (`developer.inspectRequests`, default OFF): per assistant message, the exact engine request
  body, model identity (engine model name, digest = SHA-256 of the GGUF blob, blob path, quantization, context
  length, family), sampling parameters, per-section character counts and engine-reported token counts, raw
  final response with usage and timings. Cloud requests (when built) record provider, host, model and the body
  with the API key redacted to `***`.
- **Debug API** (`GET /api/debug/inspect`): returns 404 unless `developer.inspectRequests=true`; returns 401
  unless header `x-sanctum-debug-token` equals the per-process token written to
  `<dataDir>/debug_token` (0600-equivalent, regenerated at server start). Absent from release defaults.
- **Call counters**: per role `chat`, `embedding`, `reranker`, `asr`, `tts`, `vision`, `cloud`. Incremented only
  at the actual engine/provider call site. Negative controls must show 0 when the feature is off.

## 5. Acceptance thresholds (fixed before measurement)

| Pipeline / checkpoint | Metric | Threshold |
|---|---|---|
| P1 hashes | GGUF blob SHA-256 vs registry digest | exact equality |
| P1 health | health when engine down | must report engine offline (never "ok") |
| P2 prompt fidelity | user text in engine request body | byte-exact (NFC not applied) |
| P2 template | Ollama `prompt_eval_count` vs oracle `tokenize(apply-template(messages))` | exact equality; any difference is FAIL and is investigated, not toleranced |
| P2 streaming | final text vs concatenation of streamed deltas vs saved message | byte-exact |
| P2 usage | UI-shown token counts vs engine `prompt_eval_count`/`eval_count` | exact equality |
| P3 identity | answering model digest vs selected model digest (`/api/ps`) | exact equality |
| P4 determinism | temperature 0 + fixed seed, 5 runs | 5/5 byte-identical outputs |
| P4 parameters | every sampling/load parameter present in engine request with the set value | 100% |
| P4 JSON schema | constrained outputs parsing and validating against schema | 20/20 |
| P5 token count | Sanctum count vs engine tokenizer | exact equality (if Sanctum estimates, the estimate is labelled as such and never used for budget decisions) |
| P6 extraction | fixture text vs ground truth (whitespace-normalised) | exact equality for text/Markdown; ≥ 0.99 character similarity for PDF |
| P6 chunk length | every chunk's token count vs embedding model max sequence length | 100% ≤ max |
| P6 embedding determinism | same input, 3 runs | cosine ≥ 0.99999 |
| P6 batch vs single | N-batch vs N single calls | cosine ≥ 0.9999 per item |
| P6 reference fidelity | quantized local vs canonical reference vectors (fixed sentence list) | mean cosine ≥ 0.99, min ≥ 0.98 |
| P6 semantic sanity | labelled pairs: similar > unrelated | ≥ 95% of pairs |
| P6 vector store | store top-k vs brute force | recall@10 = 1.0 for exact (flat) index; ≥ 0.95 if an ANN index is introduced |
| P6 retrieval quality | recall@5 on labelled canary set (n ≥ 30) | ≥ 0.90 hybrid; dense-only baseline reported |
| P6 cross-workspace canary | appearances in other workspace's retrieval / prompt / answer | 0 |
| P6 answer accuracy | canary questions answered correctly with citation (n ≥ 30) | ≥ 0.85 |
| P6 ablation | canary fact stated after passage removed | ≤ 0.05 |
| P6 abstention | no-answer questions that abstain (n ≥ 20) | ≥ 0.80 |
| P6 injection | documents with injected instructions that change behaviour or trigger tools | 0 |
| P7 ASR | WER on canary audio | ≤ 0.15 |
| P8 permissions | tool executions without matching approval | 0 |
| P8 arguments | executed arguments vs approved arguments | byte-exact |
| P8 real-model tool calling | reliability | reported with n; no threshold (informational) |
| P9 secrets | API-key canary occurrences in UI, logs, ledger, traces, files | 0 |
| P9 fallback | automatic local↔cloud fallbacks | 0 |
| P11 egress | unexplained outbound connections in full-workflow capture (cloud off) | 0 |
| P12 downloads | installed file hash vs verified hash vs engine-loaded file | exact equality |
| P13 controls | visible controls without a proven effect | 0 |

Sample sizes are reported beside every rate. A rate measured on fewer samples than stated is `UNVERIFIED`.
