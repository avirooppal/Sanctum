"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const ChatExplorer: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    deleteChatSession,
    models,
  } = useAppStore();

  return (
    <div className="space-y-3">
      <button
        onClick={createNewChatSession}
        className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>New Chat Thread</span>
      </button>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Recent Sessions
        </span>
        <div className="space-y-1">
          {chatSessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const model = models.find((m) => m.id === session.modelId);

            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "group relative flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer border transition-all text-left",
                  isActive
                    ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate max-w-[170px]">
                    {session.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                    title="Delete Thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span className="truncate max-w-[120px]">{model?.name || "Local Model"}</span>
                  <span>{session.updatedAt}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
