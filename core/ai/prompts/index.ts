/**
 * Centralized Prompt Registry & Templates (Core AI Layer)
 * Zero hardcoded prompt strings in UI components.
 */

export const PromptTemplates = {
  SYSTEM_OFFLINE_ASSISTANT: "You are a private local assistant running entirely on-device.",
  SYSTEM_RAG_ASSISTANT: (context: string) =>
    `You are an offline private AI assistant. Use the following retrieved document context from the local vault to inform your response:\n\n${context}`,
  ANALYZE_IMAGE: "Please analyze this image.",
  ANALYZE_DOCUMENT: "Please analyze the attached document.",
  BENCHMARK_SIMD: "Write a high-performance string search in C++ and explain its cache behavior.",
  BENCHMARK_LOGIC: "Analyze the halting problem reduction for bounded linear automata with formal proofs.",
  BENCHMARK_ASYNC: "Implement a backpressure-aware event streaming queue in Python using asyncio and uvloop.",
} as const;
