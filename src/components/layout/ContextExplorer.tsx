"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { HubExplorer } from "./explorer/HubExplorer";
import { ChatExplorer } from "./explorer/ChatExplorer";
import { ArenaExplorer } from "./explorer/ArenaExplorer";
import { ResearchExplorer } from "./explorer/ResearchExplorer";
import { RagExplorer } from "./explorer/RagExplorer";
import { SystemExplorer } from "./explorer/SystemExplorer";

const MODULE_TITLES: Record<string, string> = {
  hub: "Model Catalog",
  chat: "Local Threads",
  arena: "Arena Configuration",
  research: "Research Dossiers",
  rag: "Knowledge Vault",
  telemetry: "System Devices",
  settings: "Engine Config",
};

export const ContextExplorer: React.FC = () => {
  const { activeModule, isExplorerCollapsed, toggleExplorer } = useAppStore();

  if (isExplorerCollapsed) {
    return (
      <div className="flex flex-col items-center justify-start h-full py-2 bg-surface-raised border-r border-surface-border w-4 shrink-0 transition-all duration-200">
        <button
          onClick={toggleExplorer}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          title="Expand Explorer (Ctrl+B)"
          aria-label="Expand Explorer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-72 h-full bg-surface-raised border-r border-surface-border shrink-0 select-none transition-all duration-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {MODULE_TITLES[activeModule] || "Workspace"}
          </span>
        </div>
        <button
          onClick={toggleExplorer}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Collapse Explorer (Ctrl+B)"
          aria-label="Collapse Explorer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Explorer Dynamic Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeModule === "hub" && <HubExplorer />}
        {activeModule === "chat" && <ChatExplorer />}
        {activeModule === "arena" && <ArenaExplorer />}
        {activeModule === "research" && <ResearchExplorer />}
        {activeModule === "rag" && <RagExplorer />}
        {(activeModule === "telemetry" || activeModule === "settings") && (
          <SystemExplorer module={activeModule} />
        )}
      </div>
    </div>
  );
};
