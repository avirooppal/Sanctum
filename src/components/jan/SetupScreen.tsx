"use client";

import React, { useEffect, useState } from "react";
import {
  IconMicrophone,
  IconCpu,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconTerminal2,
  IconLink,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Setup = {
  phase: string;
  detail: string;
  busy: boolean;
  percent: number | null;
  model: string;
};

type STTMode = "recommended" | "custom" | "webspeech";

export const SetupScreen = ({
  onComplete,
}: {
  onComplete?: (destination?: "chat" | "hub") => void;
}) => {
  const [setup, setSetup] = useState<Setup>({
    phase: "idle",
    detail: "",
    busy: false,
    percent: null,
    model: "",
  });
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const { initModels, setActiveModelId, completeOnboarding } = useAppStore();

  // STT Configuration State
  const [sttMode, setSttMode] = useState<STTMode>("recommended");
  const [customEndpoint, setCustomEndpoint] = useState("http://127.0.0.1:8000");
  const [customModel, setCustomModel] = useState("base");
  const [sttStatus, setSttStatus] = useState<{
    online: boolean;
    checking: boolean;
    message?: string;
  }>({
    online: false,
    checking: false,
  });
  const [isSttConfigOpen, setIsSttConfigOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const checkSttEndpoint = async (targetEndpoint?: string) => {
    setSttStatus((prev) => ({ ...prev, checking: true }));
    const ep = targetEndpoint || customEndpoint;
    const testUrl = ep.endsWith("/health") ? ep : `${ep.replace(/\/$/, "")}/health`;

    try {
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setSttStatus({
          online: true,
          checking: false,
          message: "STT service active & ready",
        });
        toast.success("STT server is reachable on port 8000");
        return;
      }
    } catch {
      // direct health check failed, check backend proxy
    }

    try {
      const res = await fetch("/api/audio/whisperx");
      if (res.ok) {
        const data = await res.json();
        setSttStatus({
          online: Boolean(data.online),
          checking: false,
          message: data.online
            ? "WhisperX server detected"
            : "Offline: local server not detected on 127.0.0.1:8000",
        });
      } else {
        setSttStatus({
          online: false,
          checking: false,
          message: "Offline: start local WhisperX server",
        });
      }
    } catch {
      setSttStatus({
        online: false,
        checking: false,
        message: "Offline: local speech service unreachable",
      });
    }
  };

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch("/api/setup", { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error("Cannot reach desktop setup. Restart Sanctum to retry.");
        const value = await response.json();
        if (live) {
          setSetup(value);
          setError("");
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Setup unavailable");
      }
      if (live) timer = setTimeout(poll, 1000);
    };
    void poll();
    void checkSttEndpoint();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  const saveSttSettings = async () => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "assistants.sttMode": sttMode,
          "assistants.sttModel": sttMode === "custom" ? customModel : "whisper-base",
          "assistants.sttEndpoint": sttMode === "custom" ? customEndpoint : "http://127.0.0.1:8000",
        }),
      });
      localStorage.setItem("sanctum.sttMode", sttMode);
      localStorage.setItem(
        "sanctum.sttEndpoint",
        sttMode === "custom" ? customEndpoint : "http://127.0.0.1:8000"
      );
    } catch {
      // non-blocking
    }
  };

  const start = async () => {
    setStarting(true);
    setError("");
    await saveSttSettings();
    try {
      const response = await fetch("/api/setup/start", { method: "POST" });
      if (!response.ok) throw new Error("Could not start setup. Restart Sanctum and retry.");
      setSetup(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    await saveSttSettings();
    await initModels();
    if (!useAppStore.getState().models.some((m) => m.id === setup.model)) {
      setError("The verified model is no longer available. Retry setup.");
      return;
    }
    setActiveModelId(setup.model);
    completeOnboarding();
    onComplete?.("chat");
  };

  const copyLaunchCommand = () => {
    const cmd = "python scripts/whisperx_server.py --model base --port 8000";
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    toast.success("STT launch command copied to clipboard");
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const ready = setup.phase === "ready";

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6 md:p-8 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 md:p-8 space-y-6 shadow-xl">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Sanctum logo"
              width={48}
              height={48}
              className="rounded-xl border border-border/60 shadow-xs object-cover"
            />
            <div>
              <p
                className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider"
                data-testid="setup-step-counter"
              >
                {ready ? "Step 3 of 3" : setup.phase === "idle" ? "Step 1 of 3" : "Step 2 of 3"}
              </p>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {ready
                  ? "Sanctum is Ready"
                  : setup.phase === "idle"
                  ? "Welcome to Sanctum"
                  : "Setting Up Local AI"}
              </h1>
            </div>
          </div>
        </div>

        {/* Phase Context Description */}
        {setup.phase === "idle" ? (
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            Sanctum will initialize your local AI runtime, download and verify a lightweight chat model,
            and configure sovereign speech transcription. All models run completely offline on your device with
            zero cloud egress.
          </p>
        ) : (
          <p role="status" className="text-xs md:text-sm text-muted-foreground">
            {setup.detail}
          </p>
        )}

        {/* Busy Progress Bar */}
        {setup.busy && (
          <div className="space-y-2 p-4 rounded-xl border border-border/70 bg-muted/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Downloading & Verifying Model</span>
              <span className="font-mono text-muted-foreground">
                {setup.percent == null ? "Working…" : `${Math.round(setup.percent)}%`}
              </span>
            </div>
            <progress
              className="w-full h-2 rounded-full overflow-hidden bg-muted accent-primary"
              max={100}
              value={setup.percent ?? undefined}
              aria-label="Setup progress"
            />
            <p className="text-[11px] text-muted-foreground">
              {setup.percent == null
                ? "Allocating weights and configuring inference backend. Keep Sanctum open."
                : `${Math.round(setup.percent)}% of verified weights downloaded.`}
            </p>
          </div>
        )}

        {/* SPEECH-TO-TEXT (STT) CONFIGURATION MODULE */}
        <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSttConfigOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconMicrophone size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Speech-to-Text (Voice Dictation)
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium border",
                      sttStatus.online
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {sttStatus.online ? "STT Online" : "Optional"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {sttMode === "recommended"
                    ? "Recommended: Whisper Base / Tiny (WhisperX, 145 MB offline STT)"
                    : sttMode === "custom"
                    ? `Custom STT: ${customModel} @ ${customEndpoint}`
                    : "Web Speech API (in-browser voice fallback)"}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {isSttConfigOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </button>

          {isSttConfigOpen && (
            <div className="p-4 pt-1 border-t border-border/60 space-y-4">
              {/* STT Option Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Recommended Lightweight STT */}
                <div
                  onClick={() => setSttMode("recommended")}
                  className={cn(
                    "cursor-pointer p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                    sttMode === "recommended"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-foreground">
                        Whisper Base
                      </span>
                      {sttMode === "recommended" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-medium">
                      145 MB · 74M Params
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                      Best open-source lightweight model for fast offline speech transcription.
                    </p>
                  </div>
                </div>

                {/* 2. Custom STT ("Give your own") */}
                <div
                  onClick={() => setSttMode("custom")}
                  className={cn(
                    "cursor-pointer p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                    sttMode === "custom"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-foreground">
                        Give Custom STT
                      </span>
                      {sttMode === "custom" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-medium">
                      Custom Endpoint
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                      Connect your own local or remote Whisper / WhisperX server endpoint.
                    </p>
                  </div>
                </div>

                {/* 3. Web Speech Fallback */}
                <div
                  onClick={() => setSttMode("webspeech")}
                  className={cn(
                    "cursor-pointer p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                    sttMode === "webspeech"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-foreground">
                        Web Speech / Skip
                      </span>
                      {sttMode === "webspeech" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono font-medium">
                      Built-in Fallback
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                      Use browser speech recognition without downloading local speech weights.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode-specific Setup Details */}
              {sttMode === "recommended" && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Local Setup: WhisperX / faster-whisper
                    </span>
                    <button
                      type="button"
                      onClick={() => checkSttEndpoint("http://127.0.0.1:8000")}
                      disabled={sttStatus.checking}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <IconRefresh
                        size={12}
                        className={cn(sttStatus.checking && "animate-spin")}
                      />
                      <span>Test Port 8000</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    To enable 100% private offline speech transcription, install and launch the lightweight
                    Whisper service included in Sanctum:
                  </p>

                  <div className="relative flex items-center justify-between bg-muted/60 p-2 rounded-lg border border-border font-mono text-[11px]">
                    <span className="text-foreground truncate select-all">
                      python scripts/whisperx_server.py --model base --port 8000
                    </span>
                    <button
                      type="button"
                      onClick={copyLaunchCommand}
                      className="ml-2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                      title="Copy command"
                    >
                      {copiedCmd ? (
                        <IconCheck size={13} className="text-emerald-500" />
                      ) : (
                        <IconCopy size={13} />
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Prerequisite: <code className="font-mono text-foreground">pip install whisperx</code> (or <code className="font-mono text-foreground">faster-whisper</code>).
                  </p>
                </div>
              )}

              {sttMode === "custom" && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Custom STT Server Endpoint
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="http://127.0.0.1:8000"
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Model Identifier / Variant
                    </label>
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="base, small, tiny, or custom model name"
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkSttEndpoint(customEndpoint)}
                      disabled={sttStatus.checking}
                      className="rounded-lg text-xs h-7 gap-1"
                    >
                      <IconRefresh
                        size={12}
                        className={cn(sttStatus.checking && "animate-spin")}
                      />
                      <span>Test Endpoint</span>
                    </Button>

                    <span
                      className={cn(
                        "text-[11px] font-mono",
                        sttStatus.online ? "text-emerald-500" : "text-muted-foreground"
                      )}
                    >
                      {sttStatus.message || (sttStatus.online ? "Connected" : "Not verified")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {ready ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground">Verified Model:</span>{" "}
                  <code className="font-mono">{setup.model}</code>
                </div>
                <IconCheck size={16} className="text-emerald-500" />
              </div>
              <Button onClick={finish} className="w-full h-10 rounded-xl font-medium">
                Start Chatting
              </Button>
            </div>
          ) : setup.busy ? (
            <Button
              variant="outline"
              onClick={async () => {
                await fetch("/api/setup/cancel", { method: "POST" });
              }}
              className="w-full h-10 rounded-xl"
            >
              Stop Setup
            </Button>
          ) : (
            <Button
              onClick={start}
              disabled={starting}
              className="w-full h-10 rounded-xl font-medium"
            >
              {starting
                ? "Starting Setup..."
                : setup.phase === "idle"
                ? "Set Up Sanctum"
                : "Retry Setup"}
            </Button>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <button
              type="button"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
              onClick={() =>
                (window as any).chrome?.webview?.postMessage(
                  JSON.stringify({ type: "openLogs" })
                )
              }
            >
              Open Setup Logs
            </button>

            <span className="text-[11px]">Local • Private • Sovereign</span>
          </div>
        </div>
      </div>
    </div>
  );
};
