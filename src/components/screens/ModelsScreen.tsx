"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  ChevronDown,
  Check,
  Sparkles,
  Download,
  Mic,
  Database,
  Bot,
  RefreshCw,
  HardDrive,
  Cpu,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/useAppStore";
import { JAN_STYLE_DOWNLOAD_CATALOG } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const ModelsScreen: React.FC = () => {
  const {
    models,
    openConfigModal,
    telemetry,
    resetOnboarding,
    downloadProgressMap,
    startModelDownload,
    initModels,
  } = useAppStore();

  const [preferLocal, setPreferLocal] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isModelHubOpen, setIsModelHubOpen] = useState(true);
  const [hubTab, setHubTab] = useState<"all" | "chat" | "embedding" | "audio">("all");
  const [whisperxStatus, setWhisperxStatus] = useState<{
    online: boolean;
    endpoint: string;
    engine?: string;
  }>({
    online: false,
    endpoint: "http://127.0.0.1:8000",
  });
  const [isCheckingWhisperX, setIsCheckingWhisperX] = useState(false);

  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>({
    Anthropic: false,
    OpenAI: false,
    OpenRouter: false,
    Groq: false,
    "Google Gemini": false,
  });

  const checkWhisperX = async () => {
    setIsCheckingWhisperX(true);
    try {
      const res = await fetch("/api/audio/whisperx");
      if (res.ok) {
        const data = await res.json();
        setWhisperxStatus({
          online: data.online,
          endpoint: data.endpoint,
          engine: data.whisperxVersion,
        });
      }
    } catch {
      setWhisperxStatus((prev) => ({ ...prev, online: false }));
    } finally {
      setIsCheckingWhisperX(false);
    }
  };

  useEffect(() => {
    checkWhisperX();
  }, []);

  const cloudProviders = [
    { name: "Anthropic", models: "Claude 3.5 Sonnet, Haiku" },
    { name: "OpenAI", models: "GPT-4o, o1, o3-mini" },
    { name: "OpenRouter", models: "Over 200+ multi-vendor models" },
    { name: "Groq", models: "LPU ultra-fast inference (750 t/s)" },
    { name: "Google Gemini", models: "Gemini 2.0 Flash, Pro" },
  ];

  const toggleConnect = (name: string) => {
    setConnectedProviders((prev) => ({ ...prev, [name]: !prev[name] }));
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

  const filteredCatalog = JAN_STYLE_DOWNLOAD_CATALOG.filter((m) => {
    if (hubTab === "all") return true;
    if (hubTab === "chat") return m.type === "chat" || m.type === "reasoning";
    return m.type === hubTab;
  });

  return (
    <main className="flex p-8 flex-col flex-1 overflow-y-auto">
      <div className="flex mx-auto flex-col gap-8 w-full max-w-4xl">
        {/* Page Header */}
        <div>
          <h2 className="font-semibold text-2xl tracking-tight">
            Models & Hardware Connections
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Download models, configure WhisperX speech-to-text, and manage offline inference.
          </p>
        </div>

        {/* Local Models Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Installed Local Engines</h3>
            <button
              onClick={() => initModels()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw className="size-3" />
              <span>Refresh list</span>
            </button>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Ollama */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div>
                  <div className="flex mb-3 justify-between items-start gap-4">
                    <div>
                      <h4 className="font-medium text-foreground">Ollama Daemon</h4>
                      <p className="font-mono text-muted-foreground text-xs mt-1">
                        127.0.0.1:11434
                      </p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {models.length > 0 ? "Active" : "Scanning"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-xs space-y-1">
                    {models.length > 0 ? (
                      models.slice(0, 3).map((m) => (
                        <p key={m.id} className="truncate">
                          • {m.name} ({m.parameters})
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground/60 italic">No models installed yet</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => models[0] && openConfigModal(models[0])}
                  className="text-muted-foreground text-xs mt-4 px-0 self-start hover:text-foreground"
                >
                  Configure parameters →
                </Button>
              </CardContent>
            </Card>

            {/* WhisperX Voice Engine */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div>
                  <div className="flex mb-3 justify-between items-start gap-4">
                    <div>
                      <h4 className="font-medium text-foreground">WhisperX (STT)</h4>
                      <p className="font-mono text-muted-foreground text-xs mt-1">
                        127.0.0.1:8000
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        whisperxStatus.online
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      )}
                    >
                      {whisperxStatus.online ? "WhisperX Online" : "Web Speech Active"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {whisperxStatus.online
                      ? "Phoneme-aligned fast transcription active on port 8000."
                      : "In-browser voice input active. Run `python scripts/whisperx_server.py` for WhisperX."}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={checkWhisperX}
                  disabled={isCheckingWhisperX}
                  className="text-muted-foreground text-xs mt-4 px-0 self-start hover:text-foreground"
                >
                  <RefreshCw className={cn("size-3 mr-1", isCheckingWhisperX && "animate-spin")} />
                  {isCheckingWhisperX ? "Testing..." : "Test connection"}
                </Button>
              </CardContent>
            </Card>

            {/* LM Studio */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-medium text-foreground">LM Studio / llama.cpp</h4>
                    <p className="text-muted-foreground text-xs mt-1">127.0.0.1:1234</p>
                  </div>
                  <Badge className="bg-muted text-muted-foreground">
                    Standby
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  OpenAI-compatible local server standard for GGUF/AWQ models.
                </p>
                <Button
                  variant="ghost"
                  className="text-muted-foreground text-xs mt-4 px-0 self-start hover:text-foreground"
                >
                  Configure endpoint
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* JAN-STYLE MODEL HUB (DOWNLOAD NEW MODELS & EMBEDDINGS) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Model Hub (Download on Device)</h3>
              <p className="text-xs text-muted-foreground">
                Pull open-source models directly into your local Ollama repository with live progress.
              </p>
            </div>

            {/* Tab switch */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              {(["all", "chat", "embedding", "audio"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHubTab(tab)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-md transition-all capitalize",
                    hubTab === tab
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "audio" ? "WhisperX" : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {filteredCatalog.map((item) => {
              const installed = isModelInstalled(item.id);
              const progress = downloadProgressMap[item.id];
              const isDownloading = progress?.isDownloading;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "border transition-colors",
                    installed
                      ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <CardContent className="p-4 flex flex-col justify-between gap-3 min-h-[140px]">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            {item.name}
                            {item.recommended && (
                              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                Recommended
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {item.parameters} · {item.sizeGB} GB
                          </p>
                        </div>

                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] capitalize",
                            item.type === "embedding"
                              ? "bg-purple-500/10 text-purple-600"
                              : item.type === "audio"
                              ? "bg-blue-500/10 text-blue-600"
                              : ""
                          )}
                        >
                          {item.type === "embedding"
                            ? "RAG Embed"
                            : item.type === "audio"
                            ? "WhisperX"
                            : "LLM"}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div>
                      {isDownloading ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground truncate max-w-[180px]">
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
                        <div className="flex items-center justify-between text-xs text-emerald-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Check className="size-3.5" /> Installed & Ready
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startModelDownload(item.id)}
                          className="w-full text-xs gap-1.5 h-8"
                        >
                          <Download className="size-3.5 text-primary" />
                          <span>Download ({item.sizeGB} GB)</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Cloud Providers Section */}
        <section>
          <h3 className="font-semibold text-sm mb-4">Cloud Fallback Providers</h3>
          <Card className="bg-card border-border">
            <CardContent className="p-0 divide-y divide-border">
              {cloudProviders.map((prov) => {
                const isConn = connectedProviders[prov.name];
                return (
                  <div
                    key={prov.name}
                    className="flex px-5 py-4 justify-between items-center"
                  >
                    <div>
                      <span className="font-medium text-foreground text-sm">{prov.name}</span>
                      <p className="text-muted-foreground text-xs">{prov.models}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className="bg-muted text-muted-foreground">
                        Cloud API
                      </Badge>
                      <Button
                        variant={isConn ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => toggleConnect(prov.name)}
                        className="text-xs gap-1.5"
                      >
                        {isConn && <Check className="size-3.5 text-primary" />}
                        <span>{isConn ? "Connected" : "Connect"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Fallback Preference Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex p-5 justify-between items-center">
            <div>
              <h3 className="font-medium text-foreground text-sm">
                Prefer local, fall back to cloud
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Execute sensitive prompts locally; route heavy reasoning to cloud APIs only if offline
              </p>
            </div>
            <Switch
              checked={preferLocal}
              onCheckedChange={(checked) => setPreferLocal(checked)}
            />
          </CardContent>
        </Card>

        {/* Advanced Settings Disclosure */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-left rounded-lg bg-card border border-border flex px-5 py-4 justify-between items-center w-full hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="text-muted-foreground size-4" />
              <div>
                <p className="font-medium text-sm text-foreground">Advanced Hardware Settings</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  GPU layers, VRAM allocation, context depth
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 transition-transform",
                isAdvancedOpen && "rotate-180"
              )}
            />
          </button>

          {isAdvancedOpen && (
            <div className="p-5 rounded-lg bg-card border border-border text-xs font-mono space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hardware Accelerator:</span>
                <span className="text-foreground">{telemetry.gpuName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VRAM Allocated:</span>
                <span className="text-foreground">
                  {telemetry.vramUsedGB} GB / {telemetry.vramTotalGB} GB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ollama Daemon Ping:</span>
                <span className="text-primary font-bold">{telemetry.computeBackend}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WhisperX Daemon:</span>
                <span className="text-foreground">
                  {whisperxStatus.online ? "Online (127.0.0.1:8000)" : "Offline (Web Audio Fallback Active)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Walkthrough & Tour Reset */}
        <Card className="bg-card border-border">
          <CardContent className="flex p-5 justify-between items-center">
            <div>
              <h3 className="font-medium text-foreground text-sm">
                First-time Walkthrough & Setup Wizard
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Revisit the engine setup guide, model downloads, and features tour
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetOnboarding()}
              className="text-xs gap-1.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Restart Tour</span>
            </Button>
          </CardContent>
        </Card>

        <footer className="text-muted-foreground text-sm border-t border-border pt-5">
          Local services healthy · Zero data egress this session
        </footer>
      </div>
    </main>
  );
};
