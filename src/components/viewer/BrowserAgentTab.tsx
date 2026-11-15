"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Play,
  Pause,
  Hand,
  Square,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

interface BrowserStatusData {
  pack: {
    id: string;
    name: string;
    version: string;
    upstream: string;
    license: string;
    installed: boolean;
    venvDir: string;
    profileDir: string;
    detectedBrowser: { channel: string; executablePath: string | null };
    diskSizeBytes: number;
    telemetryDisabled: boolean;
  };
  session: {
    status: "idle" | "running" | "paused" | "takeover";
    url: string;
    title: string;
    screenshot: string;
    elements: any[];
    forms: any[];
    steps: any[];
  };
  policy: {
    domainPermissions: Record<string, string>;
    allowedLocalhostPorts: number[];
    useVisionDefault: string;
    systemRule: string;
  };
}

export const BrowserAgentTab: React.FC = () => {
  const [data, setData] = useState<BrowserStatusData | null>(null);
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [goalInput, setGoalInput] = useState("");
  const [pendingDomain, setPendingDomain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/browser/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.session?.url && json.session.url !== "about:blank") {
          setUrlInput(json.session.url);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshStatus();
    const onBrowserUpdated = () => void refreshStatus();
    window.addEventListener("sanctum:browser-updated", onBrowserUpdated);
    const interval = setInterval(refreshStatus, 2500);
    return () => {
      window.removeEventListener("sanctum:browser-updated", onBrowserUpdated);
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const handleInstallPack = async () => {
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/pack",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "install" }),
        },
        "browser_pack"
      );
      if (res.ok) {
        setData(await res.json());
        toast.success("Browser Agent pack (browser-use) initialized.");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to install Browser Agent pack.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDomainDecision = async (
    domain: string,
    permission: "allow_once" | "allow_session" | "always_allow" | "block"
  ) => {
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/domain",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, permission }),
        },
        "browser_domain"
      );
      if (res.ok) {
        setData(await res.json());
        setPendingDomain(null);
        toast.success(`Domain ${domain}: ${permission.replace("_", " ")}`);
        if (permission !== "block") {
          await handleNavigate(urlInput);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleNavigate = async (targetUrl: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/browser/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "browser_open", url: targetUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.requiresDomainApproval && body.domain) {
          setPendingDomain(body.domain);
        } else {
          toast.error(body.error || "Navigation blocked by Browser Agent policy.");
        }
      } else {
        setPendingDomain(null);
        await refreshStatus();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunTask = async () => {
    if (!goalInput.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/browser/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "browser_task",
          goal: goalInput.trim(),
          start_url: urlInput.trim() || undefined,
          max_steps: 6,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.requiresDomainApproval && body.domain) {
          setPendingDomain(body.domain);
        } else {
          toast.error(body.error || "Browser task blocked or failed.");
        }
      } else {
        setGoalInput("");
        await refreshStatus();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleControl = async (command: "pause" | "takeover" | "resume" | "stop") => {
    try {
      const res = await fetch("/api/browser/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (res.ok) {
        setData(await res.json());
        toast.success(
          command === "takeover"
            ? "Take-over mode active: complete login/challenge, then click Resume."
            : `Browser session: ${command}`
        );
      }
    } catch {}
  };

  const session = data?.session;
  const pack = data?.pack;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background text-xs">
      {/* Pack Installation Prompt if not installed */}
      {pack && !pack.installed && (
        <div className="m-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Globe className="size-4 text-primary" />
              <span>Browser Agent Pack (browser-use · MIT)</span>
            </div>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              Detected: {pack.detectedBrowser?.channel || "chromium"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Installs an isolated Python environment (<code className="font-mono">{pack.venvDir}</code>) and dedicated browser profile (<code className="font-mono">{pack.profileDir}</code>) with telemetry hard-disabled (<code className="font-mono">ANONYMIZED_TELEMETRY=false</code>).
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleInstallPack}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="size-3.5" />
            <span>Initialize Browser Agent Pack</span>
          </button>
        </div>
      )}

      {/* URL & Control Bar */}
      <div className="flex flex-col gap-2 border-b border-border/60 bg-card/50 p-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider shrink-0",
              session?.status === "running" && "bg-emerald-500/15 text-emerald-400",
              session?.status === "paused" && "bg-amber-500/15 text-amber-400",
              session?.status === "takeover" && "bg-sky-500/15 text-sky-400",
              (!session || session.status === "idle") && "bg-muted text-muted-foreground"
            )}
          >
            {session?.status || "idle"}
          </span>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleNavigate(urlInput)}
            placeholder="https://..."
            className="flex-1 min-w-0 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleNavigate(urlInput)}
            className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
          >
            Go
          </button>
        </div>

        {/* Agent Task Bar + Pause / Take Over / Resume / Stop */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleRunTask()}
              placeholder="Agent goal (e.g. Extract pricing table and follow docs link)..."
              className="flex-1 min-w-0 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60"
            />
            <button
              type="button"
              disabled={busy || !goalInput.trim()}
              onClick={() => void handleRunTask()}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="size-3" />
              <span>Run Task</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {session?.status === "paused" || session?.status === "takeover" ? (
              <button
                type="button"
                onClick={() => void handleControl("resume")}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                <Play className="size-3" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleControl("pause")}
                title="Pause agent step loop"
                className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Pause className="size-3" />
                <span>Pause</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleControl("takeover")}
              title="Switch to interactive browser control to log in or solve a challenge"
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                session?.status === "takeover"
                  ? "border-sky-500/50 bg-sky-500/20 text-sky-300 font-medium"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <Hand className="size-3" />
              <span>Take Over</span>
            </button>
            <button
              type="button"
              onClick={() => void handleControl("stop")}
              title="Stop Browser Agent session"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
            >
              <Square className="size-3" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* First-visit Domain Approval Banner */}
      {pendingDomain && (
        <div className="m-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <ShieldAlert className="size-4 shrink-0" />
            <span>Approve first visit to domain: {pendingDomain}</span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            Browser Agent requires domain permission before navigating to a new host.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleDomainDecision(pendingDomain, "allow_once")}
              className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/30"
            >
              Allow Once
            </button>
            <button
              type="button"
              onClick={() => void handleDomainDecision(pendingDomain, "allow_session")}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/30"
            >
              Allow for Session
            </button>
            <button
              type="button"
              onClick={() => void handleDomainDecision(pendingDomain, "always_allow")}
              className="rounded-lg border border-primary/40 bg-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/30"
            >
              Always Allow
            </button>
            <button
              type="button"
              onClick={() => void handleDomainDecision(pendingDomain, "block")}
              className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/30"
            >
              Block Domain
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Live Screenshot + Step Log */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Live Viewport Snapshot */}
        <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="size-3 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px] text-foreground truncate">
                {session?.title || "Browser Viewport"} — {session?.url || "about:blank"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {session?.elements?.length || 0} interactive elements
            </span>
          </div>
          {session?.screenshot ? (
            <img
              src={session.screenshot}
              alt="Browser Agent Viewport"
              className="w-full h-auto block bg-[#0f0f12]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Globe className="size-7 opacity-40" />
              <span>Enter an allowed URL or run a browser_task goal to start browsing.</span>
            </div>
          )}
        </div>

        {/* Step Log */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agent Step Log ({session?.steps?.length || 0})
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              Telemetry: OFF (&lt;untrusted_web_content&gt; isolated)
            </span>
          </div>

          {!session?.steps || session.steps.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/40 p-3 text-muted-foreground text-[11px]">
              No browser steps recorded in this session yet.
            </div>
          ) : (
            <div className="space-y-1">
              {session.steps.map((s: any, idx: number) => {
                const open = expandedStep === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-card/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedStep(open ? null : idx)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {open ? (
                          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-mono text-[10px] text-primary">#{s.step || idx + 1}</span>
                        <span className="font-mono text-[11px] text-foreground truncate">{s.action}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {s.latencyMs !== undefined ? `${s.latencyMs}ms` : ""}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-border/40 bg-background/60 px-3 py-2 space-y-1 font-mono text-[11px]">
                        <div className="text-muted-foreground">Thought: {s.thought}</div>
                        <div className="text-muted-foreground truncate">URL: {s.url}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
