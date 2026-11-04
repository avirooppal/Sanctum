/**
 * Two-Tier Open-Source Local Memory Engine (Core Facts + Episodic Cross-Chat Memory)
 * Combines HybridRetriever (Dense + BM25 + RRF) with secrets redaction and persistent storage.
 */

import { HybridRetriever } from "../rag/retrieval.ts";
import { globalVectorStore } from "../rag/vectorStore.ts";
import type { RagChunk } from "../rag/ingest.ts";

export type MemoryCategory = "user" | "preference" | "project" | "fact";

export interface MemoryFact {
  id: string;
  content: string;
  category: MemoryCategory;
  workspaceId: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodicMemory {
  id: string;
  sessionId: string;
  sessionTitle: string;
  role: "user" | "assistant" | "summary";
  content: string;
  workspaceId: string;
  timestamp: string;
}

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi,
];

/**
 * Redacts API keys, tokens, and credentials before saving to memory or logs.
 */
export function redactSecrets(input: string): string {
  if (!input) return "";
  let sanitized = input;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (_match, prefix) =>
      prefix ? `${prefix}[REDACTED_SECRET]` : "[REDACTED_SECRET]"
    );
  }
  return sanitized;
}

export class LocalMemoryStore {
  private facts: Map<string, MemoryFact> = new Map();
  private episodes: Map<string, EpisodicMemory> = new Map();
  private storageKey = "sanctum-memory-store-v1";
  private enabled = true;

  constructor() {
    this.loadFromLocalStorage();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.persist();
  }

  public saveFact(input: {
    content: string;
    category?: MemoryCategory;
    workspaceId?: string;
    pinned?: boolean;
  }): MemoryFact {
    const clean = redactSecrets(input.content.trim());
    if (!clean) {
      throw new Error("Memory content cannot be empty");
    }
    const workspaceId = input.workspaceId || "default";
    const category = input.category || "fact";

    // Deduplicate identical fact in same workspace
    for (const existing of this.facts.values()) {
      if (
        existing.workspaceId === workspaceId &&
        existing.content.toLowerCase() === clean.toLowerCase()
      ) {
        existing.updatedAt = new Date().toISOString();
        if (input.pinned !== undefined) existing.pinned = input.pinned;
        if (input.category) existing.category = input.category;
        this.persist();
        return existing;
      }
    }

    const now = new Date().toISOString();
    const fact: MemoryFact = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      content: clean,
      category,
      workspaceId,
      pinned: input.pinned ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.facts.set(fact.id, fact);
    this.persist();
    return fact;
  }

  public updateFact(
    id: string,
    patch: Partial<Pick<MemoryFact, "content" | "category" | "pinned">>
  ): MemoryFact | null {
    const existing = this.facts.get(id);
    if (!existing) return null;
    if (patch.content !== undefined) {
      existing.content = redactSecrets(patch.content.trim());
    }
    if (patch.category !== undefined) existing.category = patch.category;
    if (patch.pinned !== undefined) existing.pinned = patch.pinned;
    existing.updatedAt = new Date().toISOString();
    this.persist();
    return existing;
  }

