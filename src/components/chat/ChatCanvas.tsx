"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Zap,
  Gauge,
  Clock,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  BrainCircuit,
  SlidersHorizontal,
  Mic,
  Image as ImageIcon,
  Database,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { VisionInspector } from "@/components/chat/VisionInspector";

export const ChatCanvas: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    models,
    sendMessage,
    regenerateLastMessage,
    openConfigModal,
    enableRagInChat,
    setEnableRagInChat,
    attachedImage,
    setAttachedImage,
  } = useAppStore();

  const [inputPrompt, setInputPrompt] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];
  const activeModel = models.find((m) => m.id === currentSession?.modelId) || models[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const handleSend = () => {
    if (!inputPrompt.trim() && !attachedImage) return;
    const text = inputPrompt.trim() || "Analyze this attached image.";
    sendMessage(text);
    setInputPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setAttachedImage({
          src,
          name: file.name,
          width: img.width,
          height: img.height,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Helper to parse `<think>` tags
  const renderMessageContent = (content: string) => {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);

    if (thinkMatch) {
      const thinkText = thinkMatch[1].trim();
      const mainText = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();

      return (
        <div className="space-y-3">
          <details className="group rounded-xl bg-zinc-950/60 border border-indigo-500/20 overflow-hidden text-xs" open>
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer font-mono text-[11px] text-indigo-400 hover:bg-indigo-500/5 select-none transition-colors">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Chain of Thought Reasoning ({thinkText.split("\n").length} steps)</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto group-open:rotate-90 transition-transform" />
            </summary>
            <div className="p-3 border-t border-indigo-500/10 font-mono text-[11px] text-zinc-400 bg-zinc-950/40 whitespace-pre-wrap leading-relaxed">
              {thinkText}
            </div>
          </details>

          <div className="text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap font-sans">
            {mainText}
          </div>
        </div>
      );
    }

    return (
      <div className="text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap font-sans">
        {content}
      </div>
    );
  };

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-base text-zinc-500 text-xs">
        Select or create a conversation thread to begin.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
            <span>{currentSession.title}</span>
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 mt-0.5">
            <span>Engine: {activeModel.name}</span>
            <span>•</span>
            <span className="text-indigo-400">{activeModel.quantization}</span>
            <span>•</span>
            <span>Ctx: {activeModel.config.contextSize.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* RAG Context Toggle */}
          <button
            onClick={() => setEnableRagInChat(!enableRagInChat)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",
              enableRagInChat
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                : "bg-zinc-800 text-zinc-400 border-white/5 hover:text-zinc-200"
            )}
            title="Inject relevant chunks from Local Knowledge Base"
          >
            <Database className="w-3.5 h-3.5" />
            <span>RAG Context {enableRagInChat ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={() => openConfigModal(activeModel)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 rounded-lg border border-white/5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Tune Inference</span>
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {currentSession.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-glow">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Local Hardware Inference Ready</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Zero network egress. Weights are resident in local VRAM with full AVX/CUDA acceleration.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              {[
                "Write an AVX-512 vector kernel in Rust",
                "Explain quantum error correction surface codes",
                "Optimize memory layout for zero-copy IPC",
                "Benchmark GGUF Q4_K_M vs Q8_0 throughput",
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputPrompt(suggestion)}
                  className="p-2.5 text-left text-xs bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 rounded-xl text-zinc-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          currentSession.messages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 max-w-4xl mx-auto",
                  isAssistant ? "justify-start" : "justify-end"
                )}
              >
                {isAssistant && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 shadow-glow">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={cn(
                    "flex flex-col space-y-2 max-w-[85%] rounded-2xl p-4 shadow-glass transition-all",
                    isAssistant
                      ? "bg-zinc-900/90 border border-white/5 text-zinc-100"
                      : "bg-indigo-600 text-white rounded-br-sm"
                  )}
                >
                  {message.content ? (
                    renderMessageContent(message.content)
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 animate-pulse">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing token stream...</span>
                    </div>
                  )}

                  {isAssistant && message.metrics && message.metrics.totalTokens > 0 && (
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/5 text-[10px] font-mono text-zinc-500">
                      <div className="flex items-center gap-1 text-indigo-400 font-semibold">
                        <Gauge className="w-3 h-3" />
                        <span>{message.metrics.tps} tok/s</span>
                      </div>
                      <div>TTFT: {message.metrics.ttftMs}ms</div>
                      <div>Total: {message.metrics.totalTokens} tok</div>
                      <div>VRAM: {message.metrics.vramUsedGB} GB</div>
                    </div>
                  )}
                </div>

                {!isAssistant && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Recorder Overlay */}
      {isVoiceOpen && (
        <div className="px-4 pb-2 max-w-4xl mx-auto w-full">
          <VoiceRecorder
            onClose={() => setIsVoiceOpen(false)}
            onTranscriptionComplete={(text) => {
              setInputPrompt(text);
              setIsVoiceOpen(false);
            }}
          />
        </div>
      )}

      {/* Input Prompt Dock */}
      <div className="p-4 border-t border-surface-border bg-surface-raised/60">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Attached Multimodal Image Pill */}
          {attachedImage && (
            <VisionInspector
              imageSrc={attachedImage.src}
              imageName={attachedImage.name}
              imageDimensions={{ width: attachedImage.width, height: attachedImage.height }}
              onRemove={() => setAttachedImage(null)}
            />
          )}

          <div className="relative flex items-end bg-zinc-950 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors shadow-subtle">
            <textarea
              rows={2}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Send message to ${activeModel.name} (Enter to send, Shift+Enter for newline)...`}
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 resize-none px-3 py-1 focus:outline-none max-h-32"
            />
            <div className="flex items-center gap-1 pb-1 pr-1">
              {/* Multimodal Image Picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Attach Image for Computer Vision OCR"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Voice Microphone Recorder */}
              <button
                onClick={() => setIsVoiceOpen(!isVoiceOpen)}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  isVoiceOpen
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
                title="Speak via Local Whisper Voice Recognition"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!inputPrompt.trim() && !attachedImage}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-colors"
                title="Transmit prompt to local model"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-2">
            <span>
              {enableRagInChat
                ? "RAG Active: Automatically retrieving local vector chunks"
                : "Standard Prompt Mode"}
            </span>
            <span>Air-Gapped: Private Local Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};
