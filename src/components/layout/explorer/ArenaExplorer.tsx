"use client";

import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { ARENA_SPLIT_OPTIONS, BENCHMARK_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const ArenaExplorer: React.FC = () => {
  const { arenaSplitMode, setArenaSplitMode, setArenaPrompt } = useAppStore();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Split Canvas Layout
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {ARENA_SPLIT_OPTIONS.map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setArenaSplitMode(mode)}
              className={cn(
                "py-2 px-1 text-center text-xs rounded-lg border transition-colors font-medium",
                arenaSplitMode === mode
                  ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Benchmark Presets
        </span>
        <div className="space-y-1.5">
          {BENCHMARK_PRESETS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setArenaPrompt(item.prompt)}
              className="w-full p-2 text-left text-xs bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 rounded-lg text-zinc-300 transition-colors"
            >
              <div className="font-medium text-zinc-200">{item.title}</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">{item.prompt}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
