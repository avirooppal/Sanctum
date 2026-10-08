# Sanctum — Local Private AI Platform (working name)

> One install. Models, RAG, speech, vision, and agents running entirely on-device or inside a private network. Provably no data leaves unless you explicitly allow it.

Last researched: 2026-10-06. Model names and benchmarks move monthly; anything marked **(verify)** should be re-checked at build time.

---

## 1. Why this exists (the gap)

The current ecosystem is a pile of good-but-separate parts:

- **Runtimes** (Ollama, llama.cpp, LM Studio, vLLM, LocalAI) run models but are not products.
- **UIs** (Open WebUI, LibreChat, LobeHub, Big-AGI) chat well, but RAG/voice/vision/agents are plugin-grade.
- **RAG apps** (AnythingLLM, PrivateGPT) do documents well but are thin on speech, vision, and governed agents.
- **App builders** (Dify, Flowise) do workflows but are not privacy-first or hardware-aware.

Nobody ships **all of it as one coherent, verifiable-private, hardware-adaptive platform**. Also, "private" is usually a claim, not a property: a self-hosted UI becomes non-private the moment someone pastes a cloud API key.

**Thesis:** build the platform where privacy is *enforced and auditable by construction*, and where every modality (text, speech, vision, documents, agents) shares one runtime, one identity/permission model, and one memory/knowledge layer.

---

## 2. Landscape survey: what to learn from each

| Project | Category | Steal this | Gap we exploit |
|---|---|---|---|
| **Open WebUI** | Team chat UI over Ollama/OpenAI APIs | Multi-user, RBAC, model/tool "workspaces", OpenAI-compatible backend plug-in, polished UX | RAG is basic; no hardware-aware runtime; privacy is by convention; Docker networking pain between UI and runtime on separate hosts |
| **AnythingLLM** | Private docs + turnkey RAG, desktop + Docker | Workspaces as the unit of knowledge, one-click desktop, agent skills | Private only if you don't attach a cloud key; shallow speech/vision; limited governance |
| **LM Studio / Jan / Msty** | Desktop local-LLM apps | Zero-setup onboarding, model browser with "will it fit?" hints, polished UX | Single-user; no team/private-network mode |
| **Ollama** | Dead-simple runtime + library | `pull`/`run` ergonomics, auto VRAM management, huge model catalog | No continuous batching (sequential requests), so it falls over with several users |
| **llama.cpp** | The engine under most tools | Hardware breadth (CPU/GPU hybrid, Apple, Vulkan), GGUF ecosystem | Not multi-tenant serving |
| **vLLM / SGLang** | High-throughput serving | PagedAttention, continuous batching, prefix caching, OpenAI-compatible API; the right choice for 5-100 concurrent users | Heavy setup, NVIDIA-centric; not a product |
| **LocalAI** | OpenAI-compatible multi-modal API server | One API for LLM + STT + TTS + images; pluggable backends (including a parakeet.cpp ASR backend) | Infra-first; weak end-user UX and governance |
| **PrivateGPT** | Developer-controlled RAG | Clean ingestion API, offline-first | Narrow scope |
| **Dify / Flowise** | Visual workflow + agent builders | Node-graph workflows, prompt studio, multi-tenancy | Cloud-leaning; privacy not core |
| **haiku.rag** | Embedded agentic RAG | LanceDB embedded (no server), Docling parsing, hybrid search (vector + FTS with Reciprocal Rank Fusion), cross-encoder reranking, visual grounding, MCP server | Library, not platform |
| **Docling / Marker** | Document parsing | Structure-preserving PDF/DOCX/PPTX parsing (tables, headings, figures) | Component only |
| **ColPali / ColQwen family** | Visual document retrieval | Retrieve page images directly via late interaction, skipping lossy OCR | Storage-heavy (many vectors per page), so needs compression strategy |
| **parakeet.cpp, faster-whisper, whisper.cpp** | Local ASR | Parakeet is dramatically faster on CPU with comparable or better English accuracy; Whisper wins on language breadth and flexibility; streaming with end-of-utterance detection is available | Components only |
| **AerolVM, gVisor, Firecracker** | Agent sandboxes | Per-sandbox egress control, microVM isolation | Containment ≠ governance (see §8) |

