/**
 * Hybrid Dense + Lexical Retrieval Engine with Workspace Scoping & RRF Fusion (ADR 0105 / Pipeline P6).
 * Combines cosine semantic vector similarity with token-frequency BM25-style keyword matching,
 * applying Reciprocal Rank Fusion (RRF) and strict workspace boundaries.
 */
import type { RagChunk } from "./ingest.ts";
import type { CallCounters } from "../observability/counters.ts";

export interface RetrievalQuery {
  query: string;
  workspaceId: string;
  topK?: number;
  minScore?: number;
  mode?: "dense" | "keyword" | "hybrid";
}

export interface ScoredPassage {
  id: string;
  docId: string;
  workspaceId: string;
  docName: string;
  content: string;
  score: number;
  denseScore: number;
  lexicalScore: number;
  rank: number;
}

export class HybridRetriever {
  public static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const len = a.length;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  public static lexicalScore(query: string, content: string): number {
    const qTokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    if (qTokens.length === 0) return 0;

    const cTokens = content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    if (cTokens.length === 0) return 0;

    let matchCount = 0;
    const contentSet = new Map<string, number>();
    for (const t of cTokens) {
      contentSet.set(t, (contentSet.get(t) || 0) + 1);
    }

    for (const qt of qTokens) {
      if (contentSet.has(qt)) {
        matchCount += 1 + Math.log(contentSet.get(qt)!);
      }
    }

    return matchCount / Math.sqrt(cTokens.length + 1);
  }

  /**
   * Execute retrieval across chunks.
   * Strictly filters candidates by workspaceId.
   */
  public static retrieve(
    queryInput: RetrievalQuery,
    candidates: RagChunk[],
    queryVector: Float32Array,
    options?: { counters?: CallCounters }
  ): ScoredPassage[] {
    const topK = queryInput.topK ?? 4;
    const minScore = queryInput.minScore ?? 0.0;
    const mode = queryInput.mode ?? "hybrid";

    if (options?.counters) {
      options.counters.increment("embedding");
    }

    // 1. Strict workspace isolation: candidate MUST belong to query workspace
    const scopedChunks = candidates.filter((c) => c.workspaceId === queryInput.workspaceId);
    if (scopedChunks.length === 0) return [];

    // 2. Score Dense
    const denseScores: { chunk: RagChunk; score: number }[] = [];
    for (const ch of scopedChunks) {
      const sim = this.cosineSimilarity(queryVector, ch.vector);
      denseScores.push({ chunk: ch, score: sim });
    }
    denseScores.sort((a, b) => b.score - a.score);

    // 3. Score Lexical
    const lexicalScores: { chunk: RagChunk; score: number }[] = [];
    for (const ch of scopedChunks) {
      const lex = this.lexicalScore(queryInput.query, ch.content);
      lexicalScores.push({ chunk: ch, score: lex });
    }
    lexicalScores.sort((a, b) => b.score - a.score);

    // Map ranks (1-based)
    const denseRankMap = new Map<string, number>();
    denseScores.forEach((item, idx) => denseRankMap.set(item.chunk.id, idx + 1));

    const lexicalRankMap = new Map<string, number>();
    lexicalScores.forEach((item, idx) => lexicalRankMap.set(item.chunk.id, idx + 1));

    const denseScoreMap = new Map<string, number>();
    denseScores.forEach((item) => denseScoreMap.set(item.chunk.id, item.score));

    const lexicalScoreMap = new Map<string, number>();
    lexicalScores.forEach((item) => lexicalScoreMap.set(item.chunk.id, item.score));

    // 4. Combine based on retrieval mode
    const RRF_K = 60;
    const scoredPassages: ScoredPassage[] = scopedChunks.map((ch) => {
      const dScore = denseScoreMap.get(ch.id) || 0;
      const lScore = lexicalScoreMap.get(ch.id) || 0;
      let finalScore = 0;

      if (mode === "dense") {
        finalScore = dScore;
      } else if (mode === "keyword") {
        finalScore = lScore;
      } else {
        // Reciprocal Rank Fusion
        const dRank = denseRankMap.get(ch.id) || RRF_K * 2;
        const lRank = lexicalRankMap.get(ch.id) || RRF_K * 2;
        finalScore = 1 / (RRF_K + dRank) + 1 / (RRF_K + lRank);
      }

      return {
        id: ch.id,
        docId: ch.docId,
        workspaceId: ch.workspaceId,
        docName: ch.docName,
        content: ch.content,
        score: Number(finalScore.toFixed(6)),
        denseScore: Number(dScore.toFixed(4)),
        lexicalScore: Number(lScore.toFixed(4)),
        rank: 0,
      };
    });

    // 5. Filter and Sort
    const filtered = scoredPassages.filter((p) => p.score >= minScore);
    filtered.sort((a, b) => b.score - a.score);

    // Assign final rank
    filtered.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    return filtered.slice(0, topK);
  }
}
