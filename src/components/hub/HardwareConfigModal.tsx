"use client";

import React, { useState } from "react";
import {
  X,
  Zap,
  Sliders,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { LocalModel } from "@/types";
import { cn } from "@/lib/utils";

interface ModalContentProps {
  model: LocalModel;
  onClose: () => void;
}

const HardwareConfigModalContent: React.FC<ModalContentProps> = ({ model, onClose }) => {
  const { updateModelConfig } = useAppStore();
  const [config, setConfig] = useState(model.config);

  const handleSave = () => {
    updateModelConfig(model.id, config);
    onClose();
  };

  // Estimate VRAM dynamically based on layers and context length
  const estimatedVram = Number(
    (
      (config.gpuLayers / (model.config.maxGpuLayers || 48)) * model.vramRequiredGB +
      (config.contextSize / 32768) * 1.8
    ).toFixed(1)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{model.name}</h2>
              <p className="text-xs text-zinc-400">Hardware Allocation & Inference Runtime Tuning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Estimated VRAM Impact Callout */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/80 border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-xs font-medium text-zinc-200">Hardware Memory Footprint</div>
                <div className="text-[11px] text-zinc-500">
                  Offloaded Layers + KV-Cache buffer footprint
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-bold text-indigo-300">
                ~{estimatedVram} GB
              </span>
              <span className="text-xs text-zinc-500"> VRAM required</span>
            </div>
          </div>

          {/* GPU Layers Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-medium text-zinc-300">GPU Layers Offload (cuBLAS)</label>
              <span className="font-mono text-indigo-400 font-semibold">
                {config.gpuLayers} / {model.config.maxGpuLayers} layers
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={model.config.maxGpuLayers}
              value={config.gpuLayers}
              onChange={(e) => setConfig({ ...config, gpuLayers: Number(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>0 (100% CPU RAM)</span>
              <span>Full VRAM Offload ({model.config.maxGpuLayers} layers)</span>
            </div>
          </div>

          {/* Context Window Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-medium text-zinc-300">Active Context Window Tokens (n_ctx)</label>
              <span className="font-mono text-cyan-400 font-semibold">
                {config.contextSize.toLocaleString()} tokens
              </span>
            </div>
            <input
              type="range"
              min={2048}
              max={model.contextWindow}
              step={2048}
              value={config.contextSize}
              onChange={(e) => setConfig({ ...config, contextSize: Number(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>2,048</span>
              <span>Native Max: {model.contextWindow.toLocaleString()}</span>
            </div>
          </div>

          {/* CPU Threading & Sampling */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">CPU Compute Threads</label>
              <select
                value={config.threads}
                onChange={(e) => setConfig({ ...config, threads: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {[4, 6, 8, 12, 16, 24, 32].map((num) => (
                  <option key={num} value={num}>
                    {num} Threads (SMT Bound)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Temperature (Creativity)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.0}
                  max={2.0}
                  step={0.05}
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Advanced Toggles */}
          <div className="space-y-2 pt-2 border-t border-zinc-900">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Optimization Flags
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConfig({ ...config, flashAttention: !config.flashAttention })}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                  config.flashAttention
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                )}
              >
                <span>Flash Attention 2</span>
                {config.flashAttention && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, mlock: !config.mlock })}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                  config.mlock
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                )}
              >
                <span>Lock RAM (mlock)</span>
                {config.mlock && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, numa: !config.numa })}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                  config.numa
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                )}
              >
                <span>NUMA Interleaving</span>
                {config.numa && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
          >
            Apply & Save Parameters
          </button>
        </div>
      </div>
    </div>
  );
};

export const HardwareConfigModal: React.FC = () => {
  const { isConfigModalOpen, closeConfigModal, selectedModelForConfig } = useAppStore();

  if (!isConfigModalOpen || !selectedModelForConfig) {
    return null;
  }

  return (
    <HardwareConfigModalContent
      key={selectedModelForConfig.id}
      model={selectedModelForConfig}
      onClose={closeConfigModal}
    />
  );
};
