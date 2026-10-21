"use client";

import React from "react";
import { Power, Sliders, ArrowDownToLine } from "lucide-react";
import { LocalModel } from "@/types";
import { cn } from "@/lib/utils";

interface ModelCardProps {
  model: LocalModel;
  onToggleLoad: (id: string) => void;
  onOpenConfig: (model: LocalModel) => void;
  onStartDownload: (id: string) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onToggleLoad,
  onOpenConfig,
  onStartDownload,
}) => {
  return (
    <div
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
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{model.description}</p>

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
                onClick={() => onToggleLoad(model.id)}
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
              onClick={() => onStartDownload(model.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Download GGUF</span>
            </button>
          )}

          {/* Hardware Configuration Button */}
          <button
            onClick={() => onOpenConfig(model)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-white/5 transition-colors"
            title="Hardware Offload & Context Tuning"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Hardware</span>
          </button>
        </div>
      </div>
    </div>
  );
};
