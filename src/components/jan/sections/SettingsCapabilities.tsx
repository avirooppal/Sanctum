"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Cpu,
  Mic,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithApproval } from "@/lib/hostBridge";
import { SttModelSelector } from "@/components/speech/SttModelSelector";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type STTMode = "recommended" | "custom" | "webspeech";
type LLMMode = "local" | "custom";
type BrowserMode = "builtin" | "custom";

export const SettingsCapabilities: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. LLM Capability
  const [llmMode, setLlmMode] = useState<LLMMode>("local");
  const [llmEndpoint, setLlmEndpoint] = useState("http://127.0.0.1:11434");
  const [llmModel, setLlmModel] = useState("qwen3:1.7b");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmTestMsg, setLlmTestMsg] = useState<string | null>(null);
  const [llmTestOk, setLlmTestOk] = useState<boolean | null>(null);

  // 2. STT Capability
  const [sttMode, setSttMode] = useState<STTMode>("recommended");
  const [sttModel, setSttModel] = useState("qwen3-asr-0.6b");
  const [sttEndpoint, setSttEndpoint] = useState("http://127.0.0.1:8000");
  const [sttApiKey, setSttApiKey] = useState("");
  const [sttTestMsg, setSttTestMsg] = useState<string | null>(null);
  const [sttTestOk, setSttTestOk] = useState<boolean | null>(null);

  // 3. Browser Capability
  const [browserMode, setBrowserMode] = useState<BrowserMode>("builtin");
  const [customBrowserPath, setCustomBrowserPath] = useState("");
  const [browserTestMsg, setBrowserTestMsg] = useState<string | null>(null);
  const [browserTestOk, setBrowserTestOk] = useState<boolean | null>(true);

  // Domain & Port policy
  const [newDomain, setNewDomain] = useState("");
  const [newPerm, setNewPerm] = useState<"always_allow" | "allow_session" | "block">("always_allow");
  const [portInput, setPortInput] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/browser/status"),
        fetch("/api/settings"),
      ]);
      if (bRes.ok) {
        setStatus(await bRes.json());
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        const s = sData?.settings || {};
        if (s["llm.mode"]) setLlmMode(s["llm.mode"]);
        if (s["llm.customEndpoint"]) setLlmEndpoint(s["llm.customEndpoint"]);
        if (s["llm.customModel"]) setLlmModel(s["llm.customModel"]);
        if (s["llm.customApiKey"]) setLlmApiKey(s["llm.customApiKey"]);
        if (s["assistants.sttMode"]) setSttMode(s["assistants.sttMode"]);
        if (s["assistants.sttModel"]) setSttModel(s["assistants.sttModel"]);
        if (s["assistants.sttEndpoint"]) setSttEndpoint(s["assistants.sttEndpoint"]);
        if (s["assistants.sttApiKey"]) setSttApiKey(s["assistants.sttApiKey"]);
        if (s["browser.mode"]) setBrowserMode(s["browser.mode"]);
        if (s["browser.customExecutablePath"]) setCustomBrowserPath(s["browser.customExecutablePath"]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetchWithApproval(
        "/api/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "llm.mode": llmMode,
            "llm.customEndpoint": llmEndpoint,
            "llm.customModel": llmModel,
            "llm.customApiKey": llmApiKey,
            "assistants.sttMode": sttMode,
            "assistants.sttModel": sttModel,
            "assistants.sttEndpoint": sttEndpoint,
            "assistants.sttApiKey": sttApiKey,
            "browser.mode": browserMode,
            "browser.customExecutablePath": customBrowserPath,
          }),
        },
        "settings_write"
      );
      if (res.ok) {
        localStorage.setItem("sanctum.sttMode", sttMode);
        localStorage.setItem("sanctum.sttEndpoint", sttEndpoint);
        toast.success("Capability configurations saved.");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save capability settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestCapability = async (cap: "llm" | "stt" | "browser") => {
    setBusy(true);
    try {
      const payload =
        cap === "llm"
          ? {
              capability: "llm",
              mode: llmMode,
              endpoint: llmMode === "custom" ? llmEndpoint : "http://127.0.0.1:11434",
              model: llmModel,
              apiKey: llmApiKey,
            }
          : cap === "stt"
          ? {
              capability: "stt",
              mode: sttMode,
              endpoint: sttMode === "custom" ? sttEndpoint : "http://127.0.0.1:8000",
              model: sttModel,
              apiKey: sttApiKey,
            }
          : {
              capability: "browser",
              mode: browserMode,
              executablePath: browserMode === "custom" ? customBrowserPath : "",
            };

      const res = await fetch("/api/capabilities/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Boolean(data.ok);
      const msg = data.message || (ok ? "Verified" : "Verification failed");

      if (cap === "llm") {
        setLlmTestOk(ok);
        setLlmTestMsg(msg);
      } else if (cap === "stt") {
        setSttTestOk(ok);
        setSttTestMsg(msg);
      } else {
        setBrowserTestOk(ok);
        setBrowserTestMsg(msg);
      }

      if (ok) toast.success(msg);
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleClearBrowserProfile = async () => {
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/browser/pack",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear_profile" }),
        },
        "browser_pack"
      );
      if (res.ok) {
        setStatus(await res.json());
        toast.success("Isolated browser profile session cleared.");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Workspace Capabilities
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure built-in or custom endpoints for LLM inference, Speech-to-Text, and Browser Agent, and test each capability live.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSaveAll}
          disabled={saving}
          className="rounded-xl text-xs flex items-center gap-1.5"
        >
          <Save className="size-3.5" />
          <span>Save Changes</span>
        </Button>
      </div>

      {/* 1. LLM / Inference Engine Capability */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          1. LLM / Inference Capability
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Language Model Runtime
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleTestCapability("llm")}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
              <span>Test LLM</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setLlmMode("local")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                llmMode === "local"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Built-in Local Ollama</span>
                {llmMode === "local" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Uses local Ollama daemon on 127.0.0.1:11434.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLlmMode("custom")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                llmMode === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Custom LLM Choice</span>
                {llmMode === "custom" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Provide your own OpenAI / vLLM / LM Studio / Ollama endpoint.
              </p>
            </button>
          </div>

          {llmMode === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Endpoint URL</span>
                <input
                  type="text"
                  value={llmEndpoint}
                  onChange={(e) => setLlmEndpoint(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Model Name</span>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="qwen3:1.7b"
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">API Key (Optional)</span>
                <input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
            </div>
          )}

          {llmTestMsg && (
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-mono",
                llmTestOk
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {llmTestMsg}
            </div>
          )}
        </div>
      </section>

      {/* 2. Speech-to-Text (STT) Capability */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          2. Speech-to-Text (Voice Dictation) Capability
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Voice Dictation &amp; Audio Transcription
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleTestCapability("stt")}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
              <span>Test STT</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setSttMode("recommended")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                sttMode === "recommended"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Local STT Models</span>
                {sttMode === "recommended" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Qwen3-ASR-0.6B (Light) or Nemotron 3.5 (Heavy).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSttMode("webspeech")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                sttMode === "webspeech"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Windows Offline Speech</span>
                {sttMode === "webspeech" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Built-in zero-download Windows speech recognizer.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSttMode("custom")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                sttMode === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Custom STT Choice</span>
                {sttMode === "custom" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Connect your own Whisper / OpenAI STT server.
              </p>
            </button>
          </div>

          {sttMode === "recommended" && (
            <div className="pt-2 border-t border-border/50">
              <SttModelSelector
                selectedModelId={sttModel}
                onSelectModel={(id) => setSttModel(id)}
              />
            </div>
          )}

          {sttMode === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Custom STT URL</span>
                <input
                  type="text"
                  value={sttEndpoint}
                  onChange={(e) => setSttEndpoint(e.target.value)}
                  placeholder="http://127.0.0.1:8000"
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Model Name</span>
                <input
                  type="text"
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  placeholder="whisper-large-v3"
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">API Key (Optional)</span>
                <input
                  type="password"
                  value={sttApiKey}
                  onChange={(e) => setSttApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
            </div>
          )}

          {sttTestMsg && (
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-mono",
                sttTestOk
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {sttTestMsg}
            </div>
          )}
        </div>
      </section>

      {/* 3. Browser Agent Capability (Built-in Workspace Feature) */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          3. Browser Agent (Web Navigation Capability)
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Web Browser Agent
                </span>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                  Built-in Capability · MIT
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Allows the AI workspace and user to browse the internet, extract DOM content, and interact with pages in an isolated profile with telemetry hard-disabled (<code className="font-mono">ANONYMIZED_TELEMETRY=false</code>).
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleTestCapability("browser")}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
              <span>Test Browser</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setBrowserMode("builtin")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                browserMode === "builtin"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  Built-in System Browser ({pack?.detectedBrowser?.channel || "msedge"})
                </span>
                {browserMode === "builtin" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {pack?.detectedBrowser?.executablePath || "Uses system Microsoft Edge / Chrome"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setBrowserMode("custom")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                browserMode === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-background/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Custom Browser Choice</span>
                {browserMode === "custom" && <CheckCircle2 className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Specify a custom Chromium / Brave / Edge executable path.
              </p>
            </button>
          </div>

          {browserMode === "custom" && (
            <div className="space-y-1 pt-2 border-t border-border/50">
              <span className="text-[11px] font-medium text-foreground">
                Custom Browser Executable Path
              </span>
              <input
                type="text"
                value={customBrowserPath}
                onChange={(e) => setCustomBrowserPath(e.target.value)}
                placeholder="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
              />
            </div>
          )}

          {browserTestMsg && (
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-mono",
                browserTestOk
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {browserTestMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/50 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Active Engine
              </span>
              <div className="font-mono text-foreground font-medium">
                {browserMode === "custom" && customBrowserPath
                  ? "custom"
                  : pack?.detectedBrowser?.channel || "msedge"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {browserMode === "custom" && customBrowserPath
                  ? customBrowserPath
                  : pack?.detectedBrowser?.executablePath || "System Edge / Chrome"}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Isolated Session Profile
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-emerald-400 text-[11px]">Dedicated · Zero Telemetry</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleClearBrowserProfile()}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Clear Session
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground truncate" title={pack?.profileDir}>
                {pack?.profileDir || "%APPDATA%\\Sanctum\\browser-profile"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Domain Allowlist Policy */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Browser Domain Policy &amp; Localhost Opt-In
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