**Key lessons distilled**

1. Ship a **desktop one-click mode** (LM Studio / AnythingLLM feel) *and* a **server/team mode** (Open WebUI feel) from the same codebase.
2. Separate **engine** from **experience**: use best-in-class engines behind a stable internal contract, don't write your own kernels.
3. Pick the inference engine **by workload**: llama.cpp/MLX for single-user and non-NVIDIA, vLLM or SGLang for multi-user GPU serving. TGI went into maintenance mode in March 2026 and points to these, so don't build on it.
4. Parse documents structurally (Docling-class), retrieve hybrid, rerank, and for visually dense docs add page-image retrieval.
5. Sandboxing alone doesn't stop an authorized tool call from leaking data. You need a **policy engine** on top.

---

## 3. Product principles

1. **Private by construction.** Default-deny network egress for every component. Cloud is an explicit, per-workspace, logged, revocable *connector*, never a hidden fallback.
2. **Verifiable.** A "Privacy Ledger" proves what left the box (ideally: nothing). Ship a self-test that tries to phone home and fails.
3. **Hardware-adaptive.** Detect GPU/VRAM/RAM/NPU and pick a runtime and model profile automatically. Tell the user honestly what will and won't run.
4. **One brain, many modalities.** Text, voice, vision, docs, and agents share auth, memory, knowledge, tools, and audit.
5. **Boring to install.** `curl | sh` or a signed desktop installer, then a first answer in under 5 minutes. Air-gapped bundle supported.
6. **Open standards over lock-in.** OpenAI-compatible API, MCP for tools, OpenTelemetry for observability, GGUF/safetensors for models, OIDC for identity.
7. **Measured, not vibes.** Every release runs an eval suite (RAG quality, ASR WER, latency, agent success, privacy tests).

---

## 4. Target users and modes

| Mode | User | Footprint | Notes |
|---|---|---|---|
| **Solo / Desktop** | Individual, laptop/workstation | Single binary + app shell (Tauri) | llama.cpp / MLX engine, embedded stores, no Docker needed |
| **Team / Server** | Small team or department, private LAN | Docker Compose or Helm | vLLM/SGLang option, Postgres, OIDC SSO, RBAC |
| **Air-gapped / Regulated** | Clinics, law, finance, gov | Offline signed bundle | No internet ever; model bundle import, audit export |
| **Edge / Appliance** (later) | Home-lab, small office box | ARM/x86 mini-PC with NPU | Pre-tuned profile |

---

## 5. Architecture

