/**
 * Application Constants & Configuration Defaults
 */

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
export const DEFAULT_LM_STUDIO_ENDPOINT = "http://localhost:1234/v1";

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

