/**
 * Pure Domain Entities & Logic: Models & Quantization (Core Domain)
 */

import type { LocalModel } from "../../contracts/types/index.ts";

export function categorizeModel(name: string): LocalModel["category"] {
  const lower = name.toLowerCase();
  if (lower.includes("coder") || lower.includes("code")) return "coding";
  if (lower.includes("r1") || lower.includes("reason")) return "reasoning";
  if (lower.includes("vl") || lower.includes("vision") || lower.includes("llava")) return "vision";
  if (lower.includes("embed") || lower.includes("bge")) return "embedding";
  return "general";
}

export function determineArchitecture(family: string = ""): LocalModel["architecture"] {
  const lower = family.toLowerCase();
  if (lower.includes("qwen")) return "qwen";
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("mistral")) return "mistral";
  return "llama";
}
