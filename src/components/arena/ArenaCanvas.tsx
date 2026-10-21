"use client";

import React, { useState } from "react";
import {
  Swords,
  Send,
  Sparkles,
  Zap,
  Gauge,
  ThumbsUp,
  Award,
  Equal,
  Sliders,
  RotateCcw,
  Download,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const ArenaCanvas: React.FC = () => {
  const {
    models,
    arenaPanes,
    arenaSplitMode,
    arenaPrompt,
    setArenaPrompt,
    setArenaPaneModel,
    triggerArenaPrompt,
  } = useAppStore();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerArenaPrompt();
    }
  };

  const isGenerating = arenaPanes.some((p) => p.isGenerating);
  const [isExported, setIsExported] = useState(false);

  const handleExportBenchmark = () => {
    let report = `# Local Model Arena Benchmark Report\n\n**Prompt:** "${arenaPrompt}"\n\n| Model | Quant | TPS (Speed) | TTFT | Total Tokens | VRAM |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    arenaPanes.forEach((p, idx) => {
      const model = models.find((m) => m.id === p.modelId) || models[0];
      report += `| **${model.name}** | \`${model.quantization}\` | **${p.metrics.tps} t/s** | ${p.metrics.ttftMs}ms | ${p.metrics.totalTokens} tok | ${p.metrics.vramUsedGB} GB |\n`;
    });

    navigator.clipboard.writeText(report);
    setIsExported(true);
    setTimeout(() => setIsExported(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Arena Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
            <Swords className="w-4 h-4 text-indigo-400" />
            <span>Multi-Agent / Model Synchronous Arena</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
              Parallel Inference Testbed
            </span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Broadcast a single prompt across {arenaPanes.length} distinct architectures simultaneously to benchmark TPS, latency, and reasoning depth.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportBenchmark}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/5 transition-colors"
            title="Copy Arena Benchmark Markdown Table"
          >
            {isExported ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExported ? "Report Copied" : "Export Report"}</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="hidden sm:inline">Active Panes:</span>
            <span className="font-bold text-indigo-400 uppercase">{arenaSplitMode} Split</span>
          </div>
        </div>
      </div>

      {/* Synchronized Split Canvas Area */}
      <div
        className={cn(
          "flex-1 grid gap-3 p-4 overflow-hidden",
          arenaSplitMode === "dual" && "grid-cols-1 md:grid-cols-2",
          arenaSplitMode === "triple" && "grid-cols-1 md:grid-cols-3",
          arenaSplitMode === "quad" && "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {arenaPanes.map((pane, idx) => {
          const model = models.find((m) => m.id === pane.modelId) || models[0];

          return (
            <div
              key={idx}
              className="flex flex-col h-full bg-surface-raised/70 border border-surface-border rounded-2xl overflow-hidden shadow-glass"
            >
              {/* Pane Header */}
              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-zinc-900/80">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <select
                    value={pane.modelId}
                    onChange={(e) => setArenaPaneModel(idx, e.target.value)}
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
                    <span>Select Winner ({String.fromCharCode(65 + idx)})</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Broadcast Prompt Dock */}
      <div className="p-4 border-t border-surface-border bg-surface-raised/70">
        <div className="max-w-5xl mx-auto space-y-2">
          <div className="relative flex items-end bg-zinc-950 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors shadow-subtle">
            <textarea
              rows={2}
              value={arenaPrompt}
              onChange={(e) => setArenaPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Broadcast a benchmark prompt to all active arena models concurrently..."
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 resize-none px-3 py-1 focus:outline-none"
            />
            <button
              disabled={isGenerating || !arenaPrompt.trim()}
              onClick={triggerArenaPrompt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs shadow-sm transition-colors shrink-0"
            >
              <Swords className="w-4 h-4" />
              <span>{isGenerating ? "Executing..." : "Broadcast Battle"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
