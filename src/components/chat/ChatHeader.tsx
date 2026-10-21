"use client";

import React from "react";
import { SlidersHorizontal, Database } from "lucide-react";
import { LocalModel, ChatSession } from "@/types";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  session: ChatSession;
  activeModel: LocalModel;
  enableRagInChat: boolean;
  onToggleRag: () => void;
  onOpenConfig: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  activeModel,
  enableRagInChat,
  onToggleRag,
  onOpenConfig,
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised/40">
      <div>
        <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
          <span>{session.title}</span>
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
          onClick={onToggleRag}
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
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 rounded-lg border border-white/5 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Tune Inference</span>
        </button>
      </div>
    </div>
  );
};