```
                         ┌────────────────────────────────────────────┐
                         │                 Clients                    │
                         │ Web UI · Desktop (Tauri) · Mobile PWA ·    │
                         │ CLI · VS Code/JetBrains · OpenAI-API apps  │
                         └──────────────────┬─────────────────────────┘
                                            │ HTTPS / WebSocket / WebRTC
┌───────────────────────────────────────────▼─────────────────────────────────────────┐
│ GATEWAY / CONTROL PLANE                                                             │
│ AuthN (local + OIDC) · RBAC/ABAC · Rate limits · OpenAI-compatible API ·            │
│ Policy engine (egress, tools, data classes) · Audit + Privacy Ledger · Quotas       │
└───────┬────────────┬───────────────┬──────────────┬───────────────┬─────────────────┘
        │            │               │              │               │
┌───────▼─────┐ ┌────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼───────┐
│ INFERENCE   │ │ SPEECH    │ │ VISION &    │ │ KNOWLEDGE  │ │ AGENT        │
│ Router +    │ │ VAD · ASR │ │ DOCUMENTS   │ │ (RAG)      │ │ RUNTIME      │
│ Scheduler   │ │ streaming │ │ VLM · OCR · │ │ ingest ·   │ │ planner ·    │
│ backends:   │ │ diarize · │ │ layout ·    │ │ hybrid     │ │ MCP tools ·  │
│ llama.cpp / │ │ TTS ·     │ │ doc parsing │ │ search ·   │ │ sandbox ·    │
│ MLX / vLLM /│ │ wake word │ │             │ │ rerank ·   │ │ memory       │
│ SGLang      │ │           │ │             │ │ visual RAG │ │              │
└───────┬─────┘ └────┬──────┘ └──────┬──────┘ └─────┬──────┘ └──────┬───────┘
        └────────────┴───────┬───────┴──────────────┴───────────────┘
                             │
        ┌────────────────────▼───────────────────────────────────────┐
        │ STORAGE: Postgres (meta, auth, audit) · LanceDB/pgvector   │
        │ (vectors) · Object store (files) · Encrypted at rest       │
        └────────────────────────────────────────────────────────────┘
        ┌────────────────────────────────────────────────────────────┐
        │ OBSERVABILITY & EVAL: OpenTelemetry · metrics · trace      │
        │ replay · continuous eval harness                           │
        └────────────────────────────────────────────────────────────┘
```

### Design rules
- Every box is a **separate process behind a gRPC/HTTP contract** so engines can be swapped (e.g., faster-whisper → Parakeet → a future model) without touching product code.
- The **gateway is the only ingress** and the **only component with an allow-listed egress**, and only when a cloud connector is explicitly enabled.
- A **modality-agnostic request envelope** carries `user, workspace, data_class, trace_id, policy_context`, so policy and audit work identically for chat, voice, and tools.

---

## 6. Module specifications

### 6.1 Inference layer (the engine room)
**Goal:** best tokens/sec per hardware tier with zero user tuning.

- **Backends (pluggable):**
  - `llama.cpp` (GGUF): default for CPU, hybrid CPU/GPU, AMD/Intel/Vulkan, single-user.
  - `MLX`: Apple Silicon fast path for safetensors models.
  - `vLLM` and/or `SGLang`: multi-user GPU serving, continuous batching, prefix caching. Default when ≥1 NVIDIA GPU *and* team mode.
- **Hardware profiler:** detect GPU/VRAM/RAM/CPU features/NPU; pick backend + quantization + context length + KV-cache settings.
- **Router/scheduler:**
  - Model registry with capabilities (text, vision, tools, reasoning, embedding, rerank, ASR, TTS).
  - Routing by task: small fast model for classification/tool-routing, larger model for reasoning.
  - Request queue with priorities (interactive voice > chat > batch ingestion).
  - Model lifecycle: lazy load, keep-warm, evict by LRU under VRAM pressure.
- **Features to include (table stakes in 2026):** continuous batching (server mode), prefix/KV caching, speculative decoding (draft model), structured output / JSON-schema constrained decoding, tool calling, reasoning-mode toggle, multi-LoRA hot-swap (later).
- **Model sourcing:** pull from a local mirror or Hugging Face when allowed; **hash-verified, signed model bundles** for air-gapped installs.
- **Model families to profile (verify current):** Qwen3/3.5 line (Apache 2.0, strong all-rounder, good MoE perf-per-VRAM), Gemma 4 line (multimodal, strong on Apple Silicon), gpt-oss 20B/120B (Apache 2.0, reasoning), Llama family (biggest fine-tune ecosystem), DeepSeek distills (reasoning), Qwen-Coder-class for code, Phi-class for tiny devices. **Don't hardcode names**; ship *profiles* (see §7) that map to whatever is best that quarter.

### 6.2 Speech
- **Pipeline:** VAD (Silero-class) → streaming ASR → (optional) diarization → LLM → streaming TTS, with barge-in and end-of-utterance detection.
- **ASR engines (behind one interface):**
  - **Parakeet-class (NVIDIA, via ONNX/ggml ports)**: default for English and major European languages, very fast on CPU, streaming variants with EOU detection exist.
  - **faster-whisper (CTranslate2)**: default server transcription; broadest language coverage.
  - **whisper.cpp**: portable fallback for CPU/Apple.
  - Auto-select by language + hardware; user can pin.
