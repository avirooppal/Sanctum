"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Zap,
  Gauge,
  Thermometer,
  ShieldCheck,
  ChevronUp,
  Server,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const TelemetryDock: React.FC = () => {
  const { telemetry, updateRealTelemetry, toggleTelemetryDock, isTelemetryExpanded } =
    useAppStore();

  const [mounted, setMounted] = useState(false);

  // Poll real hardware & daemon status every 4 seconds after client mount
  useEffect(() => {
    setMounted(true);
    updateRealTelemetry();
    const timer = setInterval(() => {
      updateRealTelemetry();
    }, 4000);
    return () => clearInterval(timer);
  }, [updateRealTelemetry]);

  // Deterministic values during SSR hydration, dynamic once mounted
  const ramTotal = mounted ? telemetry.ramTotalGB : 16.0;
  const ramUsed = mounted ? telemetry.ramUsedGB : 4.0;
  const ramPercent = Math.min(100, Math.round((ramUsed / (ramTotal || 1)) * 100));

  const vramTotal = mounted ? telemetry.vramTotalGB : 16.0;
  const vramUsed = mounted ? telemetry.vramUsedGB : 2.0;
  const vramPercent = Math.min(100, Math.round((vramUsed / (vramTotal || 1)) * 100));

  return (
    <footer
      suppressHydrationWarning
      className="glass-dock flex items-center justify-between px-4 h-9 select-none shrink-0 z-40 text-xs font-mono text-zinc-400"
      aria-label="Hardware Telemetry Dock"
    >
      {/* Left: Backend Layer & Device */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-zinc-200">LOCAL RUNTIME</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-white/5 text-[11px] text-indigo-300">
          <Zap className="w-3 h-3 text-indigo-400" />
          <span suppressHydrationWarning>{mounted ? telemetry.computeBackend : "Ollama Local Engine"}</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-zinc-400 text-[11px]">
          <Server className="w-3 h-3 text-zinc-500" />
          <span className="truncate max-w-[200px]" suppressHydrationWarning>
            {telemetry.gpuName}
          </span>
        </div>
      </div>

      {/* Center: Live Resource Gauges */}
      <div className="flex items-center gap-5">
        {/* VRAM Gauge */}
        <div
          suppressHydrationWarning
          className="flex items-center gap-2"
          title={`VRAM: ${vramUsed}GB used of ${vramTotal}GB`}
        >
          <span className="text-[10px] text-zinc-500">VRAM</span>
          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                vramPercent > 85 ? "bg-rose-500" : vramPercent > 65 ? "bg-amber-400" : "bg-cyan-400"
              )}
              style={{ width: `${vramPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-300">
            {vramUsed}G <span className="text-zinc-600">/</span> {vramTotal}G
          </span>
        </div>

        {/* RAM Gauge */}
        <div
          suppressHydrationWarning
          className="hidden lg:flex items-center gap-2"
          title={`System RAM: ${ramUsed}GB of ${ramTotal}GB`}
        >
          <span className="text-[10px] text-zinc-500">RAM</span>
          <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-400 transition-all duration-300"
              style={{ width: `${ramPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-400">{ramUsed}G</span>
        </div>

        {/* CPU % */}
        <div className="flex items-center gap-1 text-[11px]">
          <Cpu className="w-3 h-3 text-zinc-500" />
          <span className="text-zinc-300" suppressHydrationWarning>
            {telemetry.cpuUsage}%
          </span>
        </div>

        {/* GPU Temp */}
        <div className="hidden sm:flex items-center gap-1 text-[11px]">
          <Thermometer className="w-3 h-3 text-amber-500/80" />
          <span
            suppressHydrationWarning
            className={cn(telemetry.gpuTempC > 75 ? "text-rose-400 font-bold" : "text-zinc-300")}
          >
            {telemetry.gpuTempC}°C
          </span>
        </div>

        {/* Active TPS */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px]">
          <Gauge className="w-3 h-3 text-indigo-400" />
          <span className="font-semibold" suppressHydrationWarning>
            {telemetry.activeTps}
          </span>
          <span className="text-[9px] text-indigo-400/80">t/s</span>
        </div>
      </div>

      {/* Right: Security & Expand */}
      <div className="flex items-center gap-3">
        <div className="hidden xl:flex items-center gap-1 text-emerald-400 text-[10px] tracking-tight">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ZERO CLOUD EGRESS</span>
        </div>

        <button
          onClick={toggleTelemetryDock}
          className="p-1 hover:text-zinc-200 text-zinc-500 hover:bg-zinc-800 rounded transition-colors"
          title={isTelemetryExpanded ? "Collapse Telemetry Inspector" : "Expand Telemetry Inspector"}
        >
          <ChevronUp
            className={cn("w-3.5 h-3.5 transition-transform duration-200", isTelemetryExpanded && "rotate-180")}
          />
        </button>
      </div>
    </footer>
  );
};
