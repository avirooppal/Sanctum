"use client";

import React, { useState, useRef } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
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
    setActiveSessionId,
    createNewChatSession,
    models,
    activeModelId,
    setActiveModelId,
    sendMessage,
    enableRagInChat,
    setEnableRagInChat,
  } = useAppStore();

  const [promptInput, setPromptInput] = useState("");
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession =
    chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];
  const activeModel =
    models.find((m) => m.id === (activeModelId || currentSession?.modelId)) ||
    models[0] || {
      name: "Qwen 2.5 7B",
      quantization: "Q4_K_M",
      parameters: "7B",
      config: { contextSize: 8192, gpuLayers: 33, maxGpuLayers: 33 },
    };

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

  return (
    <main className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Session Threads Sub-Sidebar */}
      <section className="bg-muted/30 border-r border-border flex p-4 flex-col shrink-0 w-60 select-none overflow-y-auto">
        <Button
          onClick={createNewChatSession}
          className="mb-6 justify-center gap-2 w-full"
        >
          <Plus className="size-4" />
          New conversation
        </Button>

        <div className="space-y-6">
          <div>
            <p className="font-medium uppercase text-muted-foreground text-xs tracking-wide mb-2 px-2">
              Recent Threads
            </p>
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors truncate block",
                    session.id === activeSessionId
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {session.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Conversation Flow */}
      <section className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-6">
            {/* Greeting & Model Selector */}
            <div className="text-center mb-6">
              <h2 className="font-semibold text-foreground text-2xl tracking-tight">
                Good morning, Alex
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                What would you like to work through?
              </p>
              <div className="flex mt-4 justify-center items-center gap-2">
                <Select
                  value={activeModel.id}
                  onValueChange={(val) => setActiveModelId(val)}
                >
                  <SelectTrigger className="text-xs w-60 h-8">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length > 0 ? (
                      models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          Ollama · {m.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="qwen">Ollama · Qwen 2.5 7B</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <span className="font-medium rounded-md bg-accent text-accent-foreground text-xs flex px-2.5 py-1.5 items-center gap-1.5 shadow-2xs">
                  <span className="rounded-full bg-chart-4 size-1.5" />
                  Local / Offline
                </span>
              </div>
            </div>

            {/* Message Bubble Display */}
            {currentSession && currentSession.messages.length > 0 ? (
              <div className="space-y-4">
                {currentSession.messages.map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  const thinkMatch = msg.content.match(/<think>([\s\S]*?)<\/think>/);
                  const thinkContent = thinkMatch ? thinkMatch[1].trim() : null;
                  const mainContent = msg.content
                    .replace(/<think>[\s\S]*?<\/think>/, "")
                    .trim();

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
                              <div className="flex items-center gap-2 text-primary text-xs animate-pulse">
                                <Sparkles className="size-3.5" />
                                <span>Generating token stream...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reasoning Drawer Pill */}
                      {thinkContent && (
                        <div className="pl-10">
                          <button
                            type="button"
                            onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                            className="text-muted-foreground text-xs flex items-center gap-2 hover:text-foreground transition-colors"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isReasoningOpen && "rotate-90"
                              )}
                            />
                            <span>Reasoned for 4s</span>
                          </button>
                          {isReasoningOpen && (
                            <div className="mt-2 p-3 rounded-md bg-muted/40 border border-border font-mono text-xs text-muted-foreground whitespace-pre-wrap">
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
              /* Default Welcome Assistant Card */
              <div className="space-y-3">
                <div className="shadow-xs rounded-lg bg-card border border-border p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-7">
                      <Bot className="size-4" />
                    </div>
                    <div className="text-card-foreground text-sm leading-6">
                      <p className="mb-2 font-medium">
                        Absolutely. I can help draft a clear product brief.
                      </p>
                      <p className="text-muted-foreground">
                        We can start with the problem, target audience, core
                        value proposition, and the outcomes you want the
                        product to achieve.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                  className="text-muted-foreground text-xs flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform",
                      isReasoningOpen && "rotate-90"
                    )}
                  />
                  <span>Reasoned for 4s</span>
                </button>
                {isReasoningOpen && (
                  <div className="p-3 rounded-md bg-muted/40 border border-border font-mono text-xs text-muted-foreground">
                    Analyzed product specifications, user requirements, and constraints.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clean Input Prompt Dock */}
        <div className="border-t border-border px-8 py-5 bg-background shrink-0">
          <div className="shadow-xs rounded-lg bg-card border border-input flex mx-auto p-3 flex-col gap-3 max-w-2xl focus-within:border-primary transition-colors">
            <input
              placeholder="Ask Sanctum anything…"
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
      <aside className="bg-muted/20 border-l border-border p-5 shrink-0 w-60 select-none">
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
            <div>Engine: Ollama</div>
            <div>Context: {activeModel.config.contextSize} tok</div>
            <div>Layers: {activeModel.config.gpuLayers} / {activeModel.config.maxGpuLayers}</div>
            <div>Quantization: {activeModel.quantization}</div>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs mt-3">Advanced settings hidden</p>
        )}
      </aside>
    </main>
  );
};