- **Features:** live captions, meeting mode (diarization + summary + action items, saved into Knowledge), push-to-talk dictation anywhere (desktop), wake word (optional), custom vocabulary / hotwords.
- **TTS:** pluggable (Piper-class for CPU-light, a larger neural TTS when GPU available). Voice cloning off by default and gated by policy.
- **Latency SLO (voice turn):** < 800 ms from end-of-speech to first audio on the recommended tier (verify with benchmark in §11).
- **Protocol:** WebRTC/WebSocket streaming; also expose OpenAI-compatible `/v1/audio/*` endpoints.

### 6.3 Vision and document understanding
- **VLM chat:** images, screenshots, charts via a multimodal model (profile-selected).
- **Document parsing:** Docling-class structural parser (headings, tables → Markdown/HTML, figures, formulas, reading order) with Marker as an alternate; OCR for scans; table and figure captions generated by the VLM and stored as retrievable text.
- **Pipelines:** screenshot/UI understanding (for agents), receipt/invoice extraction with schema-constrained output, handwriting/OCR fallback.
- **Video (stretch):** frame sampling + ASR track → searchable timeline.

### 6.4 Knowledge / RAG (the part to make genuinely SOTA)
**Ingestion**
1. Connectors: local folders (watch), upload, Git repos, Obsidian/Markdown vaults, email/IMAP, WebDAV/SMB/S3, Confluence/Notion exports. All pull-based from inside the private network.
2. Parse (Docling-class) → structure-aware chunking (respect headings/tables; parent-child chunks) → contextual chunk enrichment (short LLM-generated situating summary) → embed.
3. Dedup + versioning + incremental re-index by content hash.
4. **Per-document ACLs and data classification at ingest**, inherited by chunks, enforced at *query time* (not just UI).

**Retrieval (default pipeline)**
```
query → rewrite/decompose (small model)
      → parallel: dense vector + BM25/FTS  → Reciprocal Rank Fusion (top ~100)
      → metadata / ACL filter (pre-filter, never post-hoc)
      → cross-encoder rerank (top ~20) → context assembly (parent expansion, dedupe)
      → answer with citations + page/region highlights
      → groundedness check (does each claim map to a citation? else abstain/ask)
```
- **Embeddings:** multilingual open model (bge-m3-class or a newer Qwen-embedding-class, verify) with Matryoshka dims to shrink storage.
- **Rerankers:** open-license cross-encoder by default (BGE-reranker-v2-m3 class, Apache 2.0). **Check licenses**: some popular rerankers (e.g., Jina v2 weights) are non-commercial.
- **Visual retrieval (differentiator):** optional ColPali/ColQwen-class page-image index for slide decks, scanned PDFs, dense tables/charts. Use it as a *second retriever* fused with text retrieval; compress multi-vectors (binarization/pooling) to control storage.
- **Graph/global queries (later):** lightweight entity/relationship graph for "summarize across everything" questions (GraphRAG-style), built lazily per workspace.
- **Agentic RAG:** the agent may issue multiple searches, follow citations, and run SQL/table queries over extracted tables.
- **Stores:** LanceDB embedded for solo mode (no server); Postgres + pgvector (+ FTS) for team mode. Same abstraction.
- **Trust UX:** every answer shows sources, confidence, and "what I could not find."

