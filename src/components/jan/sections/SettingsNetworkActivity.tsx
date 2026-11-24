"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShieldOff, ShieldCheck, RefreshCw, Download, WifiOff, Globe } from "lucide-react";
import { fetchWithApproval } from "@/lib/hostBridge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NetworkPolicy {
  offlineMode: boolean;
  allowModelDownloads: boolean;
  allowManualUpdate: boolean;
  allowBrowserAgent: boolean;
  allowWebFetch: boolean;
  allowRemoteMcp: boolean;
}

interface EgressLedgerEntry {
  timestamp: string;
  feature: string;
  host: string;
  url: string;
  status: string;
  reason: string;
  bytesSent: number;
  bytesReceived: number;
  sessionId?: string;
}

export const SettingsNetworkActivity: React.FC = () => {
  const [policy, setPolicy] = useState<NetworkPolicy>({
    offlineMode: false,
    allowModelDownloads: true,
    allowManualUpdate: true,
    allowBrowserAgent: false,
    allowWebFetch: false,
    allowRemoteMcp: false,
  });
  const [entries, setEntries] = useState<EgressLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/v1/network/policy"),
        fetch("/v1/network/ledger"),
      ]);
      if (pRes.ok) {
        const p = await pRes.json();
        setPolicy((prev) => ({ ...prev, ...p }));
      }
      if (lRes.ok) {
        const l = await lRes.json();
        setEntries(Array.isArray(l?.entries) ? l.entries.slice().reverse() : []);
      }
    } catch {
      // Dev mode without host
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleOfflineMode = async () => {
    if (busy) return;
    setBusy(true);
    const nextOffline = !policy.offlineMode;
    try {
      const res = nextOffline
        ? await fetch("/v1/network/offline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offline: true }),
          })
        : await fetchWithApproval(
            "/v1/network/offline",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ offline: false }),
            },
            "network_offline_disable"
          );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to update Offline mode");
        return;
      }
      setPolicy((prev) => ({ ...prev, ...data }));
      toast.success(
        nextOffline
          ? "Offline mode enabled — all non-loopback network traffic is blocked."
          : "Offline mode disabled — only explicitly enabled features may access the network."
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = async (featureKey: string, currentVal: boolean) => {
    if (busy || policy.offlineMode) return;
    setBusy(true);
    const nextVal = !currentVal;
    try {
      const res = nextVal
        ? await fetchWithApproval(
            "/v1/network/features",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ feature: featureKey, enabled: true }),
            },
            "network_feature_enable"
          )
        : await fetch("/v1/network/features", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feature: featureKey, enabled: false }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to update network feature");
        return;
      }
      setPolicy((prev) => ({ ...prev, ...data }));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/v1/network/ledger/export");
      if (!res.ok) {
        toast.error("Could not export egress ledger");
        return;
      }
      const data = await res.json();
      const blob = new Blob([data?.content || ""], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanctum-network-activity-${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported network activity ledger");
    } catch {
      toast.error("Could not export egress ledger");
    }
  };

  const featureRows: { key: string; field: keyof NetworkPolicy; label: string; desc: string }[] = [
    {
      key: "model_downloads",
      field: "allowModelDownloads",
      label: "Model downloads (Ollama / Hugging Face)",
      desc: "User-initiated local model, STT, and OCR pack downloads from allowlisted registries.",
    },
    {
      key: "manual_update",
      field: "allowManualUpdate",
      label: "Manual update check",
      desc: "Only checks GitHub releases when you click Check for Updates.",
    },
    {
      key: "browser_agent",
      field: "allowBrowserAgent",
      label: "Browser agent",
      desc: "Off by default. Supervised browser automation with per-domain approval.",
    },
    {
      key: "web_tools",
      field: "allowWebFetch",
      label: "Web fetch / search tools",
      desc: "Off by default. Opt-in web retrieval with per-domain approval.",
    },
    {
      key: "remote_mcp",
      field: "allowRemoteMcp",
      label: "Remote MCP servers",
      desc: "Off by default. Local stdio/loopback MCP servers always work without this.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Network Activity & Offline Mode</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sanctum is strictly local-only. Only loopback traffic (Ollama, local sidecars, local MCP) is allowed by default.
            Every non-loopback request is enforced by the host and recorded below with query strings and tokens redacted.
          </p>
        </div>
      </div>

      {/* Global Offline Mode Kill-Switch */}
      <div
        className={cn(
          "rounded-2xl border p-5 flex items-center justify-between gap-4 transition-colors",
          policy.offlineMode
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-border/70 bg-card"
        )}
      >
        <div className="flex items-start gap-3">
          {policy.offlineMode ? (
            <WifiOff className="size-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Offline mode</span>
              {policy.offlineMode && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  Active — Zero Non-Loopback Egress
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Blocks all non-loopback outbound HTTP at the host layer and disables model downloads, update checks, browser agent, web tools, and remote MCP. Local Ollama chat and workspace tools keep working normally.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={toggleOfflineMode}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0",
            policy.offlineMode
              ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          {policy.offlineMode ? "Disable Offline Mode" : "Enable Offline Mode"}
        </button>
      </div>

      {/* Per-Feature Outbound Permissions */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Allowed Outbound Features
            </h2>
          </div>
          {policy.offlineMode && (
            <span className="text-[11px] text-amber-300">
              Disabled while Offline mode is active
            </span>
          )}
        </div>
        <div className="divide-y divide-border/50">
          {featureRows.map((row) => {
            const enabled = Boolean(policy[row.field]) && !policy.offlineMode;
            return (
              <div key={row.key} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-foreground">{row.label}</div>
                  <div className="text-[11px] text-muted-foreground">{row.desc}</div>
                </div>
                <button
                  type="button"
                  disabled={busy || policy.offlineMode}
                  onClick={() => toggleFeature(row.key, Boolean(policy[row.field]))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors shrink-0",
                    policy.offlineMode
                      ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                      : enabled
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Append-Only Egress Ledger */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldOff className="size-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Non-Loopback Egress Ledger ({entries.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
              Export JSONL
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-4">Loading network activity…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center rounded-xl bg-muted/20 border border-border/40">
            No non-loopback network requests recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Feature</th>
                  <th className="py-2 pr-3">Host</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Bytes</th>
                  <th className="py-2">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {entries.map((e, i) => (
                  <tr key={`${e.timestamp}-${i}`}>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {e.timestamp?.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="py-2 pr-3">{e.feature}</td>
                    <td className="py-2 pr-3 text-foreground" title={e.url}>
                      {e.host}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px]",
                          e.status === "blocked"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        )}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {e.bytesSent}↑ / {e.bytesReceived}↓
                    </td>
                    <td className="py-2 text-muted-foreground">{e.sessionId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
