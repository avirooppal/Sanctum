"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  IconRefresh,
  IconTrash,
  IconFolder,
  IconDownload,
  IconSearch,
  IconCopy,
  IconCheck,
  IconTerminal2,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
  IconActivity,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Entry = {
  time: string;
  level: string;
  category: string;
  message: string;
};

export function SettingsLogs() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [path, setPath] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const r = await fetch("/api/logs");
      if (!r.ok) throw new Error("Could not read diagnostics logs");
      const data = await r.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setPath(data.path || "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostics logs unavailable");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    if (live) {
      const timer = setInterval(refresh, 3000);
      return () => clearInterval(timer);
    }
  }, [live]);

  const bridge = (type: string) => {
    const wv = (
      window as unknown as {
        chrome?: { webview?: { postMessage?: (msg: string) => void } };
      }
    ).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type }));
      if (type === "openLogs") {
        toast.success("Opening system log folder...");
      } else if (type === "exportLogs") {
        toast.success("Exporting system logs...");
      }
    } else {
      toast.info("Operating in browser sandbox: desktop window bridge unavailable");
    }
  };

  const handleCopyPath = () => {
    if (!path) return;
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    toast.success("Log file path copied");
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyEntry = (entry: Entry, idx: number) => {
    const text = `[${new Date(entry.time).toISOString()}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success("Log line copied");
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleClearLogs = async () => {
    try {
      const r = await fetch("/api/logs", { method: "DELETE" });
      if (r.ok) {
        await refresh();
        toast.success("Diagnostics log file cleared");
      } else {
        setError("Could not clear logs");
        toast.error("Failed to clear logs");
      }
    } catch {
      setError("Network error clearing logs");
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesLevel = level === "all" || e.level?.toLowerCase() === level.toLowerCase();
      const matchesSearch =
        !search ||
        `${e.category} ${e.message} ${e.level}`.toLowerCase().includes(search.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [entries, level, search]);

  const counts = useMemo(() => {
    let info = 0;
    let error = 0;
    let warn = 0;
    for (const e of entries) {
      const l = e.level?.toLowerCase();
      if (l === "error") error++;
      else if (l === "warn" || l === "warning") warn++;
      else info++;
    }
    return { all: entries.length, info, error, warn };
  }, [entries]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl w-full">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <IconTerminal2 size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Diagnostics & System Logs
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Local startup, setup, engine, and hardware runtime diagnostics. Prompts, user responses,
            and file contents are never recorded.
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <IconRefresh size={14} className={cn(isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            variant={live ? "secondary" : "outline"}
            size="sm"
            onClick={() => setLive((prev) => !prev)}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              )}
            />
            <span>{live ? "Live Stream" : "Paused"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => bridge("exportLogs")}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <IconDownload size={14} />
            <span>Export</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => bridge("openLogs")}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <IconFolder size={14} />
            <span>Open Folder</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLogs}
            className="rounded-xl text-xs h-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 gap-1.5"
          >
            <IconTrash size={14} />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Path & Stats Banner Card */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground shrink-0 font-medium">Log File:</span>
            <code className="font-mono text-[11px] text-foreground bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-xl">
              {path || "desktop.jsonl"}
            </code>
            <button
              onClick={handleCopyPath}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Copy log file path"
            >
              {copiedPath ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-[11px]">
            <span className="inline-flex items-center gap-1">
              <IconActivity size={13} className="text-primary" />
              Latest 300 entries
            </span>
            <span>·</span>
            <span>Rotates at 2 MiB</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <IconAlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Level Badges */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60 shrink-0">
          {[
            { id: "all", label: "All", count: counts.all },
            { id: "info", label: "Info", count: counts.info },
            { id: "warn", label: "Warnings", count: counts.warn },
            { id: "error", label: "Errors", count: counts.error },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLevel(tab.id)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                level === tab.id
                  ? "bg-card text-foreground shadow-xs border border-border/80 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  level === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <IconSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            aria-label="Search logs"
            placeholder="Search category or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border/70 rounded-xl pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <IconX size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Logs Table Surface */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/40 sticky top-0 z-10 border-b border-border/80 backdrop-blur-md">
              <tr className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
                <th className="p-3.5 w-44 font-semibold">Timestamp</th>
                <th className="p-3.5 w-24 font-semibold">Level</th>
                <th className="p-3.5 w-28 font-semibold">Category</th>
                <th className="p-3.5 font-semibold">Message</th>
                <th className="p-3.5 w-12 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-xs">
              {filteredEntries.map((entry, idx) => {
                const lvl = entry.level?.toLowerCase();
                const isError = lvl === "error";
                const isWarn = lvl === "warn" || lvl === "warning";
                const dateObj = new Date(entry.time);
                const timeStr = isNaN(dateObj.getTime())
                  ? entry.time
                  : dateObj.toLocaleTimeString([], {
                      hour12: true,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                return (
                  <tr
                    key={idx}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3.5 whitespace-nowrap text-muted-foreground text-[11px]">
                      {timeStr}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border",
                          isError
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : isWarn
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}
                      >
                        {entry.level || "info"}
                      </span>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px]">
                        {entry.category || "system"}
                      </span>
                    </td>

                    <td className="p-3.5 font-sans text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed select-text">
                      <span className="font-mono text-[11px]">{entry.message}</span>
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleCopyEntry(entry, idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        title="Copy log entry"
                      >
                        {copiedIndex === idx ? (
                          <IconCheck size={13} className="text-emerald-500" />
                        ) : (
                          <IconCopy size={13} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
              <div className="size-10 rounded-xl bg-muted/50 text-muted-foreground flex items-center justify-center">
                <IconInfoCircle size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">No matching diagnostic records</p>
                <p className="text-[11px] text-muted-foreground">
                  {search
                    ? `No logs match "${search}". Try clearing search or changing the level filter.`
                    : "No system log events recorded yet."}
                </p>
              </div>
              {search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setLevel("all");
                  }}
                  className="rounded-xl text-xs h-7"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