### 6.5 Agent runtime
- **Core loop:** plan → tool call → observe → reflect, with budgets (steps, tokens, wall-time, $-equivalent compute) and a hard stop.
- **Tools via MCP** (client + server): the platform's own tools (search knowledge, transcribe, OCR, run code) are exposed as an MCP server, so external agents and IDEs can use them.
- **Built-in tools:** knowledge search, file ops (scoped), code execution (sandboxed), browser/web (only if egress allowed, via an allowlist proxy), calendar/email (local connectors), SQL (read-only by default).
- **Sandbox:** containers by default; **gVisor** (user-space kernel) for stronger isolation; **Firecracker microVMs** for untrusted code in server mode. Per-sandbox egress control, CPU/mem/time quotas, ephemeral filesystems.
- **Memory:** short-term (thread), long-term (user facts/preferences, editable and exportable by the user), project memory (per workspace). Memory is data, so it follows the same ACL/classification rules.
- **Workflows:** visual graph builder (Dify/Flowise-inspired) that compiles to the same runtime; scheduled and event-triggered runs (new file, new email, new meeting).
- **Human-in-the-loop:** approval gates for side-effecting actions, with diff previews.

### 6.6 Control plane, security, and governance
- **Identity:** local accounts + OIDC/SAML SSO; API keys scoped per workspace/model/tool.
- **Authorization:** RBAC for roles, ABAC for data classes (public / internal / confidential / restricted), per-workspace model and tool allow-lists.
- **Policy engine** (OPA/Cedar-style, declarative): examples:
  - "Restricted-class documents may only be processed by local models."
  - "Agent X may call `search_knowledge` and `read_file` in workspace W only."
  - "No tool output from the web may be written to long-term memory without review."
- **Privacy Ledger:** append-only, hash-chained log of every model call, tool call, retrieval, and (if any) egress, queryable and exportable; plus a UI view "what left this machine: nothing / these N requests."
- **Egress enforcement:** network namespaces / firewall rules per component, DNS sinkhole, single allowlisted egress proxy. **Startup self-test** asserts that blocked destinations are unreachable.
- **Encryption:** disk-level or app-level encryption at rest (per-workspace keys), TLS everywhere (mTLS between internal services in server mode), secrets in OS keychain / sealed secrets.
- **Supply chain:** pinned, signed images; SBOM; model hash verification; reproducible builds target.

---

## 7. Hardware tiers and default profiles

Profiles are **config, not code**; update them with the eval harness each quarter. Model names are examples **(verify)**.

| Tier | Typical hardware | Engine | Chat/reasoning | Vision | ASR | Embeddings/Rerank |
|---|---|---|---|---|---|---|
| **T0 Tiny** | 8 GB RAM, no GPU | llama.cpp (CPU) | ~4B-class Q4 | small VLM or none | Parakeet small / whisper-small | small embed + no/small reranker |
| **T1 Laptop** | 16 GB RAM / 8 GB VRAM / M-series 16 GB | llama.cpp or MLX | 8-14B dense or ~30B MoE with few active params | 12B-class multimodal | Parakeet / whisper-turbo | bge-m3-class + reranker |
| **T2 Workstation** | 24 GB VRAM / M-series 64 GB+ | llama.cpp / MLX / vLLM | ~30B dense or 100B+ MoE (e.g., gpt-oss-120B on high-memory Macs) | strong multimodal | Parakeet + diarization | full RAG stack + visual index |
| **T3 Team server** | 1-4 GPUs (48-160+ GB total) | **vLLM / SGLang** | largest MoE that fits, prefix caching | dedicated VLM instance | dedicated ASR workers | dedicated embed/rerank workers |

UX rule: show a **"will it fit / how fast"** estimate before downloading any model.

---

## 8. Threat model (summary)

