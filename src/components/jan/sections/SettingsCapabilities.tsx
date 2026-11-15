"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Download,
  Trash2,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

export const SettingsCapabilities: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newPerm, setNewPerm] = useState<"always_allow" | "allow_session" | "block">("always_allow");
  const [portInput, setPortInput] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/browser/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handlePackAction = async (action: "install" | "uninstall" | "clear_profile") => {
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/pack",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
        "browser_pack"
      );
      if (res.ok) {
        setStatus(await res.json());
        toast.success(
          action === "install"
            ? "Browser Agent pack installed."
            : action === "uninstall"
            ? "Browser Agent pack and profile uninstalled."
            : "Isolated browser profile cleared."
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Pack action failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddDomainRule = async () => {
    const dom = newDomain.trim().toLowerCase();
    if (!dom) return;
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/domain",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: dom, permission: newPerm }),
        },
        "browser_domain"
      );
      if (res.ok) {
        setStatus(await res.json());
        setNewDomain("");
        toast.success(`Domain rule saved for ${dom}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveDomainRule = async (dom: string) => {
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/domain",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: dom, permission: "remove" }),
        },
        "browser_domain"
      );
      if (res.ok) {
        setStatus(await res.json());
        toast.success(`Removed rule for ${dom}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddLocalhostPort = async () => {
    const p = parseInt(portInput.trim(), 10);
    if (!Number.isFinite(p) || p <= 0 || p > 65535) {
      toast.error("Enter a valid TCP port (1–65535).");
      return;
    }
    if (p === 1337 || p === 11434) {
      toast.error(`Port ${p} is a protected Sanctum internal port and is permanently hard-blocked.`);
      return;
    }
    const existing: number[] = status?.policy?.allowedLocalhostPorts || [];
    const next = Array.from(new Set([...existing, p]));
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/domain",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowedLocalhostPorts: next }),
        },
        "browser_domain"
      );
      if (res.ok) {
        setStatus(await res.json());
        setPortInput("");
        toast.success(`Allowed localhost port ${p} in Browser Agent`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLocalhostPort = async (portToRemove: number) => {
    const existing: number[] = status?.policy?.allowedLocalhostPorts || [];
    const next = existing.filter((p) => p !== portToRemove);
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/domain",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowedLocalhostPorts: next }),
        },
        "browser_domain"
      );
      if (res.ok) {
        setStatus(await res.json());
        toast.success(`Removed localhost port ${portToRemove}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const pack = status?.pack;
  const domainPerms: Record<string, string> = status?.policy?.domainPermissions || {};
  const allowedPorts: number[] = status?.policy?.allowedLocalhostPorts || [];

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
          Capabilities & Optional Packs
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage opt-in capability packs, isolated virtual environments, browser profiles, and domain security rules.
        </p>
      </div>

      {/* Browser Agent Pack Card */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Browser Agent Pack (browser-use)
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {pack?.name || "Browser Agent Pack (browser-use)"}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  v{pack?.version || "1.0.0"} · {pack?.license || "MIT"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Autonomous and deterministic web navigation powered by{" "}
                <span className="font-mono text-foreground">browser-use</span> (MIT License) and Playwright. Runs in an isolated profile with telemetry hard-disabled (<code className="font-mono">ANONYMIZED_TELEMETRY=false</code>).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pack?.installed ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handlePackAction("uninstall")}
                  className="rounded-xl text-xs h-8 flex items-center gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  <span>Uninstall Pack</span>
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handlePackAction("install")}
                  className="rounded-xl text-xs h-8 flex items-center gap-1.5"
                >
                  <Download className="size-3.5" />
                  <span>Install Pack</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/50 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Detected Browser
              </span>
              <div className="font-mono text-foreground font-medium">
                {pack?.detectedBrowser?.channel || "msedge"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {pack?.detectedBrowser?.executablePath || "System Edge / Chrome"}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Disk Footprint
              </span>
              <div className="font-mono text-foreground font-medium">
                {((pack?.diskSizeBytes || 0) / 1024).toFixed(1)} KB
              </div>
              <div className="text-[10px] text-muted-foreground truncate" title={pack?.venvDir}>
                {pack?.venvDir || "%LOCALAPPDATA%\\Sanctum\\packs\\browser-agent\\venv"}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Isolated Profile
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-emerald-400 text-[11px]">Dedicated</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePackAction("clear_profile")}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Clear Session
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground truncate" title={pack?.profileDir}>
                {pack?.profileDir || "%LOCALAPPDATA%\\Sanctum\\browser-profile"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Domain Allowlist Policy */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Browser Domain Policy & Localhost Opt-In
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 min-w-[180px] rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
            />
            <select
              value={newPerm}
              onChange={(e) => setNewPerm(e.target.value as any)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground"
            >
              <option value="always_allow">Always Allow</option>
              <option value="allow_session">Allow for Session</option>
              <option value="block">Block</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !newDomain.trim()}
              onClick={() => void handleAddDomainRule()}
              className="rounded-xl text-xs h-8 flex items-center gap-1"
            >
              <Plus className="size-3.5" />
              <span>Add Domain Rule</span>
            </Button>
          </div>

          {Object.keys(domainPerms).length > 0 && (
            <div className="space-y-1.5 pt-2">
              {Object.entries(domainPerms).map(([dom, perm]) => (
                <div
                  key={dom}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono text-foreground">{dom}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono uppercase">
                      {perm}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveDomainRule(dom)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Opt-In Localhost Ports */}
          <div className="pt-4 border-t border-border/50 space-y-2.5">
            <div>
              <span className="text-xs font-medium text-foreground">
                Allow Localhost in Browser Agent (Specific Dev Ports Only)
              </span>
              <p className="text-[11px] text-muted-foreground">
                Loopback and private IPs are blocked by default. You may allow specific local dev server ports below. Sanctum host port (1337) and Ollama port (11434) are permanently hard-blocked.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                placeholder="e.g. 3000 or 8080"
                className="w-44 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !portInput.trim()}
                onClick={() => void handleAddLocalhostPort()}
                className="rounded-xl text-xs h-8"
              >
                Allow Port
              </Button>
            </div>
            {allowedPorts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allowedPorts.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-mono text-foreground"
                  >
                    127.0.0.1:{p}
                    <button
                      type="button"
                      onClick={() => void handleRemoveLocalhostPort(p)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
