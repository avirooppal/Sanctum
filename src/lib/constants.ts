/**
 * Application Constants & Configuration Defaults
 */

export const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
export const DEFAULT_LM_STUDIO_ENDPOINT = "http://127.0.0.1:1234/v1";
export const DEFAULT_WHISPERX_ENDPOINT = "http://127.0.0.1:8000";

export interface CuratedModel {
  id: string;
  name: string;
  type: "chat" | "reasoning" | "embedding" | "audio";
  description: string;
  sizeGB: number;
  parameters: string;
  recommended?: boolean;
}

export const JAN_STYLE_DOWNLOAD_CATALOG: CuratedModel[] = [
  // Chat & Reasoning
  {
    id: "llama3.2",
    name: "Llama 3.2 3B",
    type: "chat",
    description: "Meta's state-of-the-art lightweight instruction model. Excellent speed & low RAM.",
    sizeGB: 2.0,
    parameters: "3.2B",
    recommended: true,
  },
  {
    id: "deepseek-r1:8b",
    name: "DeepSeek R1 8B",
    type: "reasoning",
    description: "Flagship open reasoning model with transparent chain-of-thought logic steps.",
    sizeGB: 4.9,
    parameters: "8B",
    recommended: true,
  },
  {
    id: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    type: "chat",
    description: "Top-tier general intelligence, multilingual capabilities, and coding prowess.",
    sizeGB: 4.7,
    parameters: "7B",
  },
  {
    id: "mistral",
    name: "Mistral 7B Instruct",
    type: "chat",
    description: "High-speed balanced model for writing, analysis, and general tasks.",
    sizeGB: 4.1,
    parameters: "7B",
  },

  // Embedding Models (RAG Vector Store)
  {
    id: "nomic-embed-text",
    name: "Nomic Embed Text",
    type: "embedding",
    description: "Essential for Document Vault RAG. High-performance 8192-token context vector embeddings.",
    sizeGB: 0.27,
    parameters: "137M",
    recommended: true,
  },
  {
    id: "bge-m3",
    name: "BGE-M3 Multilingual Embed",
    type: "embedding",
    description: "Multi-granularity embedding model supporting 100+ languages and long contexts.",
    sizeGB: 0.56,
    parameters: "567M",
  },
  {
    id: "all-minilm",
    name: "All-MiniLM-L6-v2",
    type: "embedding",
    description: "Ultra-compact semantic embedding model for instant local semantic search.",
    sizeGB: 0.12,
    parameters: "22M",
  },

  // Speech-to-Text / WhisperX
  {
    id: "whisper-base",
    name: "WhisperX Base",
    type: "audio",
    description: "Fast speech recognition with phoneme alignment via WhisperX / faster-whisper.",
    sizeGB: 0.14,
    parameters: "74M",
    recommended: true,
  },
  {
    id: "whisper-small",
    name: "WhisperX Small",
    type: "audio",
    description: "Balanced multilingual transcription with high accuracy for voice notes.",
    sizeGB: 0.46,
    parameters: "244M",
  },
];

export const BENCHMARK_PRESETS = [
  {
    title: "SIMD Cache Locality",
    prompt: "Write a high-performance string search in C++ and explain its cache behavior.",
  },
  {
    title: "Formal Logic & CoT",
    prompt: "Analyze the halting problem reduction for bounded linear automata with formal proofs.",
  },
  {
    title: "Python Async Architecture",
    prompt: "Implement a backpressure-aware event streaming queue in Python using asyncio and uvloop.",
  },
] as const;

export const PROMPT_SUGGESTIONS = [
  "Write an AVX-512 vector kernel in Rust",
  "Explain quantum error correction surface codes",
  "Optimize memory layout for zero-copy IPC",
  "Benchmark GGUF Q4_K_M vs Q8_0 throughput",
] as const;

export const HARDWARE_THREAD_OPTIONS = [4, 6, 8, 12, 16, 24, 32] as const;

export const ARENA_SPLIT_OPTIONS = [
  ["dual", "Dual (2x)"],
  ["triple", "Triple (3x)"],
  ["quad", "Quad (4x)"],
] as const;

