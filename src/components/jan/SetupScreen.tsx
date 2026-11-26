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
  IconUser,
  IconShieldLock,
  IconTerminal2,
  IconBooks,
  IconBrain,
  IconSparkles,
  IconGauge,
  IconArrowLeft,
  IconArrowRight,
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

const SANCTUM_WALKTHROUGH_FEATURES = [
  {
    id: "local-privacy",
    title: "100% Local & Private",
    description:
      "Runs on-device via Ollama or loopback OpenAI-compatible runtimes with a global Offline mode switch and Network Activity ledger.",
    icon: IconShieldLock,
  },
  {
    id: "coding-agent",
    title: "Coding Agent & Rewind",
    description:
      "Edits files, runs PowerShell with AST guardrails and Job Object limits, and saves shadow-git checkpoints you can rewind anytime.",
    icon: IconTerminal2,
  },
  {
    id: "vault-ocr",
    title: "Document Vault (RAG) & OCR",
    description:
      "Index PDFs, notes, and code locally with versioned vector search, Windows Offline OCR, and optional PaddleOCR-VL.",
    icon: IconBooks,
  },
  {
    id: "voice-stt",
    title: "Local Voice Dictation",
    description:
      "Speak directly into chat using local Qwen3-ASR / WhisperX models or built-in Windows offline speech recognition.",
    icon: IconMicrophone,
  },
  {
    id: "memory-provenance",
    title: "Memory with Provenance",
    description:
      "Remembers your name and preferences locally with source provenance tags, pinning, and prompt-injection protection.",
    icon: IconBrain,
  },
  {
    id: "adaptive-eval",
    title: "Adaptive Tiers & Benchmarks",
    description:
      "Auto-tunes context length and tool budgets for your hardware, plus a built-in 40-task local tool-reliability benchmark.",
    icon: IconGauge,
  },
] as const;

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
  const { initModels, setActiveModelId, completeOnboarding, storedUserName, setUserName } = useAppStore(
    useShallow((s) => ({
      initModels: s.initModels,
      setActiveModelId: s.setActiveModelId,
      completeOnboarding: s.completeOnboarding,
      storedUserName: s.userName,
      setUserName: s.setUserName,
    }))
  );

  // User Profile & Slideshow State
  const [userNameInput, setUserNameInput] = useState<string>(storedUserName || "");
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [skipping, setSkipping] = useState<boolean>(false);
  const TOTAL_SLIDES = 4;

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
    fetch("/api/settings?key=user.name")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const saved = typeof data?.value === "string" ? data.value.trim() : "";
        if (live && saved) {
          setUserNameInput((prev) => (prev.trim() ? prev : saved));
          setUserName(saved);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [setUserName]);

  const saveUserProfileMemory = async (cleanName: string) => {
    if (!cleanName) return;
    const factContent = `User's name is ${cleanName}.`;
    try {
      const listRes = await fetch("/v1/memory");
      if (listRes.ok) {
        const listData = await listRes.json();
        const facts = Array.isArray(listData?.facts) ? listData.facts : [];
        const existing = facts.find(
          (f: { category?: string; content?: string; id?: string }) =>
            f?.category === "profile" &&
            typeof f?.content === "string" &&
            f.content.toLowerCase().startsWith("user's name is ")
        );
        if (existing?.id) {
          if (existing.content !== factContent) {
            await fetch(`/v1/memory/${encodeURIComponent(existing.id)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: factContent, category: "profile", pinned: true }),
            });
          }
          return;
        }
      }
      await fetch("/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: factContent,
          category: "profile",
          provenance: "user",
          pinned: true,
        }),
      });
    } catch {
      // non-blocking
    }
  };

  const saveCapabilitySettings = async () => {
    const cleanName = userNameInput.trim().slice(0, 80);
    setUserName(cleanName);
    try {
      await fetchWithApproval(
        "/api/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "user.name": cleanName,
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
      await saveUserProfileMemory(cleanName);
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
  const displayName = userNameInput.trim();

  // Auto-advance to final Setup/Launch slide when setup is running or ready
  useEffect(() => {
    if (setup.busy || ready) {
      setSlideIndex(TOTAL_SLIDES - 1);
    }
  }, [setup.busy, ready]);

  // Keyboard arrow navigation between slides (ignored while typing in inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Enter" && slideIndex < TOTAL_SLIDES - 1) {
          e.preventDefault();
          setSlideIndex((i) => Math.min(TOTAL_SLIDES - 1, i + 1));
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlideIndex((i) => Math.min(TOTAL_SLIDES - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slideIndex]);

  const handleSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      await saveCapabilitySettings();
      await initModels().catch(() => {});
      if (setup.model && useAppStore.getState().models.some((m) => m.id === setup.model)) {
        setActiveModelId(setup.model);
      }
      completeOnboarding();
      onComplete?.("chat");
    } finally {
      setSkipping(false);
    }
  };

  const SLIDE_LABELS = ["Welcome", "Features", "Capabilities", "Launch"];

  return (
    <div
      className="relative flex flex-col flex-1 h-full w-full overflow-hidden bg-background text-foreground pt-10"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 65% 50% at 50% 0%, hsl(var(--primary) / 0.09), transparent 70%)",
      }}
    >
      {/* Top Slideshow Bar: Step Counter, Progress Pills, Skip */}
      <header className="w-full max-w-4xl mx-auto px-6 sm:px-10 pt-3 pb-2 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Sanctum logo"
            width={28}
            height={28}
            className="rounded-lg border border-white/[0.10] object-cover"
          />
          <span
            className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider"
            data-testid="setup-step-counter"
          >
            Step {slideIndex + 1} of {TOTAL_SLIDES} · {SLIDE_LABELS[slideIndex]}
          </span>
        </div>

        {/* Clickable Slide Indicator Pills */}
        <div className="hidden sm:flex items-center gap-1.5" role="tablist" aria-label="Setup slides">
          {SLIDE_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={slideIndex === idx}
              aria-label={`Go to ${label}`}
              onClick={() => setSlideIndex(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                slideIndex === idx
                  ? "w-7 bg-primary"
                  : idx < slideIndex
                  ? "w-2.5 bg-primary/45 hover:bg-primary/70"
                  : "w-2.5 bg-muted hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleSkip()}
          disabled={skipping}
          data-testid="setup-skip-button"
          className="px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-colors"
        >
          {skipping ? "Skipping…" : "Skip"}
        </button>
      </header>

      {/* Main Centered Slideshow Stage with Side Arrows */}
      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-8 flex items-center justify-center gap-4">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          disabled={slideIndex === 0}
          aria-label="Previous step"
          className={cn(
            "hidden md:flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-card/70 backdrop-blur-xl text-foreground transition-all",
            slideIndex === 0
              ? "opacity-25 cursor-not-allowed"
              : "hover:border-primary/45 hover:bg-card hover:scale-105 active:scale-95 shadow-lg"
          )}
        >
          <IconArrowLeft size={18} />
        </button>

        {/* Slide Card */}
        <div className="w-full max-w-2xl max-h-[calc(100vh-170px)] overflow-y-auto rounded-[24px] border border-white/[0.09] bg-card/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* SLIDE 0: WELCOME & NAME */}
          {slideIndex === 0 && (
            <div className="space-y-6 py-2">
              <div className="flex flex-col items-center text-center space-y-3">
                <img
                  src="/logo.jpg"
                  alt="Sanctum logo"
                  width={64}
                  height={64}
                  className="rounded-2xl border border-white/[0.12] shadow-lg object-cover"
                />
                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {displayName ? `Welcome to Sanctum, ${displayName}` : "Welcome to Sanctum"}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Your private, local-first AI workspace. Everything runs on your machine with full control.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-background/50 p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <IconUser size={16} />
                  </div>
                  <div>
                    <label
                      htmlFor="setup-user-name"
                      className="text-xs font-semibold text-foreground block"
                    >
                      What should Sanctum call you?
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Saved locally to your profile and pinned memory so your assistant remembers you.
                    </p>
                  </div>
                </div>
                <input
                  id="setup-user-name"
                  data-testid="setup-user-name-input"
                  type="text"
                  maxLength={80}
                  value={userNameInput}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  placeholder="Enter your name (e.g. Alex)"
                  autoComplete="name"
                  autoFocus
                  className="w-full rounded-xl border border-border/80 bg-background/90 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {displayName && (
                  <p className="text-[11px] text-emerald-400 font-medium">
                    Sanctum will greet you as {displayName} and include your name in local assistant context.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SLIDE 1: WHAT SANCTUM CAN DO */}
          {slideIndex === 1 && (
            <div className="space-y-5" data-testid="setup-feature-walkthrough">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <IconSparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      What Sanctum Can Do
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Built-in local AI, coding agent, security, and memory capabilities
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium border bg-primary/10 text-primary border-primary/25 shrink-0">
                  {SANCTUM_WALKTHROUGH_FEATURES.length} Built-in
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SANCTUM_WALKTHROUGH_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.id}
                      className="p-3.5 rounded-2xl border border-white/[0.07] bg-background/45 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className="text-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground">
                          {feature.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SLIDE 2: LOCAL CAPABILITIES */}
          {slideIndex === 2 && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Local Capabilities
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pre-configured for zero-setup local use. Click any item to customize or test.
                </p>
              </div>

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
                    Connect your own local Ollama, llama.cpp, or LM Studio loopback URL.
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
                        placeholder="qwen3:1.7b or llama3.2"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">Local Auth Token (Optional)</label>
                    <input
                      type="password"
                      value={customLlmApiKey}
                      onChange={(e) => setCustomLlmApiKey(e.target.value)}
                      placeholder="Optional local server token"
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

            </div>
          )}

          {/* SLIDE 3: SET UP & LAUNCH */}
          {slideIndex === 3 && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {ready
                    ? displayName
                      ? `Sanctum is Ready, ${displayName}`
                      : "Sanctum is Ready"
                    : setup.busy
                    ? "Setting Up Local AI"
                    : "Ready to Launch"}
                </h2>
                <p role="status" className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  {setup.phase === "idle"
                    ? "Sanctum will verify your local Ollama runtime and default model, then open your workspace."
                    : setup.detail}
                </p>
              </div>

              {setup.busy && (
                <div className="space-y-2.5 p-4 rounded-2xl border border-white/[0.08] bg-background/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Downloading &amp; Verifying Model</span>
                    <span className="font-mono text-muted-foreground">
                      {setup.percent == null ? "Working…" : `${Math.round(setup.percent)}%`}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-primary transition-all duration-300",
                        setup.percent == null && "w-1/2 animate-pulse"
                      )}
                      style={
                        setup.percent != null
                          ? { width: `${Math.min(100, Math.max(4, Math.round(setup.percent)))}%` }
                          : undefined
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {setup.percent == null
                      ? "Allocating weights and configuring inference backend. Keep Sanctum open."
                      : `${Math.round(setup.percent)}% of verified weights downloaded.`}
                  </p>
                </div>
              )}

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
                    <Button onClick={finish} className="w-full h-11 rounded-xl font-medium text-sm">
                      Start Chatting
                    </Button>
                  </div>
                ) : setup.busy ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await fetch("/api/setup/cancel", { method: "POST" });
                    }}
                    className="w-full h-11 rounded-xl"
                  >
                    Stop Setup
                  </Button>
                ) : (
                  <Button
                    onClick={start}
                    disabled={starting}
                    className="w-full h-11 rounded-xl font-medium text-sm"
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
          )}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => setSlideIndex((i) => Math.min(TOTAL_SLIDES - 1, i + 1))}
          disabled={slideIndex === TOTAL_SLIDES - 1}
          aria-label="Next step"
          className={cn(
            "hidden md:flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-card/70 backdrop-blur-xl text-foreground transition-all",
            slideIndex === TOTAL_SLIDES - 1
              ? "opacity-25 cursor-not-allowed"
              : "hover:border-primary/45 hover:bg-card hover:scale-105 active:scale-95 shadow-lg"
          )}
        >
          <IconArrowRight size={18} />
        </button>
      </div>

      {/* Bottom Footer Controls */}
      <footer className="w-full max-w-2xl mx-auto px-6 pb-6 pt-2 flex items-center justify-between gap-3 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={slideIndex === 0}
          onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          className="rounded-xl text-xs gap-1.5"
        >
          <IconArrowLeft size={14} />
          <span>Back</span>
        </Button>

        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Use arrow keys or click Next
        </span>

        {slideIndex < TOTAL_SLIDES - 1 ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setSlideIndex((i) => Math.min(TOTAL_SLIDES - 1, i + 1))}
            className="rounded-xl text-xs gap-1.5 px-4"
          >
            <span>Next</span>
            <IconArrowRight size={14} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleSkip()}
            disabled={skipping}
            className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </Button>
        )}
      </footer>
    </div>
  );
};
