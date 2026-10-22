"use client";

import React from "react";
import {
  MessageCircle,
  Swords,
  LockKeyhole,
  Bot,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { NavModule } from "@/types";
import { cn } from "@/lib/utils";

interface SanctumShellProps {
  children: React.ReactNode;
}

export const SanctumShell: React.FC<SanctumShellProps> = ({ children }) => {
  const { activeModule, setActiveModule, telemetry } = useAppStore();

  const navItems: { id: NavModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "arena", label: "Arena", icon: Swords },
    { id: "vault", label: "Vault", icon: LockKeyhole },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "research", label: "Research", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const getScreenTitle = (mod: NavModule) => {
    switch (mod) {
      case "chat":
        return "Chat";
      case "arena":
        return "Arena";
      case "vault":
      case "rag":
        return "Vault";
      case "agents":
        return "Agents";
      case "research":
        return "Research";
      case "settings":
      case "hub":
        return "Models";
      default:
        return "Workspace";
    }
  };

  const currentMod = activeModule === "rag" ? "vault" : activeModule === "hub" ? "settings" : activeModule;

  return (
    <div className="bg-background text-foreground flex w-full min-h-screen h-screen overflow-hidden">
      {/* Mascot & Left Navigation Rail */}
      <aside className="bg-sidebar border-r border-border flex px-3 py-4 flex-col shrink-0 w-44 select-none">
        {/* Mascot Logo */}
        <div className="flex pb-8 justify-center items-center">
          <div className="rounded-full bg-background flex justify-center items-center size-10 overflow-hidden border border-border shadow-xs">
            <img
              src="/assets/77a8ae8e-019d-4af5-be16-d21074f8d51e.jpg"
              alt="Sanctum mascot"
              className="size-10 object-cover"
              onError={(e) => {
                // Fallback if path differs
                (e.currentTarget as HTMLImageElement).src = "/mascot.jpg";
              }}
            />
          </div>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main navigation" className="flex flex-col flex-1 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMod === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={cn(
                  "font-medium rounded-md text-sm flex px-3 py-2.5 items-center gap-3 transition-colors text-left",
                  isActive
                    ? "bg-accent text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live System Status Indicator */}
        <div className="flex pt-6 pb-2 justify-center items-center gap-2">
          <span
            aria-label="Engine Online"
            title={telemetry.computeBackend || "Local Engine Online"}
            className="rounded-full bg-primary size-2 animate-pulse"
          />
          <span className="text-[11px] font-mono text-muted-foreground">
            {telemetry.ramUsedGB} GB
          </span>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Clean Header Bar */}
        <header className="bg-background border-b border-border flex px-8 justify-between items-center shrink-0 h-16 select-none">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-foreground text-sm tracking-wide">
              Sanctum
            </span>
            <h1 className="font-medium text-foreground text-lg">
              {getScreenTitle(activeModule)}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Search"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>('input[type="text"]');
                el?.focus();
              }}
              className="rounded-md text-muted-foreground text-sm border border-border flex px-3 items-center gap-2 h-9 hover:bg-accent hover:text-foreground transition-colors"
            >
              <Search className="size-4" />
              <span>Search</span>
              <span className="text-muted-foreground text-xs ml-2 font-mono">⌘K</span>
            </button>
            <div
              aria-label="User profile"
              className="font-medium rounded-full bg-muted text-foreground text-xs flex justify-center items-center size-9 shadow-xs"
            >
              AM
            </div>
          </div>
        </header>

        {/* Primary Screen Canvas */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
