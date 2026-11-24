/**
 * Client-Side In-Memory Vector Store & Semantic Chunking Engine (Core AI Layer)
 * Provides unit-normalized cosine similarity, Ollama /api/embed integration,
 * Hybrid Dense + BM25 RRF retrieval, recursive text chunking, and top-k retrieval.
 */

import { HybridRetriever, type ScoredPassage } from "./retrieval.ts";
import type { RagChunk } from "./ingest.ts";

export interface CollectionIndexSettings {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface VectorChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  vector: Float32Array;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  contentHash?: string;
  location?: string;
  similarity?: number;
  score?: number;
}

export interface RagCitation {
  docId: string;
  docName: string;
  location: string;
  score: number;
}

export function hashRagContent(text: string): string {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}

export function formatUntrustedRagContext(passages: Array<{ docId: string; docName: string; content: string; score?: number; id?: string }>): {
  contextText: string;
  citations: RagCitation[];
} {
  const citations: RagCitation[] = [];
  const blocks: string[] = [];
  for (let i = 0; i < passages.length; i++) {
    const p = passages[i];
    const loc = p.id || `chunk:${i}`;
    const safeDoc = String(p.docName || p.docId).replace(/"/g, "'");
    const safeContent = String(p.content || "").replace(/<\/untrusted_rag_source\s*>/gi, "[/untrusted_rag_source]");
    citations.push({
      docId: p.docId,
      docName: p.docName,
      location: loc,
      score: Number((p.score || 0).toFixed(4)),
    });
    blocks.push(`<untrusted_rag_source doc="${safeDoc}" location="${loc}">\n${safeContent}\n</untrusted_rag_source>`);
  }
  return { contextText: blocks.join("\n\n"), citations };
}

export class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private docMeta: Map<string, { contentHash: string; settings: CollectionIndexSettings }> = new Map();
  private readonly dimensions = 1024;
  private embeddingModel: string = "nomic-embed-text";
  private chunkSize: number = 512;
  private chunkOverlap: number = 64;

  public getCollectionSettings(): CollectionIndexSettings {
    return {
      embeddingModel: this.embeddingModel,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    };
  }

  public setCollectionSettings(next: Partial<CollectionIndexSettings>): void {
    if (next.embeddingModel && next.embeddingModel.trim()) this.embeddingModel = next.embeddingModel.trim();
    if (typeof next.chunkSize === "number" && next.chunkSize >= 64) this.chunkSize = next.chunkSize;
    if (typeof next.chunkOverlap === "number" && next.chunkOverlap >= 0) this.chunkOverlap = next.chunkOverlap;
  }

  public setEmbeddingModel(model: string): void {
    if (model.trim()) this.embeddingModel = model.trim();
  }

  public getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Deterministic semantic hash embedding generator (1024 dimensions)
   * Produces a unit-normalized Float32Array vector where similar words and n-grams
   * cluster with higher dot-product similarity.
   */
  public generateEmbedding(text: string): Float32Array {
    const vector = new Float32Array(this.dimensions);
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const words = cleanText.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return vector;
    }

    // Hash word unigrams and bigrams into 1024-dimensional space
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 5381;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) + hash + word.charCodeAt(j)) & 0x7fffffff;
      }
      const idx = hash % this.dimensions;
      vector[idx] += 1.0;

      // Bigram
      if (i + 1 < words.length) {
        const bigram = `${word}_${words[i + 1]}`;
        let biHash = 5381;
        for (let j = 0; j < bigram.length; j++) {
          biHash = ((biHash << 5) + biHash + bigram.charCodeAt(j)) & 0x7fffffff;
        }
        const biIdx = biHash % this.dimensions;
        vector[biIdx] += 1.5;
      }
    }

    // L2 Normalize the vector so dot-product equals cosine similarity
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSq);

    if (magnitude > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Real local open-source embedding via Ollama /api/embed (e.g. nomic-embed-text, bge-m3).
   * Projects/pads to 1024 L2-normalized Float32Array and falls back seamlessly to generateEmbedding.
   */
  public async generateOllamaEmbedding(
    text: string,
    options?: { endpoint?: string; model?: string; signal?: AbortSignal }
  ): Promise<Float32Array> {
    if (!text.trim()) return new Float32Array(this.dimensions);
    const endpoint = options?.endpoint || "http://127.0.0.1:11434";
    const model = options?.model || this.embeddingModel;

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: options?.signal,
        body: JSON.stringify({ model, input: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw: number[] | undefined =
          Array.isArray(data?.embeddings?.[0])
            ? data.embeddings[0]
            : Array.isArray(data?.embedding)
            ? data.embedding
            : undefined;

        if (raw && raw.length > 0) {
          const vec = new Float32Array(this.dimensions);
          for (let i = 0; i < raw.length; i++) {
            vec[i % this.dimensions] += Number(raw[i]) || 0;
          }
          let sumSq = 0;
          for (let i = 0; i < this.dimensions; i++) sumSq += vec[i] * vec[i];
          const mag = Math.sqrt(sumSq);
          if (mag > 0) {
            for (let i = 0; i < this.dimensions; i++) vec[i] /= mag;
          }
          return vec;
        }
      }
    } catch {
      // Fallback to local deterministic hash embedding when Ollama or embedding model is offline
    }
    return this.generateEmbedding(text);
  }

  /**
   * Fast Dot Product on unit-normalized vectors = Cosine Similarity (-1.0 to 1.0)
   */
  public static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const len = a.length;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  /**
   * Recursive character & sentence text splitter
   */
  public chunkText(
    text: string,
    chunkSizeTokens: number = 80,
    chunkOverlapTokens: number = 15
  ): { content: string; tokenCount: number }[] {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const results: { content: string; tokenCount: number }[] = [];

    let currentChunk: string[] = [];
    let currentCount = 0;

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      const estTokens = Math.ceil(words.length * 1.3);

      if (currentCount + estTokens <= chunkSizeTokens) {
        currentChunk.push(paragraph);
        currentCount += estTokens;
      } else {
        if (currentChunk.length > 0) {
          const content = currentChunk.join("\n\n");
          results.push({ content, tokenCount: currentCount });
          // Preserve overlap
          const overlapCount = Math.floor(chunkOverlapTokens / 1.3);
          const lastWords = content.split(/\s+/).slice(-overlapCount);
          currentChunk = [lastWords.join(" "), paragraph];
          currentCount = Math.ceil(lastWords.length * 1.3) + estTokens;
        } else {
          // Paragraph itself is larger than chunk size; split into word slices
          for (let i = 0; i < words.length; i += chunkSizeTokens) {
            const slice = words.slice(i, i + chunkSizeTokens).join(" ");
            results.push({ content: slice, tokenCount: Math.ceil(slice.split(/\s+/).length * 1.3) });
          }
          currentChunk = [];
          currentCount = 0;
        }
      }
    }

    if (currentChunk.length > 0) {
      const content = currentChunk.join("\n\n");
      results.push({ content, tokenCount: currentCount });
    }

    return results.length > 0 ? results : [{ content: text, tokenCount: Math.ceil(text.split(/\s+/).length * 1.3) }];
  }

  /**
   * Add a document with automated chunking and vector indexing
   */
  public addDocument(
    docId: string,
    docName: string,
    rawText: string,
    chunkSizeTokens: number = 80,
    overlapTokens: number = 15
  ): VectorChunk[] {
    const textChunks = this.chunkText(rawText, chunkSizeTokens, overlapTokens);
    const addedChunks: VectorChunk[] = [];

    textChunks.forEach((tc, idx) => {
      const chunkId = `${docId}-chunk-${idx}`;
      const vector = this.generateEmbedding(tc.content);

      const chunk: VectorChunk = {
        id: chunkId,
        docId,
        docName,
        chunkIndex: idx,
        content: tc.content,
        tokenCount: tc.tokenCount,
        vector,
      };

      this.chunks.set(chunkId, chunk);
      addedChunks.push(chunk);
    });

    return addedChunks;
  }

  /**
   * Add raw chunk directly (e.g. rehydrating from persistent storage)
   */
  public addRawChunk(chunk: VectorChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  /**
   * Cosine-similarity top-k semantic search
   */
  public search(query: string, topK: number = 4, minSimilarity: number = 0.2, documentIds?: ReadonlySet<string>): VectorChunk[] {
    if (this.chunks.size === 0 || !query.trim()) {
      return [];
    }

    const queryVector = this.generateEmbedding(query);
    const scoredChunks: VectorChunk[] = [];

    for (const chunk of this.chunks.values()) {
      if (documentIds && !documentIds.has(chunk.docId)) continue;
      const similarity = InMemoryVectorStore.cosineSimilarity(queryVector, chunk.vector);
      if (similarity >= minSimilarity) {
        scoredChunks.push({
          ...chunk,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }

    // Sort descending by similarity score
    scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return scoredChunks.slice(0, topK);
  }

  /**
   * Hybrid Dense + BM25 Lexical + Reciprocal Rank Fusion (RRF) search via HybridRetriever.
   */
  public hybridSearch(
    query: string,
    topK: number = 4,
    documentIds?: ReadonlySet<string>,
    workspaceId: string = "default"
  ): ScoredPassage[] {
    if (this.chunks.size === 0 || !query.trim()) return [];
    const queryVector = this.generateEmbedding(query);
    const candidates: RagChunk[] = [];

    for (const ch of this.chunks.values()) {
      if (documentIds && documentIds.size > 0 && !documentIds.has(ch.docId)) continue;
      candidates.push({
        id: ch.id,
        docId: ch.docId,
        workspaceId,
        docName: ch.docName,
        chunkIndex: ch.chunkIndex,
        content: ch.content,
        tokenCount: ch.tokenCount,
        charStart: 0,
        charEnd: ch.content.length,
        vector: ch.vector,
      });
    }

    return HybridRetriever.retrieve(
      { query, workspaceId, topK, mode: "hybrid" },
      candidates,
      queryVector
    ).filter((p) => p.denseScore >= 0.1 || p.lexicalScore > 0);
  }

  /**
   * Hash-based incremental upsert: skips unchanged files when content hash and
   * collection embedding/chunking settings match; automatically re-indexes otherwise.
   */
  public upsertDocumentIncremental(
    docId: string,
    docName: string,
    content: string,
    settingsOverride?: Partial<CollectionIndexSettings>
  ): { reindexed: boolean; chunkCount: number; reason: string } {
    const settings: CollectionIndexSettings = {
      embeddingModel: settingsOverride?.embeddingModel || this.embeddingModel,
      chunkSize: settingsOverride?.chunkSize || this.chunkSize,
      chunkOverlap: settingsOverride?.chunkOverlap ?? this.chunkOverlap,
    };
    const contentHash = hashRagContent(content || "");
    const prev = this.docMeta.get(docId);
    if (
      prev &&
      prev.contentHash === contentHash &&
      prev.settings.embeddingModel === settings.embeddingModel &&
      prev.settings.chunkSize === settings.chunkSize &&
      prev.settings.chunkOverlap === settings.chunkOverlap
    ) {
      let existingCount = 0;
      for (const c of this.chunks.values()) if (c.docId === docId) existingCount++;
      return { reindexed: false, chunkCount: existingCount, reason: "unchanged" };
    }

    const reason = !prev
      ? "new_document"
      : prev.contentHash !== contentHash
      ? "content_changed"
      : "settings_changed";

    this.removeDocument(docId);
    const step = Math.max(1, settings.chunkSize - settings.chunkOverlap);
    const text = content || "";
    let idx = 0;
    for (let pos = 0; pos < text.length; pos += step) {
      const slice = text.slice(pos, pos + settings.chunkSize).trim();
      if (!slice) break;
      const chunkId = `${docId}_c${idx}`;
      this.chunks.set(chunkId, {
        id: chunkId,
        docId,
        docName,
        chunkIndex: idx,
        content: slice,
        tokenCount: Math.ceil(slice.length / 4),
        vector: this.generateEmbedding(slice),
        embeddingModel: settings.embeddingModel,
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
        contentHash,
        location: `chars:${pos}-${pos + slice.length}`,
      });
      idx++;
      if (pos + settings.chunkSize >= text.length) break;
    }
    this.docMeta.set(docId, { contentHash, settings });
    return { reindexed: true, chunkCount: idx, reason };
  }

  public syncCollectionFiles(
    files: Array<{ docId: string; docName: string; content: string }>,
    onProgress?: (done: number, total: number, docId: string) => void
  ): { reindexed: number; skipped: number; deleted: number } {
    const activeIds = new Set(files.map((f) => f.docId));
    let deleted = 0;
    for (const existingId of Array.from(this.docMeta.keys())) {
      if (!activeIds.has(existingId)) {
        this.removeDocument(existingId);
        this.docMeta.delete(existingId);
        deleted++;
      }
    }
    let reindexed = 0;
    let skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const r = this.upsertDocumentIncremental(f.docId, f.docName, f.content);
      if (r.reindexed) reindexed++;
      else skipped++;
      onProgress?.(i + 1, files.length, f.docId);
    }
    return { reindexed, skipped, deleted };
  }

  public getChunkMetadata(docId: string): VectorChunk[] {
    const out: VectorChunk[] = [];
    for (const c of this.chunks.values()) {
      if (c.docId === docId) out.push(c);
    }
    return out;
  }

  /**
   * Remove chunks for a specific document
   */
  public removeDocument(docId: string): void {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.docId === docId) {
        this.chunks.delete(id);
      }
    }
    this.docMeta.delete(docId);
  }

  /**
   * Clear all indexed chunks
   */
  public clear(): void {
    this.chunks.clear();
    this.docMeta.clear();
  }

  /**
   * Count total chunks indexed
   */
  public size(): number {
    return this.chunks.size;
  }
}

// Global in-memory singleton
export const globalVectorStore = new InMemoryVectorStore();
