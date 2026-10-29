"use client";

import React, { useState, useEffect } from "react";
import { IconCpu, IconRefresh, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const SettingsHardware: React.FC = () => {
  const [threads, setThreads] = useState<number>(4);
  const [gpuLayers, setGpuLayers] = useState<number>(0);
  const [contextLength, setContextLength] = useState<number>(4096);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["hardware.cpuThreads"]) setThreads(data.settings["hardware.cpuThreads"]);
          if (data.settings["hardware.gpuLayers"] !== undefined) setGpuLayers(data.settings["hardware.gpuLayers"]);
          if (data.settings["hardware.contextLength"]) setContextLength(data.settings["hardware.contextLength"]);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "hardware.cpuThreads": Number(threads),
          "hardware.gpuLayers": Number(gpuLayers),
          "hardware.contextLength": Number(contextLength),
        }),
      });
      if (res.ok) {
        toast.success("Hardware settings saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error while saving settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Hardware & Inference Engine
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure local CPU thread scheduling, memory allocation, and GPU acceleration.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isLoading}
          className="rounded-xl text-xs flex items-center gap-1.5"
        >
          <IconDeviceFloppy size={14} />
          <span>Save Changes</span>
        </Button>
      </div>

      {/* System Hardware Probe */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          System Accelerators
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <IconCpu size={20} className="text-primary" />
              <div>
                <span className="text-xs font-medium text-foreground">Inference Backend</span>
                <p className="text-[11px] text-muted-foreground">Ollama local engine</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch("/api/system");
                  if (!response.ok) throw new Error("Could not scan hardware");
                  const system = await response.json();
                  toast.info(`${system.logicalCores} logical cores · ${system.gpuName}`);
                } catch { toast.error("Could not scan hardware. Open System monitor for diagnostics."); }
              }}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconRefresh size={14} />
              <span>Rescan</span>
            </Button>
          </div>
        </div>
      </section>

      {/* CPU Threads */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compute Scheduling
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">CPU Threads</span>
              <p className="text-[11px] text-muted-foreground">
                Number of worker threads allocated for token generation (1 to 64).
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={64}
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-20 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">GPU Offload Layers</span>
              <p className="text-[11px] text-muted-foreground">
                Transformer layers loaded directly into VRAM (0 for CPU only).
              </p>
            </div>
            <input
              type="number"
              min={0}
              max={128}
              value={gpuLayers}
              onChange={(e) => setGpuLayers(Number(e.target.value))}
              className="w-20 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Context Window</span>
              <p className="text-[11px] text-muted-foreground">
                Maximum token sequence capacity allocated in working memory.
              </p>
            </div>
            <select
              value={contextLength}
              onChange={(e) => setContextLength(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            >
              <option value={2048}>2048 tokens</option>
              <option value={4096}>4096 tokens</option>
              <option value={8192}>8192 tokens</option>
              <option value={16384}>16384 tokens</option>
              <option value={32768}>32768 tokens</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
};
