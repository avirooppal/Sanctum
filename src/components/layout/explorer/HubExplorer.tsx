"use client";

import React from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ModelCategory } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORIES: [ModelCategory, string][] = [
  ["all", "All Models"],
  ["reasoning", "STEM & Reasoning"],
  ["coding", "Code Intelligence"],
  ["general", "General Instruct"],
  ["vision", "Vision & OCR"],
  ["embedding", "Dense Retrieval"],
];

export const HubExplorer: React.FC = () => {
  const {
    models,
    selectedCategory,
    setSelectedCategory,
    searchModelQuery,
    setSearchModelQuery,
    telemetry,
  } = useAppStore();

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Search models, quant..."
          value={searchModelQuery}
          onChange={(e) => setSearchModelQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Filter Categories */}
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Categories
        </span>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map(([catId, label]) => {
            const count =
              catId === "all" ? models.length : models.filter((m) => m.category === catId).length;
            return (
              <button
                key={catId}
                onClick={() => setSelectedCategory(catId)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left",
                  selectedCategory === catId
                    ? "bg-indigo-600/15 text-indigo-300 font-medium border border-indigo-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                <span>{label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory Budget Overview */}
      <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-medium">VRAM Allocation</span>
          <span className="font-mono text-zinc-300">
            {telemetry.vramUsedGB} / {telemetry.vramTotalGB} GB
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${(telemetry.vramUsedGB / telemetry.vramTotalGB) * 100}%` }}
          />
        </div>
        <div className="text-[10px] text-zinc-500 flex justify-between">
          <span>{telemetry.totalLoadedModels} Active in Memory</span>
          <span className="text-emerald-400 font-medium">Zero Swap</span>
        </div>
      </div>
    </div>
  );
};
