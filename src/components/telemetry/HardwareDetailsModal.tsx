"use client";

import React from "react";
import {
  Cpu,
  Zap,
  Activity,
  Server,
  Thermometer,
  ShieldCheck,
  HardDrive,
  X,
  Layers,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const HardwareDetailsModal: React.FC = () => {
  const { isTelemetryExpanded, toggleTelemetryDock, telemetry, models, daemons } = useAppStore();

  if (!isTelemetryExpanded) return null;

  const loadedModels = models.filter((m) => m.isLoaded);
  const ollamaDaemon = daemons.find((d) => d.type === "ollama");

  return (
    <div className="fixed inset-x-0 bottom-9 z-40 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl shadow-2xl p-6 select-none animate-in slide-in-from-bottom-2 duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Hardware Telemetry & Accelerator Diagnostics</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Real Hardware
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Live host memory, logical compute concurrency, and local daemon status
              </p>
            </div>
          </div>
          <button
            onClick={toggleTelemetryDock}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Diagnostic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {/* Card 1: Local Engine Daemon */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1.5 font-sans font-semibold text-zinc-200">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Engine Daemon</span>
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  ollamaDaemon?.online ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {ollamaDaemon?.online ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div className="text-zinc-100 font-bold text-xs truncate">
              Ollama (127.0.0.1:11434)
            </div>
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span>Ping Latency:</span>
                <span className="text-zinc-200">
                  {ollamaDaemon?.latencyMs !== undefined && ollamaDaemon.latencyMs >= 0
                    ? `${ollamaDaemon.latencyMs} ms`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Discovered Models:</span>
                <span className="text-indigo-400 font-bold">{models.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Transport:</span>
                <span className="text-zinc-300">HTTP/1.1 NDJSON Stream</span>
              </div>
            </div>
          </div>

          {/* Card 2: Memory & Context Space */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1.5 font-sans font-semibold text-zinc-200">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Host Memory</span>
              </span>
              <span className="text-[10px] text-cyan-400">
                {telemetry.ramTotalGB} GB Total
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((telemetry.ramUsedGB / telemetry.ramTotalGB) * 100))}%`,
                }}
              />
            </div>
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span>Client Heap:</span>
                <span className="text-zinc-200">{telemetry.ramUsedGB} GB</span>
              </div>
              <div className="flex justify-between">
                <span>Device RAM:</span>
                <span className="text-zinc-200">{telemetry.ramTotalGB} GB</span>
              </div>
              <div className="flex justify-between">
                <span>Active Tokens/s:</span>
                <span className="text-indigo-400 font-bold">{telemetry.activeTps} t/s</span>
              </div>
            </div>
          </div>

          {/* Card 3: Host CPU Concurrency */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1.5 font-sans font-semibold text-zinc-200">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Host Compute</span>
              </span>
              <span className="text-[10px] text-emerald-400">HARDWARE CONCURRENCY</span>
            </div>
            <div className="text-zinc-200 text-[11px] truncate">{telemetry.cpuModel}</div>
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span>Web Workers:</span>
                <span className="text-zinc-200">Supported</span>
              </div>
              <div className="flex justify-between">
                <span>SIMD/Wasm:</span>
                <span className="text-zinc-200">Supported</span>
              </div>
              <div className="flex justify-between">
                <span>Architecture:</span>
                <span className="text-zinc-200">64-bit Local Subsystem</span>
              </div>
            </div>
          </div>

          {/* Card 4: Real Installed Models on Host */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1.5 font-sans font-semibold text-zinc-200">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Local Weights</span>
              </span>
              <span className="text-[10px] text-indigo-400 font-bold">
                {models.length} Installed
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] max-h-24 overflow-y-auto">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-zinc-300">
                  <span className="truncate max-w-[150px]">{m.name}</span>
                  <span className="text-cyan-400">{m.fileSizeGB} GB</span>
                </div>
              ))}
              {models.length === 0 && (
                <div className="text-zinc-500 italic">No models found in Ollama repository.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
