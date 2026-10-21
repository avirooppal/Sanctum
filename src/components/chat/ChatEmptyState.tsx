"use client";

import React from "react";
import { Bot } from "lucide-react";

interface ChatEmptyStateProps {
  onSelectSuggestion: (prompt: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  "Write an AVX-512 vector kernel in Rust",
  "Explain quantum error correction surface codes",
  "Optimize memory layout for zero-copy IPC",
  "Benchmark GGUF Q4_K_M vs Q8_0 throughput",
];

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ onSelectSuggestion }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
      <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-glow">
        <Bot className="w-8 h-8" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Local Hardware Inference Ready</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Zero network egress. Weights are resident in local VRAM with full AVX/CUDA acceleration.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full pt-2">
        {DEFAULT_SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSuggestion(suggestion)}
            className="p-2.5 text-left text-xs bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 rounded-xl text-zinc-300 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
