"use client";

import React from "react";
import { Zap, Award } from "lucide-react";
import { ArenaPaneState, LocalModel } from "@/types";

interface ArenaPaneProps {
  pane: ArenaPaneState;
  index: number;
  models: LocalModel[];
  onSelectModel: (modelId: string) => void;
}

export const ArenaPane: React.FC<ArenaPaneProps> = ({
  pane,
  index,
  models,
  onSelectModel,
}) => {
  const model = models.find((m) => m.id === pane.modelId) || models[0] || {
    name: "Unknown Model",
    quantization: "Q4_K_M",
    parameters: "N/A",
  };

  const letter = String.fromCharCode(65 + index);

  return (
    <div className="flex flex-col h-full bg-surface-raised/70 border border-surface-border rounded-2xl overflow-hidden shadow-glass">
      {/* Pane Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 bg-zinc-900/80">
        <div className="flex items-center gap-2 flex-1 mr-2">
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
            {letter}
          </div>
          <select
            value={pane.modelId}
            onChange={(e) => onSelectModel(e.target.value)}
            className="w-full text-xs font-semibold bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-none focus:border-indigo-500 truncate"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.quantization})
              </option>
            ))}
          </select>
        </div>

        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5 shrink-0">
          {model.parameters}
        </span>
      </div>

      {/* Pane Body / Response Output */}
      <div className="flex-1 overflow-y-auto p-4 text-xs font-sans text-zinc-200 leading-relaxed space-y-3">
        {pane.isGenerating ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 text-zinc-500 font-mono text-xs animate-pulse">
            <Zap className="w-5 h-5 text-indigo-400 animate-bounce" />
            <span>Streaming local tokens...</span>
          </div>
        ) : pane.currentResponse ? (
          <div className="whitespace-pre-wrap">{pane.currentResponse}</div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-[11px] text-center px-4">
            Awaiting broadcast prompt execution...
          </div>
        )}
      </div>

      {/* Pane Benchmark Metrics */}
      <div className="p-3 border-t border-white/5 bg-zinc-950/60 font-mono text-[10px] text-zinc-400 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900 border border-white/5">
            <span className="text-zinc-500">SPEED</span>
            <span className="font-bold text-indigo-400">{pane.metrics.tps} t/s</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900 border border-white/5">
            <span className="text-zinc-500">TTFT</span>
            <span className="font-semibold text-zinc-300">{pane.metrics.ttftMs} ms</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900 border border-white/5">
            <span className="text-zinc-500">TOKENS</span>
            <span className="font-semibold text-zinc-300">{pane.metrics.totalTokens}</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900 border border-white/5">
            <span className="text-zinc-500">VRAM</span>
            <span className="font-semibold text-cyan-400">{pane.metrics.vramUsedGB} GB</span>
          </div>
        </div>

        {/* Rating Button */}
        <div className="flex items-center justify-between pt-1">
          <button
            className="w-full py-1 text-center text-[10px] font-sans font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-900 hover:bg-indigo-600/30 border border-white/5 rounded transition-colors flex items-center justify-center gap-1.5"
            title="Vote as superior response"
          >
            <Award className="w-3 h-3 text-amber-400" />
            <span>Select Winner ({letter})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