| Threat | Mitigation |
|---|---|
| Accidental cloud leakage (user pastes cloud API key) | Cloud connectors are policy-gated per workspace, loudly badged in UI, and logged in the Privacy Ledger; default OFF |
| Prompt injection via documents/web/email | Treat retrieved content as untrusted data: separate channels, strip/flag instructions, tool calls triggered by untrusted content require approval, output filters for exfil patterns (URLs, base64 blobs) |
| Malicious/compromised MCP server or tool | Signed/pinned tool manifests, per-tool permission scopes, sandboxed execution, egress deny |
| Agent exfiltration through *authorized* tools | Sandboxing can't see intent, so enforce **policy engine rules on data flow** (data class → tool), taint tracking on sensitive context, approval gates |
| Cross-tenant data leakage in RAG | ACL pre-filtering at retrieval, per-workspace indexes/keys, tests that try cross-workspace queries |
| Poisoned model weights | Hash/signature verification; prefer safetensors/GGUF from verified sources; scan bundles |
| Insider access | RBAC, audit, optional encryption with per-workspace keys, break-glass flow |
| Disk theft | Encryption at rest |

---

## 9. Tech stack (opinionated defaults)

| Concern | Choice | Why / alternative |
|---|---|---|
| Core services | **Rust** (gateway, scheduler, policy) + **Python** (ML glue: parsing, embeddings, evals) | Rust for safety/perf at the edge; Python where the ML libs live. Go is a reasonable alternative for the gateway |
| Desktop shell | **Tauri** | Small footprint vs. Electron |
| Web UI | **React/Next or SvelteKit + Tailwind**, PWA | Streaming UI, voice via WebRTC |
| API | **OpenAI-compatible** REST + WebSocket; **gRPC** internal | Drop-in for existing apps |
| Tools | **MCP** (client + server) | Ecosystem standard |
| Metadata DB | **SQLite** (solo) / **Postgres** (team) | Same schema via migrations |
| Vectors/FTS | **LanceDB** (solo) / **pgvector + Postgres FTS** (team) | Embedded vs. server |
| Queue | In-process (solo) / **NATS or Redis Streams** (team) | Keep optional |
| Policy | **OPA/Rego or Cedar** | Declarative, testable |
| Observability | **OpenTelemetry**, Prometheus, Grafana, Langfuse-style trace viewer (self-hosted) | No SaaS telemetry |
| Packaging | Signed installers, Docker Compose, Helm chart, offline bundle (OCI tarballs + model pack) | Air-gap friendly |
| Auth | OIDC (Keycloak/Authentik compatible) | Enterprise SSO |

---

## 10. Roadmap

Time estimates assume one strong full-stack builder working steadily; compress by cutting scope, not quality gates.

### Phase 0 — Foundations (Weeks 1-2)
- Repo, CI, monorepo layout (§13), architecture decision records.
- Internal contracts (protobuf/OpenAPI), request envelope, trace IDs.
- Hardware profiler + model registry skeleton.
- **Exit:** `sanctum doctor` prints hardware tier and recommended profile.

### Phase 1 — Chat core (Weeks 3-5)
- Inference router with llama.cpp (+ MLX on Mac); OpenAI-compatible `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`.
- Model download manager with hash verification and "will it fit" estimates.
- Web UI: chat, model picker, streaming, conversation storage (SQLite).
- Local auth.
- **Exit:** install → first answer < 5 min on a clean machine; passes OpenAI-SDK compatibility tests.

### Phase 2 — Knowledge (Weeks 6-9)
- Ingestion (folders + upload), Docling-class parsing, structure-aware chunking.
- Hybrid retrieval + RRF + reranker; citations with page highlights.
- Workspaces + per-doc ACLs enforced at retrieval.
- Eval harness v1 (§11) wired into CI.
- **Exit:** beats a naive vector-only baseline on your eval set by a clear margin (track recall@k, answer faithfulness).

### Phase 3 — Speech (Weeks 10-12)
- VAD + streaming ASR (Parakeet-class and faster-whisper behind one interface), push-to-talk dictation, file transcription with diarization.
- TTS + voice chat loop with barge-in.
- Meeting mode → summary + action items → into Knowledge.
- **Exit:** voice-turn latency and WER meet SLOs on T1 hardware.

### Phase 4 — Vision (Weeks 13-14)
- VLM chat, OCR pipeline, table/figure captioning into the index.
- Optional ColPali-class visual retriever fused with text retrieval.
- **Exit:** visual-doc QA benchmark shows measurable lift on slide/scan-heavy sets.

