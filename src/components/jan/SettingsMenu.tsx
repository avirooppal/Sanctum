"use client";

import React from "react";
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
  selectedProviderId?: string;
  onSelectProvider?: (providerId: string) => void;
  onAddProvider?: () => void;
}

const REMOTE_PROVIDER_ITEMS: { id: string; label: string; badgeBg: string; glyph: string }[] = [
  { id: "openai", label: "OpenAI", badgeBg: "bg-emerald-500/20 text-emerald-400", glyph: "◎" },
  { id: "azure", label: "Azure", badgeBg: "bg-sky-500/20 text-sky-400", glyph: "▲" },
  { id: "anthropic", label: "Anthropic", badgeBg: "bg-amber-500/20 text-amber-400", glyph: "A" },
  { id: "openrouter", label: "OpenRouter", badgeBg: "bg-indigo-500/20 text-indigo-400", glyph: "⇄" },
  { id: "mistral", label: "Mistral", badgeBg: "bg-orange-500/20 text-orange-400", glyph: "M" },
  { id: "groq", label: "Groq", badgeBg: "bg-rose-500/20 text-rose-400", glyph: "G" },
  { id: "xai", label: "xAI", badgeBg: "bg-zinc-500/25 text-zinc-300", glyph: "𝕏" },
  { id: "gemini", label: "Gemini", badgeBg: "bg-blue-500/20 text-blue-400", glyph: "✦" },
  { id: "minimax", label: "MiniMax", badgeBg: "bg-pink-500/20 text-pink-400", glyph: "m" },
  { id: "huggingface", label: "Hugging Face", badgeBg: "bg-yellow-500/20 text-yellow-400", glyph: "🤗" },
];

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  activeSection,
  onSelectSection,
  selectedProviderId = "llamacpp",
  onSelectProvider,
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

  const handleChooseProvider = (providerId: string) => {
    if (onSelectProvider) onSelectProvider(providerId);
    onSelectSection("providers");
  };

  return (
    <aside className="w-60 border-r border-border/60 bg-sidebar flex flex-col p-3 space-y-4 select-none shrink-0 overflow-y-auto">
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
                "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors text-left",
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
      <div className="pt-1">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations (Experimental)
        </span>
        <div className="mt-1 space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectSection("mcp-servers")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors text-left",
              activeSection === "mcp-servers"
                ? "bg-accent text-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <IconCircles size={16} className={cn(activeSection === "mcp-servers" ? "text-primary" : "text-muted-foreground")} />
            <span>MCP Servers</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSection("claude-code")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors text-left",
              activeSection === "claude-code"
                ? "bg-accent text-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <IconFolderCode size={16} className={cn(activeSection === "claude-code" ? "text-primary" : "text-muted-foreground")} />
            <span>Claude Code</span>
          </button>
        </div>
      </div>

      {/* Model Providers Header */}
      <div className="pt-1">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Model Providers
          </span>
          <button
            type="button"
            onClick={() => {
              onSelectSection("providers");
              if (onAddProvider) onAddProvider();
            }}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Add Custom Provider"
          >
            <IconPlus size={14} />
          </button>
        </div>

        {/* Local Llama.cpp */}
        <div className="mt-1 space-y-0.5">
          <button
            type="button"
            onClick={() => handleChooseProvider("llamacpp")}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
              activeSection === "providers" && selectedProviderId === "llamacpp"
                ? "bg-accent text-foreground font-semibold"
                : "text-foreground hover:bg-muted/50"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex size-4 items-center justify-center rounded bg-amber-500/20 text-[10px] font-bold text-amber-400">
                🦙
              </span>
              <span>Llama.cpp</span>
            </span>
            <span className="size-2 rounded-full bg-emerald-500" title="Active engine" />
          </button>
        </div>

        {/* Remote Providers */}
        <div className="mt-1 space-y-0.5">
          {REMOTE_PROVIDER_ITEMS.map((p) => {
            const isSelected = activeSection === "providers" && selectedProviderId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleChooseProvider(p.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                  isSelected
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-4 items-center justify-center rounded text-[10px] font-bold shrink-0",
                      p.badgeBg
                    )}
                  >
                    {p.glyph}
                  </span>
                  <span>{p.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
