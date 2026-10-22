"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  Mic,
  Paperclip,
  Sparkles,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const ChatScreen: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    models,
    activeModelId,
    setActiveModelId,
    sendMessage,
    enableRagInChat,
    setEnableRagInChat,
  } = useAppStore();

  const [promptInput, setPromptInput] = useState("");
  const [openReasoningMap, setOpenReasoningMap] = useState<Record<string, boolean>>({});
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession =
    chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];

  const activeModel =
    models.find((m) => m.id === (activeModelId || currentSession?.modelId)) ||
    models[0] || {
      id: "local",
      name: "Qwen 2.5 7B",
      quantization: "Q4_K_M",
      parameters: "7B",
      config: { contextSize: 8192, gpuLayers: 33, maxGpuLayers: 33 },
    };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const handleSend = () => {
    if (!promptInput.trim()) return;
    sendMessage(promptInput);
    setPromptInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleReasoning = (msgId: string) => {
    setOpenReasoningMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <main className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Primary Conversation Column */}
      <section className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-6">
            {/* Header: Greeting & Real Model Selector */}
            <div className="text-center mb-6">
              <h2 className="font-semibold text-foreground text-2xl tracking-tight">
                Welcome to Sanctum
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                What would you like to work through?
              </p>
              <div className="flex mt-4 justify-center items-center gap-2">
                <Select
                  value={activeModel.id}
                  onValueChange={(val) => setActiveModelId(val)}
                >
                  <SelectTrigger className="text-xs w-64 h-8">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length > 0 ? (
                      models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          Ollama · {m.name} ({m.quantization})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="local">Ollama · Local Model</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <span className="font-medium rounded-md bg-accent text-accent-foreground text-xs flex px-2.5 py-1.5 items-center gap-1.5 shadow-2xs">
                  <span className="rounded-full bg-chart-4 size-1.5" />
                  Local / Offline
                </span>
              </div>
            </div>

            {/* Conversation Flow */}
            {currentSession && currentSession.messages && currentSession.messages.length > 0 ? (
              <div className="space-y-4">
                {currentSession.messages.map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  const thinkMatch = msg.content.match(/<think>([\s\S]*?)<\/think>/);
                  const thinkContent = thinkMatch ? thinkMatch[1].trim() : null;
                  const mainContent = msg.content
                    .replace(/<think>[\s\S]*?<\/think>/, "")
                    .trim();
                  const isReasoningOpen = Boolean(openReasoningMap[msg.id]);

                  return (
                    <div key={msg.id} className="space-y-2">
                      <div className="shadow-xs rounded-lg bg-card border border-border p-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "rounded-md flex justify-center items-center shrink-0 size-7",
                              isAssistant
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground font-semibold text-xs"
                            )}
                          >
                            {isAssistant ? <Bot className="size-4" /> : "You"}
                          </div>
                          <div className="text-card-foreground text-sm leading-6 flex-1">
                            {mainContent ? (
                              <div className="whitespace-pre-wrap">{mainContent}</div>
                            ) : (
                              <div className="flex items-center gap-2 text-primary text-xs animate-pulse font-mono">
                                <Sparkles className="size-3.5" />
                                <span>Generating token stream...</span>
                              </div>
                            )}

                            {/* Measured Hardware Metrics */}
                            {isAssistant && msg.metrics && msg.metrics.totalTokens > 0 && (
                              <div className="flex items-center gap-4 pt-3 mt-3 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                                <span className="flex items-center gap-1 text-primary font-medium">
                                  <Gauge className="size-3" />
                                  <span>{msg.metrics.tps} tok/s</span>
                                </span>
                                <span>TTFT: {msg.metrics.ttftMs}ms</span>
                                <span>Tokens: {msg.metrics.totalTokens}</span>
                                <span>VRAM: {msg.metrics.vramUsedGB} GB</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Real Collapsible Reasoning Step */}
                      {thinkContent && (
                        <div className="pl-10">
                          <button
                            type="button"
                            onClick={() => toggleReasoning(msg.id)}
                            className="text-muted-foreground text-xs flex items-center gap-2 hover:text-foreground transition-colors"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isReasoningOpen && "rotate-90"
                              )}
                            />
                            <span>Reasoned for {Math.max(1, Math.round(thinkContent.length / 40))}s</span>
                          </button>
                          {isReasoningOpen && (
                            <div className="mt-2 p-3 rounded-md bg-muted/40 border border-border font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {thinkContent}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Clean Real Empty State (No Synthetic Dummy Messages) */
              <div className="text-center py-12 space-y-3">
                <div className="rounded-full bg-accent/40 size-12 mx-auto flex items-center justify-center border border-border">
                  <Bot className="size-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  Session Ready
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Type a prompt below to interact with your local private model. All inferences run on-device.
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Prompt Dock */}
        <div className="border-t border-border px-8 py-5 bg-background shrink-0">
          <div className="shadow-xs rounded-lg bg-card border border-input flex mx-auto p-3 flex-col gap-3 max-w-2xl focus-within:border-primary transition-colors">
            <input
              placeholder={`Ask Sanctum anything with ${activeModel.name}…`}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-foreground text-sm outline-none px-2 py-1 w-full placeholder:text-muted-foreground"
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <input ref={fileInputRef} type="file" className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                  className="rounded-md text-muted-foreground flex justify-center items-center size-8 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Use microphone"
                  className="rounded-md text-muted-foreground flex justify-center items-center size-8 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Mic className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-muted-foreground text-xs flex items-center gap-2 cursor-pointer select-none">
                  <span>Use My Documents</span>
                  <Switch
                    checked={enableRagInChat}
                    onCheckedChange={(checked) => setEnableRagInChat(checked)}
                  />
                </label>
                <Button
                  size="icon"
                  disabled={!promptInput.trim()}
                  onClick={handleSend}
                  aria-label="Send message"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-center text-muted-foreground text-xs pt-3">
            {activeModel.name} · Local · Ready
          </p>
        </div>
      </section>

      {/* Subtle Right Sidebar: Model Details (Progressive Disclosure) */}
      <aside className="bg-muted/20 border-l border-border p-5 shrink-0 w-60 select-none hidden md:block">
        <button
          type="button"
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="text-left flex justify-between items-center w-full"
        >
          <span className="font-medium text-foreground text-sm">Model details</span>
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", isDetailsOpen && "rotate-180")}
          />
        </button>

        {isDetailsOpen ? (
          <div className="mt-4 space-y-3 text-xs font-mono text-muted-foreground">
            <div>Model: {activeModel.name}</div>
            <div>Engine: Ollama (localhost:11434)</div>
            <div>Context: {activeModel.config?.contextSize?.toLocaleString() || "8,192"} tok</div>
            <div>Offload: {activeModel.config?.gpuLayers || 33} layers</div>
            <div>Quantization: {activeModel.quantization}</div>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs mt-3">Advanced settings hidden</p>
        )}
      </aside>
    </main>
  );
};
