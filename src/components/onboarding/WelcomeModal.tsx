"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Cpu,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Bot,
  Swords,
  Database,
  Lock,
  X,
  Download,
  Mic,
  Loader2,
  HardDrive,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { JAN_STYLE_DOWNLOAD_CATALOG, CuratedModel } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface WelcomeModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ forceOpen = false, onClose }) => {
  const {
    hasCompletedOnboarding,
    completeOnboarding,
    models,
    telemetry,
    initModels,
    downloadProgressMap,
    startModelDownload,
  } = useAppStore();

  const [step, setStep] = useState<number>(1);
  const [isPinging, setIsPinging] = useState(false);
  const [downloadTab, setDownloadTab] = useState<"all" | "chat" | "embedding" | "audio">("all");
  const totalSteps = 5;

  const isOpen = forceOpen || !hasCompletedOnboarding;

  const handleFinish = () => {
    completeOnboarding();
    if (onClose) onClose();
  };

  const handlePingOllama = async () => {
    setIsPinging(true);
    await initModels();
    setTimeout(() => setIsPinging(false), 500);
  };

  const isModelInstalled = (modelId: string) => {
    const cleanId = modelId.split(":")[0];
    return models.some(
      (m) =>
        m.id.toLowerCase() === modelId.toLowerCase() ||
        m.name.toLowerCase().includes(cleanId.toLowerCase()) ||
        (m.name.includes("qwen") && modelId.includes("qwen"))
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape" && forceOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, forceOpen, onClose]);

  if (!isOpen) return null;

  const filteredCatalog = JAN_STYLE_DOWNLOAD_CATALOG.filter((m) => {
    if (downloadTab === "all") return true;
    if (downloadTab === "chat") return m.type === "chat" || m.type === "reasoning";
    return m.type === downloadTab;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-full overflow-hidden border border-border shadow-xs">
              <Image
                src="/mascot.jpg"
                alt="Sanctum Mascot"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Sanctum Setup & Model Hub
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
              Step {step} of {totalSteps}
            </span>
          </div>

          {forceOpen && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Wizard Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1">
          {/* STEP 1: Welcome & Zero Egress */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center space-y-6 py-4">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-border/80 shadow-md">
                <Image
                  src="/mascot.jpg"
                  alt="Sanctum"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="space-y-2 max-w-md">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Welcome to Sanctum
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The local-first AI workspace built for uncompromising privacy, zero data egress, and multi-model control on your own hardware.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left pt-2">
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 flex flex-col gap-1.5">
                  <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Lock className="size-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">100% Zero Egress</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Prompts, files, and vectors never leave your device unless explicitly routed.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 flex flex-col gap-1.5">
                  <div className="size-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Cpu className="size-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">Native Hardware</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Direct integration with Ollama, LM Studio, and llama.cpp with real VRAM telemetry.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 flex flex-col gap-1.5">
                  <div className="size-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <ShieldCheck className="size-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">Persistent State</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Local storage keeps all threads, documents, and settings intact across refreshes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Engine Diagnostics */}
          {step === 2 && (
            <div className="space-y-6 py-2">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  Engine & Hardware Diagnostics
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sanctum automatically attaches to your active Ollama daemon at <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">http://127.0.0.1:11434</code>.
                </p>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "size-3 rounded-full",
                    models.length > 0 ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-amber-500 ring-4 ring-amber-500/20"
                  )} />
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {models.length > 0
                        ? `Ollama Connected · ${models.length} model${models.length === 1 ? "" : "s"} detected`
                        : "Checking Ollama on 127.0.0.1:11434..."}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Backend: {telemetry.computeBackend} · VRAM: {telemetry.vramUsedGB} GB / {telemetry.vramTotalGB} GB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePingOllama}
                  disabled={isPinging}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", isPinging && "animate-spin")} />
                  <span>{isPinging ? "Scanning..." : "Re-scan"}</span>
                </button>
              </div>

              {/* Detected Models List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected Local Models ({models.length})
                </span>
                {models.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {models.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-lg border border-border bg-card flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground">{m.parameters} · {m.quantization || "Local"}</p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold shrink-0">
                          READY
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center space-y-1.5">
                    <p className="text-xs font-medium text-foreground">
                      No models found or Ollama is starting up
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Ollama is installed. You can download models right now in the next step!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: JAN-STYLE MODEL & EMBEDDING DOWNLOAD */}
          {step === 3 && (
            <div className="space-y-5 py-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Download Models & Embeddings
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Just like Jan, download local chat, embedding (for RAG), and speech models directly into Ollama.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 self-start">
                  {(["all", "chat", "embedding", "audio"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDownloadTab(tab)}
                      className={cn(
                        "text-[11px] font-medium px-2.5 py-1 rounded-md transition-all capitalize",
                        downloadTab === tab
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab === "audio" ? "WhisperX" : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Models Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredCatalog.map((item) => {
                  const installed = isModelInstalled(item.id);
                  const progress = downloadProgressMap[item.id];
                  const isDownloading = progress?.isDownloading;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3.5 rounded-xl border bg-card flex flex-col justify-between gap-3 transition-colors",
                        installed ? "border-emerald-500/30 bg-emerald-500/[0.02]" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              {item.name}
                              {item.recommended && (
                                <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                  Rec
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {item.parameters} · {item.sizeGB} GB
                            </p>
                          </div>

                          <span className={cn(
                            "text-[9px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0",
                            item.type === "embedding"
                              ? "bg-purple-500/10 text-purple-600"
                              : item.type === "audio"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {item.type === "embedding" ? "RAG Embed" : item.type === "audio" ? "WhisperX" : "LLM"}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      {/* Download Progress Bar / Button */}
                      <div>
                        {isDownloading ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground truncate max-w-[160px]">
                                {progress.status}
                              </span>
                              <span className="font-mono font-medium text-primary">
                                {progress.percent}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${progress.percent}%` }}
                              />
                            </div>
                          </div>
                        ) : installed ? (
                          <div className="flex items-center justify-between text-[11px] text-emerald-600 font-medium pt-1">
                            <span className="flex items-center gap-1">
                              <Check className="size-3.5" /> Installed
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">Ready</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startModelDownload(item.id)}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                          >
                            <Download className="size-3.5 text-primary" />
                            <span>Download ({item.sizeGB} GB)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
                <HardDrive className="size-4 shrink-0 text-primary" />
                <span>
                  Embedding models like <code className="text-foreground font-mono">nomic-embed-text</code> power fast local vector chunking for your Document Vault.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: Feature Tour */}
          {step === 4 && (
            <div className="space-y-5 py-2">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  Core Capabilities
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sanctum gives you a complete studio for local generative AI without complexity.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-border bg-card flex items-start gap-3.5">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Collapsible Reasoning & Chat</h4>
                    <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                      Stream local token generation with expandable Chain-of-Thought reasoning blocks. Adjust temperature, top-p, and context depth on the fly.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card flex items-start gap-3.5">
                  <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Mic className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Voice Input with WhisperX</h4>
                    <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                      Fast local speech-to-text powered by WhisperX and Web Audio. Transcribe voice prompts directly into the composer with zero cloud egress.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card flex items-start gap-3.5">
                  <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Private Document Vault (RAG)</h4>
                    <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                      Index PDFs, text files, and code repositories directly in memory using local embedding models like <code className="font-mono text-foreground">nomic-embed-text</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Ready */}
          {step === 5 && (
            <div className="flex flex-col items-center text-center space-y-6 py-4">
              <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Sparkles className="size-8" />
              </div>

              <div className="space-y-2 max-w-md">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  You're Ready to Build
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All local threads, indexed documents, and configurations are securely preserved on your machine.
                </p>
              </div>

              <div className="w-full max-w-sm rounded-xl border border-border bg-muted/20 p-4 text-left space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="size-4 text-emerald-500 shrink-0" />
                  <span>Working file upload & in-chat document indexing</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="size-4 text-emerald-500 shrink-0" />
                  <span>Voice input with WhisperX integration</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="size-4 text-emerald-500 shrink-0" />
                  <span>Real hardware telemetry & zero fake synthetic metrics</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i}`}
                className={cn(
                  "size-2 rounded-full transition-all duration-200",
                  step === i ? "w-6 bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </button>
            )}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
              >
                <Check className="size-3.5" />
                <span>Launch Sanctum</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