### Phase 5 — Agents and policy (Weeks 15-19)
- MCP client/server, tool registry with scopes, agent loop with budgets.
- Sandbox: container → gVisor → (server mode) Firecracker.
- Policy engine, approval gates, Privacy Ledger UI, egress enforcement + startup self-test.
- Workflow builder (minimal): triggers → steps → tools.
- **Exit:** red-team suite (prompt injection, exfil attempts, cross-tenant queries) passes; ledger shows zero unexpected egress.

### Phase 6 — Team mode and hardening (Weeks 20-24)
- vLLM/SGLang backend, queueing/priorities, Postgres/pgvector, OIDC SSO, quotas.
- Helm chart, offline bundle, signed releases, SBOM, encrypted-at-rest.
- Load tests (concurrent users), observability dashboards.
- **Exit:** 20 concurrent users on a reference server meet latency SLOs; air-gapped install verified.

### Phase 7 — Polish and ecosystem (Weeks 25+)
- Desktop installer (Tauri), mobile PWA, IDE plugin, plugin SDK, template gallery.
- Docs, demo videos, benchmark page, public eval leaderboard for profiles.

### Suggested MVP cut (if time is tight, ship in ~8 weeks)
Phases 0-2 + push-to-talk dictation from Phase 3 + the Privacy Ledger/egress self-test. That alone is already a differentiated "verifiably private, great-RAG" product.

---

## 11. Evaluation and quality gates

Build the eval harness **before** tuning anything. Run it in CI on every profile change.

| Area | Metrics | Datasets / method |
|---|---|---|
| Retrieval | recall@k, MRR, nDCG; hybrid vs. vector-only ablation | Your own labeled Q→passage set + public sets (BEIR/MTEB-style, domain slices) |
| RAG answers | faithfulness/groundedness, citation precision, abstention correctness | LLM-as-judge (local judge) + human spot checks |
| Visual docs | page-retrieval accuracy, answer accuracy on charts/tables | DocVQA-style sets, your own slides/scans |
| ASR | WER by language/accent/noise, real-time factor, streaming latency | Open ASR leaderboard-style sets + your own recordings |
| Voice loop | end-of-speech → first audio ms, barge-in success | Scripted harness |
| Inference | tokens/s, TTFT, throughput under N users, VRAM headroom | Reproducible bench script per tier |
| Agents | task success rate, steps-to-success, budget overruns, unsafe-action rate | Task suite + red-team prompts |
| Privacy | zero unexpected egress, ACL leak tests, injection resistance | Automated adversarial tests; network capture in CI |

**Release gate:** no regression > X% on any tracked metric without a written exception.

---

## 12. API surface (initial)

- `POST /v1/chat/completions` · `POST /v1/embeddings` · `GET /v1/models` (OpenAI-compatible, incl. tools/JSON schema)
- `POST /v1/audio/transcriptions` · `POST /v1/audio/speech` · WebSocket `/v1/realtime` (voice)
- `POST /v1/rerank`
- `POST /v1/workspaces` · `POST /v1/workspaces/{id}/documents` · `POST /v1/workspaces/{id}/search` · `POST /v1/workspaces/{id}/ask`
- `POST /v1/agents` · `POST /v1/agents/{id}/runs` · `GET /v1/runs/{id}/events` (SSE)
- `GET /v1/ledger` (audit/Privacy Ledger) · `GET /v1/policies` · `POST /v1/policies`
- MCP server exposing search/transcribe/OCR/run tools.

---

## 13. Repo layout (monorepo)

