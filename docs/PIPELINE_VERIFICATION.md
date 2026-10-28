# Sanctum End-to-End Pipeline Verification Report

Every checkpoint is verified with empirical evidence. No checkpoint is verified by reading code alone.

Status definitions:
- **PASS**: Checked with empirical evidence (commands, logs, outputs under `evals/results/pipeline/`), passing all pre-set ADR 0105 acceptance criteria.
- **FAIL**: Run failed to meet acceptance criteria; defect logged in `docs/DEFECTS.md`.
- **UNVERIFIED**: Requires owner-only action (e.g., real third-party cloud API keys or specific hardware packs not present) with documented command.
- **PENDING**: Scheduled for execution in the current milestone sequence.

---

## Master Checkpoint Table

| Pipeline | Checkpoint | Expectation | Method / Observable Hook | Evidence File | Status |
|---|---|---|---|---|---|
| **V0** | Baseline Suite | Existing 77 node tests, TS compile, Next.js build, and architecture check pass without errors | `npm test`, `npx tsc`, `npx next build`, `python tools/check_architecture.py` | `evals/results/pipeline/baseline/` | **PASS** |
| **V0** | Baseline Reality Probe | Pre-fix probe captures synthetic stand-ins (D-001, D-002) when engine is offline | `tools/pipeline/baseline_probe.ts` | `evals/results/pipeline/baseline/reality_probe_prefix.json` | **PASS** (Evidence recorded) |
| **V0** | Trace Spans & Content Gating | Traces record spans and timestamps; text replaced by SHA256 when captureContent=false | `tests/observability.test.ts` (Tracer suite) | `evals/results/pipeline/v0/observability.pass.txt` | **PASS** |
| **V0** | Call Counters Negative Control | Call counters stay 0 when roles not invoked; increment only on real call | `tests/observability.test.ts` (CallCounters suite) | `evals/results/pipeline/v0/observability.pass.txt` | **PASS** |
| **V0** | Prompt Assembly Contract | System prompt first, passages untrusted & delimited in order, user text byte-exact | `tests/observability.test.ts` (Prompt assembly suite) | `evals/results/pipeline/v0/observability.pass.txt` | **PASS** |
| **V0** | Ollama Engine Client Zero-Fallback | LocalEngineClient streaming throws EngineUnavailableError when unreachable; zero synthetic reply | `tests/observability.test.ts` (Ollama client suite) | `evals/results/pipeline/v0/observability.pass.txt` | **PASS** |
| **V0** | Debug API Gating | Debug inspect endpoint returns 404 when disabled, 401 when token invalid, 200 with valid token | `tests/observability.test.ts` (Debug API gate suite) | `evals/results/pipeline/v0/observability.pass.txt` | **PASS** |
| **P1** | GGUF Blob SHA-256 Digest | Local model file on disk matches registry SHA-256 hash exactly | `tools/pipeline/ollama_blob.py qwen3:1.7b --verify` | `evals/results/pipeline/p1/blob_digest_qwen3_1.7b.json` | **PASS** |
| **P1** | Engine Readiness & Oracle Endpoints | Pinned llama.cpp server b11913 serves /health, /props, /slots, /metrics | `tools/pipeline/fetch_llama_oracle.py`, HTTP probe | `evals/results/pipeline/p1/oracle_readiness.json` | **PASS** |
| **P1** | Truthful Health & Error Reporting | Health and status lines report error when daemon stops; zero synthetic fallback | Offline daemon integration probe | `evals/results/pipeline/p1/engine_health_offline.json` | **PENDING** |
| **P2** | Byte-Exact Prompt Delivery | User message containing Unicode, newlines, and quotes is delivered byte-exact to engine | Loopback fake + real Ollama integration | `evals/results/pipeline/p2/chat_byte_exact.json` | **PENDING** |
| **P2** | Chat Template Verification | Engine apply-template equals prompt formatting; BOS/EOS tokens truthful | Comparison with llama-server oracle /apply-template | `evals/results/pipeline/p2/chat_template_fidelity.json` | **PENDING** |
| **P2** | Streaming Integrity & Concatenation | Streamed chunks arrive in order with no drops; concatenated text equals final response | Loopback chunk test + real streaming test | `evals/results/pipeline/p2/streaming_concatenation.json` | **PENDING** |
| **P2** | Engine Metrics Truthfulness | Displayed tokens and tokens/sec equal Ollama eval_count and duration | Compare UI metrics with /api/chat done payload | `evals/results/pipeline/p2/metrics_fidelity.json` | **PENDING** |
| **P3** | Model Identity Proof | Answering model in engine response matches selected model in UI and disk SHA-256 | Inspect request payload & /api/ps | `evals/results/pipeline/p3/model_identity.json` | **PENDING** |
| **P3** | Mid-Thread Model Switch | Switching model between turns changes answering model and preserves history | Multi-turn integration test | `evals/results/pipeline/p3/model_switch.json` | **PENDING** |
| **P4** | Temperature 0 Determinism | Temperature 0 and fixed seed produce 5/5 byte-identical completions | 5 consecutive runs with qwen3:1.7b | `evals/results/pipeline/p4/temp0_determinism.json` | **PENDING** |
| **P4** | Sampling Parameters Applied | top_p, top_k, repeat_penalty, and num_predict passed in engine options | Check engine request inspection record | `evals/results/pipeline/p4/sampling_params.json` | **PENDING** |
| **P5** | Context Window Policy | Context limits tracked against model max tokens; prompt overflow handled cleanly | Large input integration test | `evals/results/pipeline/p5/context_limits.json` | **PENDING** |
| **P6** | Document Chunking & Sequences | Text chunking respects size ceilings; no chunk exceeds embedding max sequence length | VectorStore unit + integration | `evals/results/pipeline/p6/rag_chunking.json` | **PENDING** |
| **P6** | Embedding Determinism & Cosine Sanity | Identical inputs produce identical vectors; similar sentences score higher than unrelated | VectorStore cosine test | `evals/results/pipeline/p6/embedding_sanity.json` | **PENDING** |
| **P6** | RAG Retrieval & Prompt Delimitation | Retrieved passages injected into system prompt with [source] tags and untrusted warnings | Prompt assembly + inspect verification | `evals/results/pipeline/p6/rag_injection.json` | **PENDING** |
| **P6** | Canary Answer & Ablation Proof | Canary fact is answered with citation when passage present; model abstains when passage removed | Canary QA test + ablation run | `evals/results/pipeline/p6/canary_ablation.json` | **PENDING** |
| **P8** | Tool Permissions & Execution | Tool execution requires explicit approval; executes strictly approved arguments | Tool permission gate unit + integration | `evals/results/pipeline/p8/tool_permissions.json` | **PENDING** |
| **P9** | Cloud Connector Consent Gate | Cloud egress blocked without explicit consent naming host; API keys never leaked | Egress broker canary scan | `evals/results/pipeline/p9/cloud_egress_gate.json` | **PENDING** |
| **P10** | Persistence Survives Crash/Restart | Settings, threads, documents survive restart; atomic tempfile replacement | Disk persistence integrity test | `evals/results/pipeline/p10/persistence_safety.json` | **PENDING** |
| **P11** | Zero Unconsented Network Egress | Network capture shows 0 outbound connections with cloud off | verify_security.py & Wireshark/netstat log | `evals/results/pipeline/p11/zero_egress.json` | **PENDING** |
| **P12** | Model Download Hash Verification | Downloaded weights verified by SHA-256 before loading | verify_downloads.py | `evals/results/pipeline/p12/download_hash.json` | **PENDING** |
| **P13** | UI Feature Matrix Click-Coverage | All 39 settings in feature matrix bound to working interactive controls | tests/settings_reality_gate.test.ts | `docs/FEATURE_MATRIX.md` | **PASS** |
| **P14** | Standalone Packaged Exe Verification | Embedded WebView2 host runs on clean system with 0 browser accelerators and 0 outbound egress | tools/exe-verify/run_all_verification.py | `evals/results/exe/` | **PASS** |
