"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, ChevronRight, Mic, Paperclip, SlidersHorizontal, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

const splitThinking = (content: string) => {
  const match = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  return {
    thinking: match ? match[1].trim() : "",
    answer: content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim(),
  };
};

const MessageRow: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [showThinking, setShowThinking] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  const { thinking, answer } = splitThinking(msg.content);

  return (
    <div className="flex gap-3">
      <img src="/mascot.jpg" alt="" className="size-7 rounded-full object-cover bg-white shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        {thinking && (
          <div>
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={cn("size-3.5 transition-transform", showThinking && "rotate-90")} />
              {answer ? "Show reasoning" : "Thinking…"}
            </button>
            {showThinking && (
              <div className="mt-2 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {thinking}
              </div>
            )}
          </div>
        )}

        {answer ? (
          <div className="text-sm leading-7 whitespace-pre-wrap">{answer}</div>
        ) : (
          !thinking && <div className="text-sm text-muted-foreground animate-pulse">…</div>
        )}

        {msg.metrics && msg.metrics.totalTokens > 0 && (
          <div className="text-[11px] font-mono text-muted-foreground/70">
            {msg.metrics.tps} tok/s · {msg.metrics.totalTokens} tokens · {msg.metrics.ttftMs}ms to first token
          </div>
        )}
      </div>
    </div>
  );
};

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
    documents,
  } = useAppStore();

  const [prompt, setPrompt] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const session = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];
  const model = models.find((m) => m.id === (activeModelId || session?.modelId)) || models[0];
  const messages = session?.messages ?? [];
  const isStreaming = messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].metrics?.totalTokens;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow the composer
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  const send = () => {
    if (!prompt.trim() || !model) return;
    sendMessage(prompt.trim());
    setPrompt("");
  };

  return (
    <main className="relative flex flex-1 min-h-0 w-full overflow-hidden">
      <section className="flex flex-col flex-1 min-w-0">
        {/* Compact toolbar */}
        <div className="flex items-center justify-between gap-3 px-6 h-12 shrink-0">
          {models.length > 0 ? (
            <Select className="w-auto" value={model?.id} onValueChange={setActiveModelId}>
              <SelectTrigger className="h-8 w-auto max-w-[280px] gap-2 border-0 shadow-none px-2 text-sm font-medium hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-72">
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{`${m.name}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground px-2">No model available</span>
          )}

          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-label="Model details"
            aria-pressed={detailsOpen}
            className={cn(
              "p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              detailsOpen && "bg-accent text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-6 py-6 space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-[12vh] gap-4">
                <img src="/mascot.jpg" alt="" className="size-16 rounded-full object-cover bg-white" />
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">What would you like to work through?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {model ? `Running ${model.name} on this device.` : "Start Ollama to begin chatting."}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageRow key={m.id} msg={m} />)
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="px-6 pb-5 pt-2 shrink-0">
          <div className="mx-auto max-w-2xl rounded-2xl border border-input bg-card focus-within:border-muted-foreground/50 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={model ? "Message Sanctum…" : "Waiting for a local model…"}
              disabled={!model}
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Attach file"
                  title="Attach file"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Voice input"
                  title="Voice input"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Mic className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEnableRagInChat(!enableRagInChat)}
                  aria-pressed={enableRagInChat}
                  disabled={documents.length === 0}
                  title={documents.length === 0 ? "Add documents in Vault first" : "Ground answers in your documents"}
                  className={cn(
                    "ml-1 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs border transition-colors disabled:opacity-40 disabled:pointer-events-none",
                    enableRagInChat
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="size-3.5" />
                  My documents
                </button>
              </div>
              <Button size="icon" className="size-8 rounded-full" disabled={!prompt.trim() || !model || isStreaming} onClick={send} aria-label="Send">
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* On-demand details slide-over */}
      {detailsOpen && model && (
        <aside className="w-72 shrink-0 border-l border-border bg-background p-5 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Model details</h3>
            <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close" className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ["Name", model.name],
              ["Parameters", model.parameters],
              ["Quantization", model.quantization],
              ["Size on disk", `${model.fileSizeGB} GB`],
              ["Context window", `${model.config.contextSize.toLocaleString()} tokens`],
              ["Engine", "Ollama · localhost:11434"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </main>
  );
};
