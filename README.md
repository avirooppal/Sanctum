<div align="center">

# 🏛️ Sanctum

### The Sovereign, Private Local AI Operating System & Cognitive Workspace

*Inspired by power-user AI platforms like [Jan](https://github.com/janhq/jan) and [Odysseus](https://github.com/odysseus-dev/odysseus).*

[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Local Engine](https://img.shields.io/badge/Engine-Ollama%20%7C%20llama.cpp%20%7C%20LM%20Studio-emerald?style=flat-square)](https://ollama.ai)
[![Privacy Shield](https://img.shields.io/badge/Telemetry-0%20Bytes%20Egress%20(Air--Gapped)-success?style=flat-square)](#-privacy--security-invariants)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

<br />

**Sanctum** is a unified, high-density client workspace engineered for executing large language models, retrieval-augmented generation (RAG), voice recognition, computer vision, and autonomous agent loops entirely on-device or within private air-gapped networks.

</div>

---

## 🧭 System Architecture & Workspace Layout

Sanctum implements a rigid, high-performance desktop layout designed for uninterrupted power-user workflows:

```
┌──────┬──────────────────────┬────────────────────────────────────────────────────────┐
│ Left │ Context Explorer     │                    Primary Canvas                      │
│ Rail │ (Left-Center)        │                    (Center/Right)                      │
│      │                      │                                                        │
│ [⊞]  │ • Catalog Search     │  • Model Hub: Quantization, VRAM & GPU Layer Offload   │
│ [💬] │ • Chat Threads       │  • Local Chat: CoT <think> Folders & Live Metrics      │
│ [⚔️]  │ • Arena Presets      │  • Model Arena: 2x/3x/4x Synchronous Split Stream      │
│ [🔍] │ • Dossier Trees      │  • Deep Research: Multi-Agent Search & Synthesis       │
│ [🗄️] │ • Vector Vaults      │  • Knowledge Vault: Drag-and-Drop & 1024d Vector Chunks│
│ [⚙️]  │ • Engine Config      │  • Engine Settings: Daemon Health & Host Endpoints     │
│      │                      │                                                        │
├──────┴──────────────────────┴────────────────────────────────────────────────────────┤
│ Hardware Telemetry Dock: CPU Cores | RAM Used | VRAM Allocation | Active TPS Meter    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Global Navigation Rail (Left)**: Instant module switching across Hub, Chat, Arena, Deep Research, Knowledge Vault, and Settings.
- **Context Explorer Panel (Left-Center)**: A collapsible utility column (`Ctrl + B`) that dynamically adapts its tools and filters to the active module.
- **Primary Canvas (Center/Right)**: Dynamic workspace rendering concurrent chat streams, split-screen model battles, markdown document readers, or vector inspection graphs.
- **Hardware Telemetry Dock (Bottom)**: Desktop-style persistent status bar displaying live logical core loads, physical RAM/VRAM allocations, and daemon latency.

---

## ⚡ Core Capabilities

### 1. 🧠 System & Model Engine Hub
- **Auto-Discovery**: Automatically probes your local Ollama daemon (`http://localhost:11434`) or OpenAI-compatible backends (`LM Studio`, `llama.cpp`) to discover real weights resident on your machine (`qwen3`, `llama3`, `deepseek-r1`, etc.).
- **Live Model Pulling**: Pull new models directly into your local runtime through the unified pull bar (`POST /api/pull`) with streaming progress feedback.
- **Hardware Offload Tuning**: Modal slider controls for GPU layer offloading (`cuBLAS`/`Metal`), context window allocation ($n_{\text{ctx}}$), CPU compute threads, Flash Attention 2, and `mlock` RAM pinning.

### 2. 💬 Local Chat & Native Chain-of-Thought
- **True NDJSON Token Streaming**: Streams tokens character-by-character directly from local backend endpoints with zero latency proxying.
- **Reasoning (`<think>`) Folding**: Automatically parses native reasoning steps (Qwen 3, DeepSeek-R1) into collapsible glassmorphic drawers.
- **Real-Time Inference Telemetry**: Every assistant message logs exact Tokens/second (TPS), Time-to-First-Token (TTFT), total token count, and resident VRAM.

### 3. ⚔️ Multi-Model Synchronous Arena
- **Side-by-Side Split Viewports**: Synchronize prompts across **Dual (2x)**, **Triple (3x)**, or **Quad (4x)** viewports.
- **Parallel Inference**: Broadcasts a single prompt simultaneously across multiple local models to compare TPS throughput, latency, and reasoning depth.
- **Benchmark Export**: One-click export that generates a structured Markdown benchmark report comparing speed, TTFT, and parameter metrics.

### 4. 🗄️ Knowledge Base & Vector Vault (RAG)
- **1024-Dimensional Unit Vectors**: High-speed, unit-normalized semantic embedding engine where dot product equals exact cosine similarity.
- **Recursive Text Chunking**: Automatically processes sliding window token chunks with configurable overlap.
- **Real File Vault**: Drag-and-drop or upload real `.txt`, `.md`, `.json`, `.csv`, or `.pdf` files.
- **Live Cosine Match Tester**: Test queries in real-time to preview candidate chunks scored with exact percentage matches.
- **In-Chat RAG Context**: Toggle **RAG Context ON** in chat to automatically inject retrieved knowledge chunks with source citations into your prompt.

### 5. 🔍 Autonomous Deep Research Pipeline
- **Multi-Step Agent Loop**:
  1. *Deconstruct query into sub-hypotheses*
  2. *Query public encyclopedias via live Wikipedia APIs*
  3. *Extract and filter semantic text chunks*
  4. *Synthesize technical findings via your local LLM*
  5. *Verify citations against retrieved source references*
- **Artifact Export**: Real-time markdown generation with one-click **"Download .md"** export.

### 6. 🎙️ Voice Recognition & Multimodal Vision Studio
- **Native Audio Recognition**: Live voice transcription powered by the browser's native Web Speech API (`SpeechRecognition`).
- **Physical Audio Waveform**: Animated visualizer driven by the Web Audio API (`AudioContext` + `AnalyserNode`) connected directly to your microphone.
- **Vision Tensor Inspector**: Attach images via drag-and-drop or file picker; extracts spatial dimensions and prepares multimodal inputs for vision models (`LLaVA`, `Qwen-VL`).

---

## 🔒 Privacy & Security Invariants

Sanctum is architected with a strict zero-trust, privacy-first posture:

- **Zero Cloud Network Egress**: Prompts, documents, voice audio, and weights never traverse external third-party servers.
- **Local In-Memory Vector Storage**: Vector embeddings and semantic chunks reside in private process memory.
- **No Third-Party Analytics**: Sanctum does not bundle trackers, analytics, telemetry pings, or third-party cookies.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [Ollama](https://ollama.ai) (recommended) or any OpenAI-compatible server (LM Studio, llama.cpp, vLLM)

### 1. Clone & Install
```bash
git clone https://github.com/avirooppal/Sanctum.git
cd Sanctum
npm install
```

### 2. Launch Local AI Daemon
Ensure your local model runner is active. For Ollama:
```bash
ollama serve
```
*(Sanctum will automatically detect models already installed via `ollama list`)*

### 3. Start Sanctum
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router, Client Components) |
| **Language** | TypeScript (Strict mode enabled) |
| **Styling** | Tailwind CSS (Power-user obsidian palette, Glassmorphism) |
| **State Management** | Zustand (Modular client store with live telemetry) |
| **Icons** | Lucide React |
| **Audio Processing** | Web Audio API (`AudioContext`, `AnalyserNode`) |
| **Vector Engine** | Custom In-Memory Vector Store (1024d Cosine Similarity) |

---

## 📂 Project Structure

```
Sanctum/
├── src/
│   ├── app/
│   │   ├── globals.css                       # Power-user obsidian theme & glass tokens
│   │   ├── layout.tsx                        # Root layout metadata & dark mode wrapper
│   │   └── page.tsx                          # Application entry point
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx                  # Layout orchestrator & Ctrl+B shortcut
│   │   │   ├── LeftRail.tsx                  # Global module navigation rail
│   │   │   ├── ContextExplorer.tsx           # Dynamic context-aware sidebar router
│   │   │   ├── explorer/                     # Decomposed module explorers
│   │   │   │   ├── HubExplorer.tsx           # Category filters & VRAM gauge
│   │   │   │   ├── ChatExplorer.tsx          # Thread management & history
│   │   │   │   ├── ArenaExplorer.tsx         # Split layout & benchmark presets
│   │   │   │   ├── ResearchExplorer.tsx      # Deep inquiry launcher & archives
│   │   │   │   ├── RagExplorer.tsx           # Vector collections manager
│   │   │   │   └── SystemExplorer.tsx        # Compute topology & daemon health
│   │   │   └── TelemetryDock.tsx             # Persistent bottom hardware status bar
│   │   ├── hub/
│   │   │   ├── ModelHubView.tsx              # Live Ollama model catalog & pull bar
│   │   │   ├── ModelCard.tsx                 # Atomic model card with VRAM & layer indicators
│   │   │   └── HardwareConfigModal.tsx       # GPU offload & context window tuning
│   │   ├── chat/
│   │   │   ├── ChatCanvas.tsx                # Streaming chat orchestrator
│   │   │   ├── ChatHeader.tsx                # Session info, RAG toggle, tuning actions
│   │   │   ├── ChatEmptyState.tsx            # Initial inference ready suggestions
│   │   │   ├── ChatMessageItem.tsx           # Glassmorphic message bubble with <think> folding
│   │   │   ├── ChatInputBar.tsx              # Multimodal input dock, voice & image upload
│   │   │   ├── VoiceRecorder.tsx             # Live speech recognition & waveform canvas
│   │   │   └── VisionInspector.tsx           # Multimodal image attachment inspector
│   │   ├── arena/
│   │   │   ├── ArenaCanvas.tsx               # Synchronized multi-model arena
│   │   │   └── ArenaPane.tsx                 # Atomic arena viewport with TPS/latency benchmarks
│   │   ├── research/
│   │   │   ├── DeepResearchWorkspace.tsx     # Autonomous agent multi-step research pipeline
│   │   │   ├── ResearchStepCard.tsx          # Step progress card with expandable logs
│   │   │   ├── ResearchCitationCard.tsx      # Verified source citation with relevance score
│   │   │   └── ResearchDocumentViewer.tsx    # Dossier markdown reader with export
│   │   ├── rag/
│   │   │   ├── KnowledgeBaseWorkspace.tsx    # Vector vault workspace orchestrator
│   │   │   ├── VaultDropZone.tsx             # Real-time drag-and-drop file ingestion zone
│   │   │   ├── DocumentListItem.tsx          # Document item with status & chunk metrics
│   │   │   └── VectorChunkCard.tsx           # 1024d chunk card with cosine match scoring
│   │   ├── settings/
│   │   │   └── SettingsView.tsx              # Daemon health check & storage path config
│   │   └── telemetry/
│   │       └── HardwareDetailsModal.tsx      # System accelerator & compute diagnostics
│   ├── lib/
│   │   ├── constants.ts                      # Global endpoints, options & presets
│   │   ├── engine.ts                         # Real Ollama & Wikipedia API client
│   │   ├── vectorStore.ts                    # In-memory 1024d vector similarity engine
│   │   └── utils.ts                          # Class merge & format utilities
│   ├── store/
│   │   ├── useAppStore.ts                    # Combined reactive store
│   │   └── slices/                           # Modular domain state slices
│   │       ├── navigationSlice.ts            # Layout & collapse state
│   │       ├── modelsSlice.ts                # Model catalog & Ollama pull state
│   │       ├── chatSlice.ts                  # Inference threads & streaming
│   │       ├── arenaSlice.ts                 # Parallel multi-model arena
│   │       ├── researchSlice.ts              # Wikipedia search & agent pipeline
│   │       ├── ragSlice.ts                   # Ingested vaults & vector search
│   │       └── telemetrySlice.ts             # Host cores & VRAM telemetry
│   └── types/
│       └── index.ts                          # Strict TypeScript domain interfaces
├── tailwind.config.ts                        # Spacing tokens, colors, glassmorphism
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