  public deleteFact(id: string): boolean {
    const deleted = this.facts.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  public listFacts(workspaceId?: string): MemoryFact[] {
    const all = Array.from(this.facts.values());
    if (!workspaceId) return all;
    return all.filter((f) => f.workspaceId === workspaceId || f.workspaceId === "default");
  }

  public addEpisode(input: {
    sessionId: string;
    sessionTitle: string;
    role: "user" | "assistant" | "summary";
    content: string;
    workspaceId?: string;
  }): EpisodicMemory | null {
    if (!this.enabled) return null;
    const clean = redactSecrets(input.content.trim());
    if (clean.length < 10) return null;

    const id = `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ep: EpisodicMemory = {
      id,
      sessionId: input.sessionId,
      sessionTitle: input.sessionTitle || "Chat",
      role: input.role,
      content: clean.slice(0, 2000),
      workspaceId: input.workspaceId || "default",
      timestamp: new Date().toISOString(),
    };

    this.episodes.set(id, ep);
    // Cap episodic store at 500 entries to stay lightweight
    if (this.episodes.size > 500) {
      const oldestKey = this.episodes.keys().next().value;
      if (oldestKey) this.episodes.delete(oldestKey);
    }
    this.persist();
    return ep;
  }

  /**
   * Hybrid Dense + BM25 RRF search across both Core Facts and Episodic Memories.
   */
  public recall(
    query: string,
    options?: { workspaceId?: string; topK?: number }
  ): {
    facts: MemoryFact[];
    episodes: { id: string; sessionTitle: string; content: string; score: number }[];
  } {
    const ws = options?.workspaceId || "default";
    const topK = options?.topK ?? 5;
    const allFacts = this.listFacts(ws);

    if (!query.trim()) {
      return {
        facts: allFacts.slice(0, topK),
        episodes: [],
      };
    }

    const qVec = globalVectorStore.generateEmbedding(query);

    // 1. Score facts via HybridRetriever
    const factChunks: RagChunk[] = allFacts.map((f, idx) => ({
      id: f.id,
      docId: f.id,
      workspaceId: ws,
      docName: `fact:${f.category}`,
      chunkIndex: idx,
      content: f.content,
      tokenCount: Math.ceil(f.content.split(/\s+/).length * 1.3),
      charStart: 0,
      charEnd: f.content.length,
      vector: globalVectorStore.generateEmbedding(f.content),
    }));

    const scoredFactPassages = HybridRetriever.retrieve(
      { query, workspaceId: ws, topK, mode: "hybrid" },
      factChunks,
      qVec
    );

    const matchedFacts = scoredFactPassages
      .filter((p) => p.denseScore > 0.1 || p.lexicalScore > 0)
      .map((p) => this.facts.get(p.id)!)
      .filter(Boolean);

    // 2. Score episodic memories via HybridRetriever
    const epList = Array.from(this.episodes.values()).filter(
      (e) => e.workspaceId === ws || e.workspaceId === "default"
    );
    const epChunks: RagChunk[] = epList.map((e, idx) => ({
      id: e.id,
      docId: e.sessionId,
      workspaceId: ws,
      docName: e.sessionTitle,
      chunkIndex: idx,
      content: e.content,
      tokenCount: Math.ceil(e.content.split(/\s+/).length * 1.3),
      charStart: 0,
      charEnd: e.content.length,
      vector: globalVectorStore.generateEmbedding(e.content),
    }));

    const scoredEpPassages = HybridRetriever.retrieve(
      { query, workspaceId: ws, topK, mode: "hybrid" },
      epChunks,
      qVec
    );

    const matchedEpisodes = scoredEpPassages
      .filter((p) => p.denseScore > 0.15 || p.lexicalScore > 0)
      .map((p) => ({
        id: p.id,
        sessionTitle: p.docName,
        content: p.content,
        score: p.score,
      }));

    return {
      facts: matchedFacts,
      episodes: matchedEpisodes,
    };
  }

  /**
   * Formats pinned core memories for injection into the system prompt.
   */
  public formatCoreMemoriesForPrompt(workspaceId?: string): string {
    if (!this.enabled) return "";
    const pinned = this.listFacts(workspaceId).filter((f) => f.pinned);
    if (pinned.length === 0) return "";
    const lines = pinned.map((f) => `- [${f.category}] ${f.content}`);
    return `Persistent Local Memory (User & Workspace Facts):\n${lines.join("\n")}`;
  }

  /**
   * Heuristic candidate fact detector from user messages (e.g. "Remember that...", "My name is...", "Always use...").
   */
  public static extractCandidateFact(
    userMessage: string
  ): { content: string; category: MemoryCategory } | null {
    const trimmed = userMessage.trim();
    if (trimmed.length < 8 || trimmed.length > 400) return null;

    const rememberMatch = trimmed.match(
      /^(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i
    );
    if (rememberMatch) {
      return { content: redactSecrets(rememberMatch[1].trim()), category: "fact" };
    }

    const prefMatch = trimmed.match(
      /^(?:i\s+prefer|always\s+use|never\s+use)\s+(.+)$/i
    );
    if (prefMatch) {
      return { content: redactSecrets(trimmed), category: "preference" };
    }

    return null;
  }

  public exportData(): {
    enabled: boolean;
    facts: MemoryFact[];
    episodes: EpisodicMemory[];
  } {
    return {
      enabled: this.enabled,
      facts: Array.from(this.facts.values()),
      episodes: Array.from(this.episodes.values()),
    };
  }

  public importData(data: {
    enabled?: boolean;
    facts?: MemoryFact[];
    episodes?: EpisodicMemory[];
  }): void {
    if (typeof data.enabled === "boolean") this.enabled = data.enabled;
    if (Array.isArray(data.facts)) {
      this.facts.clear();
      for (const f of data.facts) {
        if (f && f.id && f.content) this.facts.set(f.id, f);
      }
    }
    if (Array.isArray(data.episodes)) {
      this.episodes.clear();
      for (const e of data.episodes) {
        if (e && e.id && e.content) this.episodes.set(e.id, e);
      }
    }
    this.persist();
  }

  public clear(): void {
    this.facts.clear();
    this.episodes.clear();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(this.storageKey);
      } catch {}
    }
    this.syncToBackend();
  }

  private loadFromLocalStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.enabled === "boolean") this.enabled = parsed.enabled;
      if (Array.isArray(parsed.facts)) {
        for (const f of parsed.facts) {
          if (f && f.id && f.content) this.facts.set(f.id, f);
        }
      }
      if (Array.isArray(parsed.episodes)) {
        for (const e of parsed.episodes) {
          if (e && e.id && e.content) this.episodes.set(e.id, e);
        }
      }
    } catch {}
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(this.exportData());
      localStorage.setItem(this.storageKey, payload);
    } catch {}
    this.syncToBackend();
  }

  private syncToBackend(): void {
    if (typeof window === "undefined") return;
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.exportData()),
    }).catch(() => {});
  }
}

export const globalMemoryStore = new LocalMemoryStore();
