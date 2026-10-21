"use client";

import React, { useState } from "react";
import { ArrowDownToLine, Layers } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ModelCard } from "./ModelCard";

export const ModelHubView: React.FC = () => {
  const {
    models,
    selectedCategory,
    searchModelQuery,
    openConfigModal,
    toggleModelLoad,
    startModelDownload,
    isFetchingModels,
  } = useAppStore();

  const [pullInput, setPullInput] = useState("");

  const handlePull = async () => {
    if (!pullInput.trim()) return;
    const name = pullInput.trim();
    setPullInput("");
    await startModelDownload(name);
  };

  const filteredModels = models.filter((m) => {
    const matchesCat = selectedCategory === "all" || m.category === selectedCategory;
    const matchesQuery =
      m.name.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
      m.quantization.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
      m.parameters.toLowerCase().includes(searchModelQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h1 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <span>Local Model Engine & Weight Catalog</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
              Isolated GGUF / SafeTensors
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Deploy and allocate GPU layers, quantization presets, and VRAM directly to your local hardware.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400 font-mono hidden md:block">
            <span>Loaded: </span>
            <span className="text-emerald-400 font-bold">
              {models.filter((m) => m.isLoaded).length}
            </span>{" "}
            / {models.length}
          </div>
        </div>
      </div>

      {/* Model Cards Grid & Pull Bar */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Ollama Pull Model Bar */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/80 border border-white/5 max-w-2xl">
          <ArrowDownToLine className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            placeholder="Pull real model via Ollama (e.g. qwen3:1.7b, llama3.2, mistral)..."
            value={pullInput}
            onChange={(e) => setPullInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePull()}
            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none font-mono"
          />
          <button
            onClick={handlePull}
            disabled={!pullInput.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors shadow-sm shrink-0"
          >
            Pull Model
          </button>
        </div>

        {models.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 w-12 h-12 mx-auto flex items-center justify-center text-zinc-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-zinc-200">
              {isFetchingModels
                ? "Connecting to local Ollama daemon..."
                : "No local models found on http://localhost:11434"}
            </div>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Make sure Ollama is running (`ollama serve`). Pull a model above or install via CLI.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onToggleLoad={toggleModelLoad}
                onOpenConfig={openConfigModal}
                onStartDownload={startModelDownload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
