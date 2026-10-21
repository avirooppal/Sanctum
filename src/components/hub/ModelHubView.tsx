"use client";

import React from "react";
import {
  Download,
  Power,
  Sliders,
  CheckCircle2,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  ArrowDownToLine,
  Filter,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { LocalModel } from "@/types";
import { cn } from "@/lib/utils";

export const ModelHubView: React.FC = () => {
  const {
    models,
    selectedCategory,
    searchModelQuery,
    openConfigModal,
    toggleModelLoad,
    startModelDownload,
    initModels,
    isFetchingModels,
  } = useAppStore();

  const [pullInput, setPullInput] = React.useState("");

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
              {isFetchingModels ? "Connecting to local Ollama daemon..." : "No local models found on http://localhost:11434"}
            </div>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Make sure Ollama is running (`ollama serve`). Pull a model above or install via CLI.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModels.map((model) => (
            <div
              key={model.id}
              className={cn(
                "group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200",
                model.isLoaded
                  ? "bg-zinc-900/90 border-indigo-500/40 shadow-glow"
                  : "bg-surface-raised/60 border-surface-border hover:border-zinc-700 hover:bg-zinc-900/40"
              )}
            >
              {/* Top Row: Meta Badges */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                        {model.name}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      by {model.author} • {model.architecture.toUpperCase()}
                    </div>
                  </div>

                  {/* Quantization Badge */}
                  <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-white/5 rounded-md">
                    {model.quantization}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {model.description}
                </p>

                {/* Hardware Spec Badges */}
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-zinc-950/70 border border-white/5 flex flex-col">
                    <span className="text-[10px] text-zinc-500">WEIGHT SIZE</span>
                    <span className="font-semibold text-zinc-200">{model.fileSizeGB} GB</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950/70 border border-white/5 flex flex-col">
                    <span className="text-[10px] text-zinc-500">VRAM REQ</span>
                    <span className="font-semibold text-cyan-400">{model.vramRequiredGB} GB</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950/70 border border-white/5 flex flex-col">
                    <span className="text-[10px] text-zinc-500">PARAMS</span>
                    <span className="font-semibold text-indigo-300">{model.parameters}</span>
                  </div>
                </div>

                {/* Context & GPU Layers Info */}
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-1">
                  <span>Context: {model.config.contextSize.toLocaleString()} tok</span>
                  <span>
                    Offload: {model.config.gpuLayers}/{model.config.maxGpuLayers} layers
                  </span>
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="pt-4 mt-4 border-t border-white/5 space-y-2.5">
                {/* Download Progress Bar if downloading */}
                {!model.downloaded && model.downloadProgress > 0 && model.downloadProgress < 100 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-indigo-400">
                      <span>Downloading Shards...</span>
                      <span>{model.downloadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${model.downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  {/* Download or State Indicator */}
                  {model.downloaded ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        onClick={() => toggleModelLoad(model.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm",
                          model.isLoaded
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10"
                        )}
                        title={model.isLoaded ? "Unload from VRAM" : "Load into VRAM"}
                      >
                        <Power className={cn("w-3.5 h-3.5", model.isLoaded && "text-emerald-400")} />
                        <span>{model.isLoaded ? "VRAM Active" : "Load Model"}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={model.downloadProgress > 0 && model.downloadProgress < 100}
                      onClick={() => startModelDownload(model.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download GGUF</span>
                    </button>
                  )}

                  {/* Hardware Configuration Button */}
                  <button
                    onClick={() => openConfigModal(model)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-white/5 transition-colors"
                    title="Hardware Offload & Context Tuning"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Hardware</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};
