"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Snapshot = { timestamp: string; cpuPercent: number | null; cpuName: string; logicalCores: number; ramUsedGB: number | null; ramTotalGB: number | null; appMemoryMB: number; diskFreeGB: number | null; diskTotalGB: number | null; gpuName: string; uptimeSeconds: number; appUptimeSeconds: number; engineOnline: boolean; loadedModels: { name: string; sizeBytes: number | null; vramBytes: number | null }[] };
const measure = (value: number | null | undefined, unit: string) => value == null ? "Unavailable" : `${value.toFixed(1)} ${unit}`;
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
      const data: Snapshot = await response.json(); setSnapshot(data); setError("");
      if (data.cpuPercent != null) setSamples(values => [...values.slice(-29), data.cpuPercent!]);
      const status = await fetch("/api/setup"); if (status.ok) setSetup(await status.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Monitor unavailable"); }
  };
  useEffect(() => { let running = false; const poll = async () => { if (running) return; running = true; try { await refresh(); } finally { running = false; } }; void poll(); if (live) { const timer = setInterval(poll, 2500); return () => clearInterval(timer); } }, [live]);
  return <div className="flex-1 overflow-auto p-8 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">System monitor</h1><label className="text-sm"><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> Live refresh</label></div>
    <p className="text-sm text-muted-foreground">Measured on this Windows PC. Unavailable sensors are not estimated.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
      {[
        ["System CPU", measure(snapshot?.cpuPercent, "%")],
        ["System memory", `${measure(snapshot?.ramUsedGB, "GB")} / ${measure(snapshot?.ramTotalGB, "GB")}`],
        ["Sanctum host memory", measure(snapshot?.appMemoryMB, "MB")],
        ["Storage free", measure(snapshot?.diskFreeGB, "GB")],
        ["Local engine", snapshot ? snapshot.engineOnline ? "Running" : "Offline" : "Checking…"],
        ["System uptime", snapshot ? `${Math.floor(snapshot.uptimeSeconds / 3600)}h ${Math.floor(snapshot.uptimeSeconds / 60) % 60}m` : "Checking…"],
      ].map(([name, value]) => <div key={name} className="border rounded-xl p-4 space-y-2"><p className="text-xs text-muted-foreground">{name}</p><p className="text-lg font-medium">{value}</p></div>)}
    </div>
    <div className="border rounded-xl p-4 space-y-3"><p className="text-sm">Recent CPU usage</p><div className="flex items-end gap-1 h-20" aria-label="CPU history">{samples.map((value, i) => <div key={i} title={`${value}%`} className="bg-primary flex-1 rounded-t" style={{ height: `${Math.max(1, value)}%` }} />)}</div></div>
    <div className="text-sm space-y-2"><p>CPU: {snapshot?.cpuName || "Checking…"} ({snapshot?.logicalCores ?? "?"} logical cores)</p><p>GPU: {snapshot?.gpuName || "Checking…"}</p><p className="text-muted-foreground">GPU utilization and temperature: unavailable. Model VRAM allocation is reported below by the local engine.</p></div>
    <section className="space-y-3"><h2 className="font-semibold">Loaded models</h2>{snapshot?.loadedModels.length ? snapshot.loadedModels.map(model => <div key={model.name} className="border rounded p-3 text-sm"><strong>{model.name}</strong><p>Memory: {measure(model.sizeBytes == null ? null : model.sizeBytes / 1073741824, "GB")} · GPU allocation: {measure(model.vramBytes == null ? null : model.vramBytes / 1073741824, "GB")}</p></div>) : <p className="text-sm text-muted-foreground">No models currently loaded.</p>}</section>
    <div className="flex items-center gap-3"><Button variant="outline" onClick={refresh}>Refresh measurements</Button><Button disabled={setup?.busy} onClick={async () => { const r = await fetch("/api/setup/start", { method: "POST" }); if (r.ok) setSetup(await r.json()); else setError("Could not start runtime repair"); }}>Repair runtime setup</Button></div>
    {setup && setup.phase !== "idle" && <p role="status" className="text-sm">{setup.detail}</p>}
    <p className="text-xs text-muted-foreground">Updated: {snapshot ? new Date(snapshot.timestamp).toLocaleTimeString() : "Waiting for measurements"}</p>
  </div>;
}
