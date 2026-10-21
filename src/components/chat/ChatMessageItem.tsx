"use client";

import React from "react";
import { Bot, User, Sparkles, BrainCircuit, ChevronRight, Gauge } from "lucide-react";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isAssistant = message.role === "assistant";

  const renderContent = (content: string) => {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);

    if (thinkMatch) {
      const thinkText = thinkMatch[1].trim();
      const mainText = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();

      return (
        <div className="space-y-3">
          <details
            className="group rounded-xl bg-zinc-950/60 border border-indigo-500/20 overflow-hidden text-xs"
            open
          >
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

  return (
    <div
      className={cn("flex gap-3 max-w-4xl mx-auto", isAssistant ? "justify-start" : "justify-end")}
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
          renderContent(message.content)
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
};
