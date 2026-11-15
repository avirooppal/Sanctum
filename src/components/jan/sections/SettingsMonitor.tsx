"use client";

import React, { useEffect, useState } from "react";
import { IconCpu, IconRefresh, IconTool } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Snapshot = {
  timestamp: string;
  cpuPercent: number | null;
  cpuName: string;
  logicalCores: number;
  ramUsedGB: number | null;
  ramTotalGB: number | null;
  appMemoryMB: number;
  diskFreeGB: number | null;
  diskTotalGB: number | null;
  gpuName: string;
  uptimeSeconds: number;
  appUptimeSeconds: number;
  engineOnline: boolean;
  loadedModels: { name: string; sizeBytes: number | null; vramBytes: number | null }[];
};

const measure = (value: number | null | undefined, unit: string) =>
  value == null ? "Unavailable" : `${value.toFixed(1)} ${unit}`;

export function SettingsMonitor() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [live, setLive] = useState(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<any>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/system", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("System measurements unavailable");
      const data: Snapshot = await response.json();
      setSnapshot(data);
      setError("");
      if (data.cpuPercent != null) {
        setSamples((values) => [...values.slice(-29), data.cpuPercent!]);
      }
      const status = await fetch("/api/setup");
      if (status.ok) setSetup(await status.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitor unavailable");
    }
  };

  useEffect(() => {
    let running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try {
        await refresh();
      } finally {
        running = false;
      }
    };
    void poll();
    if (live) {
      const timer = setInterval(poll, 2500);
      return () => clearInterval(timer);
    }
  }, [live]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            System Monitor
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time hardware telemetry measured on this Windows PC. Unavailable sensors are never estimated.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-muted-foreground">Live refresh</span>
          <button
            type="button"
            role="switch"
            aria-checked={live}
            aria-label="Live refresh"
            onClick={() => setLive((v) => !v)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
              live ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                live ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      {/* Telemetry Metrics Grid */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Resource Telemetry
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["System CPU", measure(snapshot?.cpuPercent, "%")],
            [
              "System Memory",
              `${measure(snapshot?.ramUsedGB, "GB")} / ${measure(snapshot?.ramTotalGB, "GB")}`,
            ],
            ["Sanctum Host Memory", measure(snapshot?.appMemoryMB, "MB")],
            ["Storage Free", measure(snapshot?.diskFreeGB, "GB")],
            [
              "Local Engine",
              snapshot ? (snapshot.engineOnline ? "Running" : "Offline") : "Checking…",
            ],
            [
              "System Uptime",
              snapshot
                ? `${Math.floor(snapshot.uptimeSeconds / 3600)}h ${
                    Math.floor(snapshot.uptimeSeconds / 60) % 60
                  }m`
                : "Checking…",
            ],
          ].map(([name, value]) => (
            <div
              key={name}
              className="rounded-2xl border border-border/70 bg-card p-4 space-y-1.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {name}
              </p>
              <p className="text-base font-mono font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CPU Utilization Graph & Hardware Identity */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Processor &amp; Accelerator Profile
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Recent CPU Usage</span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {snapshot ? new Date(snapshot.timestamp).toLocaleTimeString() : "Sampling…"}
            </span>
          </div>
          <div
            className="flex items-end gap-1 h-20 rounded-xl border border-border/50 bg-background/60 p-2"
            aria-label="CPU history"
          >
            {samples.map((value, i) => (
              <div
                key={i}
                title={`${value}%`}
                className="bg-primary flex-1 rounded-t transition-all"
                style={{ height: `${Math.max(4, value)}%` }}
              />
            ))}
          </div>

          <div className="pt-3 border-t border-border/50 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CPU</span>
              <span className="font-mono text-foreground">
                {snapshot?.cpuName || "Checking…"} ({snapshot?.logicalCores ?? "?"} logical cores)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">GPU</span>
              <span className="font-mono text-foreground">{snapshot?.gpuName || "Checking…"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Loaded Models & Actions */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loaded Models &amp; Runtime Actions
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          {snapshot?.loadedModels.length ? (
            <div className="space-y-2">
              {snapshot.loadedModels.map((model) => (
                <div
                  key={model.name}
                  className="rounded-xl border border-border/60 bg-background/60 p-3 flex items-center justify-between text-xs"
                >
                  <span className="font-mono font-semibold text-foreground">{model.name}</span>
                  <span className="font-mono text-muted-foreground">
                    RAM: {measure(model.sizeBytes == null ? null : model.sizeBytes / 1073741824, "GB")} · VRAM:{" "}
                    {measure(model.vramBytes == null ? null : model.vramBytes / 1073741824, "GB")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No models currently loaded in memory.</p>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconRefresh size={14} />
              <span>Refresh Measurements</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={setup?.busy}
              onClick={async () => {
                const r = await fetch("/api/setup/start", { method: "POST" });
                if (r.ok) setSetup(await r.json());
                else setError("Could not start runtime repair");
              }}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconTool size={14} />
              <span>Repair Runtime Setup</span>
            </Button>
          </div>
          {setup && setup.phase !== "idle" && (
            <p role="status" className="text-xs font-mono text-muted-foreground">
              {setup.detail}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
