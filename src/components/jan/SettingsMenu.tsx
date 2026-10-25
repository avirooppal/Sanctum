"use client";

import React, { useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconPalette,
  IconFeather,
  IconPaperclip,
  IconTopologyStar3,
  IconLock,
  IconCpu,
  IconWorld,
  IconWorldSearch,
  IconCommand,
  IconFolderCode,
  IconCircles,
  IconPlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "general"
  | "appearance"
  | "assistants"
  | "attachments"
  | "local-api-server"
  | "https-proxy"
  | "web-search"
  | "shortcuts"
  | "hardware"
  | "privacy"
  | "mcp-servers"
  | "claude-code"
  | "providers";

interface SettingsMenuProps {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
  onAddProvider?: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  activeSection,
  onSelectSection,
  onAddProvider,
}) => {
  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <IconAdjustmentsHorizontal size={16} /> },
    { id: "appearance", label: "Appearance", icon: <IconPalette size={16} /> },
    { id: "assistants", label: "Assistants", icon: <IconFeather size={16} /> },
    { id: "attachments", label: "Attachments", icon: <IconPaperclip size={16} /> },
    { id: "local-api-server", label: "Local API Server", icon: <IconTopologyStar3 size={16} /> },
    { id: "https-proxy", label: "HTTPS Proxy", icon: <IconWorld size={16} /> },
    { id: "web-search", label: "Web Search", icon: <IconWorldSearch size={16} /> },
    { id: "shortcuts", label: "Shortcuts", icon: <IconCommand size={16} /> },
    { id: "hardware", label: "Hardware", icon: <IconCpu size={16} /> },
    { id: "privacy", label: "Privacy", icon: <IconLock size={16} /> },
  ];

  return (
    <aside className="w-64 border-r border-border/60 bg-sidebar flex flex-col p-3 space-y-4 select-none shrink-0 overflow-y-auto">
      <div className="px-2 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </h2>
      </div>

      <nav className="space-y-0.5">
        {sections.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                isActive
                  ? "bg-accent text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className={cn(isActive ? "text-primary" : "text-muted-foreground")}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Experimental Integrations */}
      <div className="pt-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations (Experimental)
        </span>
        <div className="mt-1 space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectSection("mcp-servers")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
              activeSection === "mcp-servers"
                ? "bg-accent text-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <IconCircles size={16} />
            <span>MCP Servers</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSection("claude-code")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
              activeSection === "claude-code"
                ? "bg-accent text-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <IconFolderCode size={16} />
            <span>Claude Code</span>
          </button>
        </div>
      </div>

      {/* Model Providers Header matching 9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png */}
      <div className="pt-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Model Providers
          </span>
          {onAddProvider && (
            <button
              type="button"
              onClick={onAddProvider}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Add Custom Provider"
            >
              <IconPlus size={14} />
            </button>
          )}
        </div>

        {/* Local Llama.cpp */}
        <div className="mt-1 space-y-0.5">
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground/80">Local</div>
          <button
            type="button"
            onClick={() => onSelectSection("providers")}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors text-left"
          >
            <span>Llama.cpp</span>
            <span className="size-2 rounded-full bg-emerald-500" title="Active engine" />
          </button>
        </div>

        {/* Remote Providers matching screenshot */}
        <div className="mt-2 space-y-0.5">
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground/80">Remote</div>
          {["OpenAI", "Azure", "Anthropic", "OpenRouter", "Mistral", "Groq", "xAI", "Gemini", "MiniMax", "Hugging Face"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSelectSection("providers")}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-left"
            >
              <span>{p}</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">BYOK</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