```
sanctum/
├─ apps/
│  ├─ web/                 # UI
│  ├─ desktop/             # Tauri shell
│  └─ cli/                 # sanctum CLI (doctor, pull, serve, ingest)
├─ services/
│  ├─ gateway/             # authN/Z, API, policy hooks, ledger  (Rust)
│  ├─ inference/           # router, scheduler, backend adapters
│  ├─ speech/              # vad, asr, tts, diarization
│  ├─ vision-docs/         # parsing, OCR, VLM pipelines
│  ├─ knowledge/           # ingest, index, retrieve, rerank, ACL
│  ├─ agents/              # loop, MCP, sandbox manager
│  └─ policy/              # rego/cedar bundles + tests
├─ profiles/               # hardware-tier → model/engine configs
├─ evals/                  # datasets, harnesses, CI gates
├─ deploy/                 # compose, helm, offline-bundle builder
├─ docs/                   # ADRs, threat model, user docs
└─ tools/                  # bench scripts, model signer, egress self-test
```

---

## 14. Differentiators (what makes it "SOTA" rather than "another wrapper")

1. **Verifiable privacy:** egress self-test + hash-chained Privacy Ledger + policy-enforced data classes.
2. **Unified modalities on one runtime, one permission model.**
3. **Hardware-adaptive profiles** with honest "will it fit" UX and auto engine selection (llama.cpp/MLX ↔ vLLM/SGLang).
4. **Best-in-class RAG:** structure-aware parsing + hybrid + rerank + visual retrieval + groundedness checks + ACL-at-retrieval.
5. **Governed agents:** MCP tools, sandbox tiers, and data-flow policy, not just containment.
6. **Air-gapped bundles** with signed models.
7. **Public eval suite and benchmark page**, so claims are reproducible.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope explosion (it's 5 products) | Hard phase gates; MVP cut in §10; each module behind a stable contract so it can ship thin first |
| Model/engine churn | Profiles-as-config, adapter interfaces, quarterly profile refresh via evals |
| Hardware fragmentation (CUDA/ROCm/Metal/Vulkan/NPU) | Lean on llama.cpp/MLX for breadth; support matrix published; CI on at least one machine per class |
| Multi-vector visual index storage cost | Make visual retrieval optional; pooling/binarization; per-workspace toggle |
| Voice latency on modest hardware | Streaming everywhere, small ASR default, speculative decoding, tiered TTS |
| Licensing traps (non-commercial weights, restrictive model licenses) | License field in model registry; policy to block incompatible licenses in "commercial" mode |
| "Private" claims being wrong | Automated egress tests in CI; third-party review before 1.0 |
| Solo-builder bandwidth | Lean on existing components (Docling, LanceDB, llama.cpp, vLLM, faster-whisper, MCP); write glue, policy, UX, and evals, which is where the value is |

---

## 16. First 10 days (concrete start)

1. Day 1-2: repo + CI; write `sanctum doctor` (hardware detection) and the model registry schema.
2. Day 3-4: llama.cpp adapter + OpenAI-compatible `/v1/chat/completions` with streaming; test with the official OpenAI SDK.
3. Day 5: minimal web chat UI; SQLite conversations.
4. Day 6-7: egress-deny-by-default container network + the **startup self-test** (do this early; it shapes everything).
5. Day 8-9: ingestion v0 (folder → Docling-class parse → chunk → embed → LanceDB) and hybrid search endpoint.
6. Day 10: eval harness skeleton with 30-50 hand-labeled questions over your own documents; baseline numbers recorded.

---

## 17. Reference inspirations and further reading

- Open WebUI, AnythingLLM, LibreChat, LobeHub, Big-AGI, Jan, LM Studio, Msty, PrivateGPT, Dify, Flowise: UX and feature benchmarks.
- Ollama, llama.cpp, MLX, vLLM, SGLang, LocalAI: engines and API surface.
- haiku.rag, Docling, Marker: local-first RAG and parsing patterns.
- ColPali/ColQwen family: visual document retrieval.
- Parakeet (incl. parakeet.cpp), faster-whisper, whisper.cpp, Open ASR Leaderboard: speech.
- gVisor, Firecracker, AerolVM-style sandboxes, OWASP agentic-security guidance: agent isolation and tool-misuse risks.
- Model Context Protocol: tool interoperability.