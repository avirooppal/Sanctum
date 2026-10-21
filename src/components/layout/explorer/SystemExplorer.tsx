"use client";

import React from "react";
import { Cpu, HardDrive } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { NavModule } from "@/types";

interface SystemExplorerProps {
  module: NavModule;
}

export const SystemExplorer: React.FC<SystemExplorerProps> = ({ module }) => {
  const { telemetry } = useAppStore();

  if (module === "telemetry") {
    return (
      <div className="space-y-3">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Compute Topology
        </span>
        <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-400 font-medium">
            <Cpu className="w-4 h-4" />
            <span>Primary Accelerator</span>
          </div>
          <div className="font-mono text-zinc-200 text-[11px]">{telemetry.gpuName}</div>
          <div className="text-zinc-500 text-[10px]">
            Driver: 560.35 | Compute Capability: 8.9 (Ada Lovelace)
          </div>
        </div>

        <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-medium">
            <HardDrive className="w-4 h-4" />
            <span>Unified Memory Bus</span>
          </div>
          <div className="font-mono text-zinc-300 text-[11px]">PCIe 4.0 x16 (64 GB/s)</div>
          <div className="text-zinc-500 text-[10px]">Host RAM: DDR5-6000 ECC Enabled</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
        Configuration Panels
      </span>
      <div className="space-y-1">
        {[
          "Local Inference Daemons",
          "Storage & Cache Directory",
          "Air-Gapped Invariants",
          "GPU Kernel Offload Rules",
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 text-xs text-zinc-300 font-medium"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
