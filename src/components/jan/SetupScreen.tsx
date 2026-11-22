"use client";

import React, { useEffect, useState } from "react";
import { fetchWithApproval } from "@/lib/hostBridge";
import {
  IconMicrophone,
  IconCpu,
  IconWorld,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SttModelSelector } from "@/components/speech/SttModelSelector";
import { OcrModelSelector } from "@/components/ocr/OcrModelSelector";

type Setup = {
  phase: string;
  detail: string;
  busy: boolean;
  percent: number | null;
  model: string;
};

type STTMode = "recommended" | "custom" | "webspeech";
type LLMMode = "local" | "custom";
type BrowserMode = "builtin" | "custom";

interface CapabilityTestState {
  checking: boolean;
  ok: boolean | null;
  message: string;
  latencyMs?: number;
}

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
  const { initModels, setActiveModelId, completeOnboarding } = useAppStore(
    useShallow((s) => ({
      initModels: s.initModels,
      setActiveModelId: s.setActiveModelId,
      completeOnboarding: s.completeOnboarding,
    }))
  );

  // 1. LLM Capability Configuration State
  const [isLlmConfigOpen, setIsLlmConfigOpen] = useState(false);
  const [llmMode, setLlmMode] = useState<LLMMode>("local");
  const [customLlmEndpoint, setCustomLlmEndpoint] = useState("http://127.0.0.1:11434");
  const [customLlmModel, setCustomLlmModel] = useState("qwen3:1.7b");
  const [customLlmApiKey, setCustomLlmApiKey] = useState("");
  const [llmTest, setLlmTest] = useState<CapabilityTestState>({
    checking: false,
    ok: null,
    message: "",
  });

  // 2. STT Capability Configuration State
  const [isSttConfigOpen, setIsSttConfigOpen] = useState(false);
  const [sttMode, setSttMode] = useState<STTMode>("recommended");
  const [selectedSttModel, setSelectedSttModel] = useState<string>("qwen3-asr-0.6b");
  const [customEndpoint, setCustomEndpoint] = useState("http://127.0.0.1:8000");
  const [customModel, setCustomModel] = useState("base");
  const [customSttApiKey, setCustomSttApiKey] = useState("");
  const [sttTest, setSttTest] = useState<CapabilityTestState>({
    checking: false,
    ok: null,
    message: "",
  });
  const [copiedCmd, setCopiedCmd] = useState(false);

  // 3. Browser Agent Capability Configuration State
  const [isBrowserConfigOpen, setIsBrowserConfigOpen] = useState(false);
  const [isOcrConfigOpen, setIsOcrConfigOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<BrowserMode>("builtin");
  const [customBrowserPath, setCustomBrowserPath] = useState("");
  const [browserTest, setBrowserTest] = useState<CapabilityTestState>({
    checking: false,
    ok: true,
    message: "Built-in Browser Agent ready",
  });

  const testCapability = async (target: "llm" | "stt" | "browser", showToast = true) => {
    if (target === "llm") {
      setLlmTest((p) => ({ ...p, checking: true }));
      try {
        const res = await fetch("/api/capabilities/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "llm",
            mode: llmMode,
            endpoint: llmMode === "custom" ? customLlmEndpoint : "http://127.0.0.1:11434",
            model: llmMode === "custom" ? customLlmModel : "qwen3:1.7b",
            apiKey: customLlmApiKey,
          }),
        });
        const data = await res.json();
        setLlmTest({
          checking: false,
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "LLM connected" : "LLM offline"),
          latencyMs: data.latencyMs,
        });
        if (showToast) {
          if (data.ok) toast.success(data.message || "LLM capability verified");
          else toast.error(data.message || "LLM test failed");
        }
      } catch {
        setLlmTest({ checking: false, ok: false, message: "Could not reach LLM endpoint" });
      }
      return;
    }

    if (target === "stt") {
      setSttTest((p) => ({ ...p, checking: true }));
      try {
        const res = await fetch("/api/capabilities/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "stt",
            mode: sttMode,
            endpoint: sttMode === "custom" ? customEndpoint : "http://127.0.0.1:8000",
            model: sttMode === "custom" ? customModel : selectedSttModel,
            apiKey: customSttApiKey,
          }),
        });
        const data = await res.json();
        setSttTest({
          checking: false,
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "STT ready" : "STT not detected"),
          latencyMs: data.latencyMs,
        });
        if (showToast) {
          if (data.ok) toast.success(data.message || "STT capability verified");
          else toast.error(data.message || "STT test failed");
        }
      } catch {
        setSttTest({ checking: false, ok: false, message: "Could not test STT capability" });
      }
      return;
    }

    if (target === "browser") {
      setBrowserTest((p) => ({ ...p, checking: true }));
      try {
        const res = await fetch("/api/capabilities/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "browser",
            mode: browserMode,
            executablePath: browserMode === "custom" ? customBrowserPath : "",
          }),
        });
        const data = await res.json();
        setBrowserTest({
          checking: false,
          ok: Boolean(data.ok),
          message: data.message || "Browser Agent ready",
          latencyMs: data.latencyMs,
        });
        if (showToast) {
          if (data.ok) toast.success(data.message || "Browser Agent verified");
          else toast.error(data.message || "Browser test failed");
        }
      } catch {
        setBrowserTest({ checking: false, ok: false, message: "Browser test failed" });
      }
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
    void testCapability("stt", false);
    void testCapability("browser", false);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  const saveCapabilitySettings = async () => {
    try {
      await fetchWithApproval(
        "/api/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "llm.mode": llmMode,
            "llm.customEndpoint": customLlmEndpoint,
            "llm.customModel": customLlmModel,
            "llm.customApiKey": customLlmApiKey,
            "assistants.sttMode": sttMode,
            "assistants.sttModel": sttMode === "custom" ? customModel : selectedSttModel,
            "assistants.sttEndpoint": sttMode === "custom" ? customEndpoint : "http://127.0.0.1:8000",
            "assistants.sttApiKey": customSttApiKey,
            "browser.mode": browserMode,
            "browser.customExecutablePath": customBrowserPath,
          }),
        },
        "settings_write"
      );
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
    await saveCapabilitySettings();

    // If user configured and verified a custom LLM endpoint, allow direct onboarding completion
    if (llmMode === "custom" && customLlmEndpoint.trim()) {
      try {
        const res = await fetch("/api/capabilities/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "llm",
            mode: "custom",
            endpoint: customLlmEndpoint,
            model: customLlmModel,
            apiKey: customLlmApiKey,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          await initModels();
          if (customLlmModel) setActiveModelId(customLlmModel);
          completeOnboarding();
          onComplete?.("chat");
          return;
        }
      } catch {}
    }

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
    await saveCapabilitySettings();
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
    const cmd = `python core/ai/speech/whisperx_server.py --model ${selectedSttModel} --port 8000`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    toast.success("STT launch command copied to clipboard");
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const ready = setup.phase === "ready";

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6 md:p-8 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 md:p-8 space-y-5 shadow-xl">
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
            Configure your workspace capabilities below — use Sanctum&apos;s built-in local models or
            connect your own custom endpoints for LLM, Speech-to-Text, and Browser Agent, and test
            each capability live.
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
              <span className="font-medium text-foreground">Downloading &amp; Verifying Model</span>
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

        {/* CAPABILITY 1: LLM / AI RUNTIME */}
        <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsLlmConfigOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconCpu size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    LLM / Inference Engine
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium border",
                      llmTest.ok
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {llmTest.ok ? `Verified${llmTest.latencyMs ? ` (${llmTest.latencyMs}ms)` : ""}` : llmMode === "local" ? "Built-in Ollama" : "Custom LLM"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {llmMode === "local"
                    ? "Local Ollama runtime (qwen3:1.7b auto-managed)"
                    : `Custom endpoint: ${customLlmModel} @ ${customLlmEndpoint}`}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {isLlmConfigOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </button>

          {isLlmConfigOpen && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLlmMode("local")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all",
                    llmMode === "local"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Built-in Local Ollama</span>
                    {llmMode === "local" && <IconCircleCheck size={14} className="text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Auto-installs &amp; verifies local Ollama + Qwen3 1.7B.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLlmMode("custom")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all",
                    llmMode === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Custom LLM Choice</span>
                    {llmMode === "custom" && <IconCircleCheck size={14} className="text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Connect your own Ollama, vLLM, LM Studio, or OpenAI URL.
                  </p>
                </button>
              </div>

              {llmMode === "custom" && (
                <div className="p-3 rounded-xl border border-border/70 bg-card space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground">Endpoint URL</label>
                      <input
                        type="text"
                        value={customLlmEndpoint}
                        onChange={(e) => setCustomLlmEndpoint(e.target.value)}
                        placeholder="http://127.0.0.1:11434"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground">Model Name</label>
                      <input
                        type="text"
                        value={customLlmModel}
                        onChange={(e) => setCustomLlmModel(e.target.value)}
                        placeholder="qwen3:1.7b or gpt-4o"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">API Key (Optional)</label>
                    <input
                      type="password"
                      value={customLlmApiKey}
                      onChange={(e) => setCustomLlmApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void testCapability("llm")}
                  disabled={llmTest.checking}
                  className="rounded-lg text-xs h-7 gap-1.5"
                >
                  <IconRefresh size={12} className={cn(llmTest.checking && "animate-spin")} />
                  <span>Test LLM</span>
                </Button>
                <span
                  className={cn(
                    "text-[11px] font-mono truncate max-w-[320px]",
                    llmTest.ok === true
                      ? "text-emerald-400"
                      : llmTest.ok === false
                      ? "text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  {llmTest.message || "Click Test LLM to verify connection"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CAPABILITY 2: SPEECH-TO-TEXT (STT) */}
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
                      sttTest.ok
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {sttTest.ok ? "STT Ready" : "Configurable"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {sttMode === "recommended"
                    ? `Local STT: ${
                        selectedSttModel === "nemotron-3.5-transcribe"
                          ? "NVIDIA Nemotron 3.5 Transcribe (Heavy)"
                          : "Alibaba Qwen3-ASR-0.6B (Light)"
                      }`
                    : sttMode === "custom"
                    ? `Custom STT: ${customModel} @ ${customEndpoint}`
                    : "Windows Offline Speech / Web Speech"}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {isSttConfigOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </button>

          {isSttConfigOpen && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-foreground">Local STT Models</span>
                      {sttMode === "recommended" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-medium">
                      Qwen3 / Nemotron
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                      Download Qwen3-ASR-0.6B or Nemotron 3.5 Transcribe.
                    </p>
                  </div>
                </div>

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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-foreground">Custom STT Choice</span>
                      {sttMode === "custom" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-medium">
                      Custom Endpoint
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                      Connect your own Whisper / OpenAI-compatible STT URL.
                    </p>
                  </div>
                </div>

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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-foreground">
                        Windows Offline Speech
                      </span>
                      {sttMode === "webspeech" && (
                        <IconCircleCheck size={14} className="text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono font-medium">
                      Zero-Download
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                      Use built-in Windows offline speech recognition immediately.
                    </p>
                  </div>
                </div>
              </div>

              {sttMode === "recommended" && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-3">
                  <SttModelSelector
                    compact
                    selectedModelId={selectedSttModel}
                    onSelectModel={setSelectedSttModel}
                  />
                  <div className="relative flex items-center justify-between bg-muted/60 p-2 rounded-lg border border-border font-mono text-[11px]">
                    <span className="text-foreground truncate select-all">
                      python core/ai/speech/whisperx_server.py --model {selectedSttModel} --port 8000
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
                </div>
              )}

              {sttMode === "custom" && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground">
                        Custom STT Server Endpoint
                      </label>
                      <input
                        type="text"
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.target.value)}
                        placeholder="http://127.0.0.1:8000"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground">
                        Model Identifier
                      </label>
                      <input
                        type="text"
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="whisper-large-v3, base, etc."
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">
                      API Key (Optional)
                    </label>
                    <input
                      type="password"
                      value={customSttApiKey}
                      onChange={(e) => setCustomSttApiKey(e.target.value)}
                      placeholder="Optional Bearer token"
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void testCapability("stt")}
                  disabled={sttTest.checking}
                  className="rounded-lg text-xs h-7 gap-1.5"
                >
                  <IconRefresh size={12} className={cn(sttTest.checking && "animate-spin")} />
                  <span>Test STT</span>
                </Button>
                <span
                  className={cn(
                    "text-[11px] font-mono truncate max-w-[320px]",
                    sttTest.ok ? "text-emerald-400" : "text-muted-foreground"
                  )}
                >
                  {sttTest.message || "Click Test STT to verify speech capability"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CAPABILITY 3: DOCUMENT OCR (WINDOWS NATIVE + PADDLEOCR-VL-1.6) */}
        <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsOcrConfigOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconCpu size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Document OCR (Scanned PDFs)
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Built-in + Pro Model
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Windows Offline OCR ready out of the box · Optional PaddleOCR-VL-1.6 (0.9B) download for tables &amp; formulas
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {isOcrConfigOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </button>

          {isOcrConfigOpen && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-3">
              <OcrModelSelector compact />
            </div>
          )}
        </div>

        {/* CAPABILITY 4: BROWSER AGENT (BUILT-IN WEB NAVIGATION) */}
        <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsBrowserConfigOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconWorld size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Browser Agent (Web Navigation)
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium border",
                      browserTest.ok
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {browserTest.ok ? "Built-in Ready" : "Check Path"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {browserMode === "builtin"
                    ? "Built-in workspace browser capability (System Edge/Chrome · Telemetry OFF)"
                    : `Custom browser executable: ${customBrowserPath || "Not set"}`}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {isBrowserConfigOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </button>

          {isBrowserConfigOpen && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBrowserMode("builtin")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all",
                    browserMode === "builtin"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Built-in System Browser
                    </span>
                    {browserMode === "builtin" && (
                      <IconCircleCheck size={14} className="text-primary" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Uses preinstalled Edge/Chrome with isolated profile.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserMode("custom")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all",
                    browserMode === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Custom Browser Binary
                    </span>
                    {browserMode === "custom" && (
                      <IconCircleCheck size={14} className="text-primary" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Provide a custom Chromium/Brave executable path.
                  </p>
                </button>
              </div>

              {browserMode === "custom" && (
                <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                  <label className="text-[11px] font-medium text-foreground">
                    Browser Executable Path
                  </label>
                  <input
                    type="text"
                    value={customBrowserPath}
                    onChange={(e) => setCustomBrowserPath(e.target.value)}
                    placeholder="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void testCapability("browser")}
                  disabled={browserTest.checking}
                  className="rounded-lg text-xs h-7 gap-1.5"
                >
                  <IconRefresh size={12} className={cn(browserTest.checking && "animate-spin")} />
                  <span>Test Browser</span>
                </Button>
                <span
                  className={cn(
                    "text-[11px] font-mono truncate max-w-[320px]",
                    browserTest.ok ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {browserTest.message}
                </span>
              </div>
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
        <div className="space-y-3 pt-1">
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
