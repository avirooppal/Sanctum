"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Entry = { time: string; level: string; category: string; message: string };
export function SettingsLogs() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [path, setPath] = useState("");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    try {
      const r = await fetch("/api/logs"); if (!r.ok) throw new Error("Could not read logs");
      const data = await r.json(); setEntries(data.entries); setPath(data.path); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Logs unavailable"); }
  };
  useEffect(() => { void refresh(); if (live) { const timer = setInterval(refresh, 3000); return () => clearInterval(timer); } }, [live]);
  const bridge = (type: string) => (window as any).chrome?.webview?.postMessage(JSON.stringify({ type }));
  return <div className="flex-1 overflow-auto p-8 space-y-5">
    <h1 className="text-xl font-semibold">Logs</h1>
    <p className="text-sm text-muted-foreground">Local startup, setup, engine, and file-operation diagnostics. Prompts, responses, and file contents are not recorded here.</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">Level <select aria-label="Log level" value={level} onChange={e => setLevel(e.target.value)} className="border rounded bg-background p-2"><option>all</option><option>info</option><option>error</option></select></label>
      <input aria-label="Search logs" placeholder="Search logs" value={search} onChange={e => setSearch(e.target.value)} className="border rounded bg-background p-2 text-sm" />
      <label className="text-sm"><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> Live refresh</label>
      <Button variant="outline" onClick={refresh}>Refresh</Button>
      <Button variant="outline" onClick={() => bridge("exportLogs")}>Export logs</Button>
      <Button variant="outline" onClick={() => bridge("openLogs")}>Open log folder</Button>
      <Button variant="outline" onClick={async () => { const r = await fetch("/api/logs", { method: "DELETE" }); if (r.ok) await refresh(); else setError("Could not clear logs"); }}>Clear logs</Button>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground break-all">{path} · Latest 300 entries · Rotates at 2 MiB</p>
    <div className="rounded border border-border overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr className="border-b"><th className="p-3">Time</th><th>Level</th><th>Category</th><th>Message</th></tr></thead><tbody>
      {entries.filter(e => (level === "all" || e.level === level) && `${e.category} ${e.message}`.toLowerCase().includes(search.toLowerCase())).map((entry, i) => <tr key={i} className="border-b border-border/40"><td className="p-3 whitespace-nowrap">{new Date(entry.time).toLocaleString()}</td><td>{entry.level}</td><td className="p-2">{entry.category}</td><td className="p-3 whitespace-pre-wrap break-all">{entry.message}</td></tr>)}
    </tbody></table>{entries.length === 0 && <p className="p-6 text-sm text-muted-foreground">No log entries.</p>}</div>
  </div>;
}
