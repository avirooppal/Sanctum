"use client";

import React from "react";
import { VectorChunk } from "@/lib/vectorStore";
import { DocumentChunk } from "@/types";

interface VectorChunkCardProps {
  chunk: VectorChunk | DocumentChunk;
  docName?: string;
  isRankedMatch?: boolean;
}

export const VectorChunkCard: React.FC<VectorChunkCardProps> = ({
  chunk,
  docName,
  isRankedMatch,
}) => {
  const similarity = "similarity" in chunk ? chunk.similarity : undefined;

  return (
    <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/5 space-y-2 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {docName && (
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
              {docName}
            </span>
          )}
          <span>Chunk #{chunk.chunkIndex}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{chunk.tokenCount} tokens</span>
          {isRankedMatch && similarity !== undefined && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
              {(similarity * 100).toFixed(1)}% Cosine Match
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950/50 p-3 rounded-lg border border-white/5">
        {chunk.content}
      </div>
    </div>
  );
};
