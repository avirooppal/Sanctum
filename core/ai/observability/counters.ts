/**
 * Per-role model invocation counters (ADR 0105 §4). Incremented only at the
 * real engine/provider call site so "was the model called" is answerable from data.
 */

export type ModelRole = "chat" | "embedding" | "reranker" | "asr" | "tts" | "vision" | "cloud";

export const MODEL_ROLES: readonly ModelRole[] = ["chat", "embedding", "reranker", "asr", "tts", "vision", "cloud"];

export class CallCounters {
  private counts: Record<ModelRole, number> = { chat: 0, embedding: 0, reranker: 0, asr: 0, tts: 0, vision: 0, cloud: 0 };

  increment(role: ModelRole): void {
    this.counts[role] += 1;
  }

  snapshot(): Record<ModelRole, number> {
    return { ...this.counts };
  }

  reset(): void {
    for (const r of MODEL_ROLES) this.counts[r] = 0;
  }
}

export const globalCounters = new CallCounters();
