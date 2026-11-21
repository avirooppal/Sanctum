"use client";

import React from "react";
import {
  IconAdjustmentsHorizontal,
  IconPalette,
  IconCpu,
  IconWorld,
  IconCommand,
  IconCircles,
  IconCode,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "general"
  | "capabilities"
  | "appearance"
  | "shortcuts"
  | "monitor"
  | "logs"
  | "mcp-servers";

interface SettingsMenuProps {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <IconAdjustmentsHorizontal size={16} /> },
    { id: "capabilities", label: "Capabilities", icon: <IconWorld size={16} /> },
    { id: "appearance", label: "Appearance", icon: <IconPalette size={16} /> },
    { id: "shortcuts", label: "Shortcuts", icon: <IconCommand size={16} /> },
    { id: "monitor", label: "System monitor", icon: <IconCpu size={16} /> },
    { id: "logs", label: "Logs", icon: <IconCode size={16} /> },
  ];

  return (
    <aside className="w-60 border-r border-border/60 bg-sidebar/80 backdrop-blur-md flex flex-col p-3 space-y-4 select-none shrink-0 overflow-y-auto">
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

      {/* Integrations & MCP Harness */}
      <div className="pt-1">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
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
            <IconCircles
              size={16}
              className={cn(activeSection === "mcp-servers" ? "text-primary" : "text-muted-foreground")}
            />
            <span>MCP Servers</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
