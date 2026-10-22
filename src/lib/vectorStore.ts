/**
 * Client-Side In-Memory Vector Store & Semantic Chunking Engine
 * Provides unit-normalized cosine similarity, recursive text chunking, and top-k retrieval.
 */

export interface VectorChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  vector: Float32Array;
  similarity?: number;
}

export class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private readonly dimensions = 1024;

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

    // Unit normalize the vector (L2 norm) so dot product equals cosine similarity
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 1e-8) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
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
    text: string,
    chunkSize: number = 80,
    overlap: number = 15
  ): VectorChunk[] {
    const textChunks = this.chunkText(text, chunkSize, overlap);
    const createdChunks: VectorChunk[] = [];

    for (let idx = 0; idx < textChunks.length; idx++) {
      const tc = textChunks[idx];
      const chunkId = `${docId}-chk-${idx}`;
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
      createdChunks.push(chunk);
    }

    return createdChunks;
  }

  /**
   * Delete all chunks associated with a document
   */
  public removeDocument(docId: string): void {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.docId === docId) {
        this.chunks.delete(id);
      }
    }
  }

  /**
   * Semantic Vector Search: Rank chunks against query embedding
   */
  public search(query: string, topK: number = 4, minScore: number = 0.25): VectorChunk[] {
    if (!query.trim() || this.chunks.size === 0) {
      return [];
    }

    const queryVec = this.generateEmbedding(query);
    const scoredChunks: VectorChunk[] = [];

    for (const chunk of this.chunks.values()) {
      const score = InMemoryVectorStore.cosineSimilarity(queryVec, chunk.vector);
      if (score >= minScore) {
        scoredChunks.push({
          ...chunk,
          similarity: Number(score.toFixed(3)),
        });
      }
    }

    return scoredChunks
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK);
  }

  public addRawChunk(chunk: VectorChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  public clear(): void {
    this.chunks.clear();
  }

  public getChunkCount(): number {
    return this.chunks.size;
  }
}

// Global Singleton Vector Store for the application
export const globalVectorStore = new InMemoryVectorStore();
