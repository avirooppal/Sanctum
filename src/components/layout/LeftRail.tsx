"use client";

import React from "react";
import {
  Cpu,
  MessageSquare,
  Swords,
  SearchCode,
  Database,
  Activity,
  ShieldCheck,
  Layers,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { NavModule } from "@/types";
import { cn } from "@/lib/utils";

interface NavItem {
  id: NavModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "hub", label: "Model Hub", icon: Layers },
  { id: "chat", label: "Local Chat", icon: MessageSquare },
  { id: "arena", label: "Model Arena", icon: Swords, badge: "Multi" },
  { id: "research", label: "Deep Research", icon: SearchCode, badge: "Agent" },
  { id: "rag", label: "Knowledge Vault", icon: Database },
  { id: "telemetry", label: "Hardware & Perf", icon: Activity },
  { id: "settings", label: "Engine Settings", icon: Settings },
];

export const LeftRail: React.FC = () => {
  const { activeModule, setActiveModule, telemetry, isExplorerCollapsed, toggleExplorer } =
    useAppStore();

  return (
    <aside
      className="flex flex-col items-center justify-between w-16 h-full py-3 bg-surface-base border-r border-surface-border z-30 select-none shrink-0"
      aria-label="Global Primary Navigation"
    >
      {/* Top Branding / Logo */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={toggleExplorer}
          title={isExplorerCollapsed ? "Expand Context Explorer (Ctrl+B)" : "Collapse Context Explorer (Ctrl+B)"}
          className="relative group flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 via-zinc-800 to-zinc-900 border border-indigo-500/30 hover:border-indigo-400/60 shadow-glow transition-all duration-200"
        >
          <div className="w-4 h-4 rounded-full bg-indigo-500/30 border border-indigo-400 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          </div>
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        <div className="w-8 h-[1px] bg-white/10" />

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-2" role="tablist">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveModule(item.id)}
                className={cn(
                  "relative group flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150",
                  isActive
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-glow"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent"
                )}
                title={item.label}
              >
                {/* Active Indicator Pip */}
                {isActive && (
                  <div className="absolute left-0 w-1 h-5 bg-indigo-500 rounded-r-full -translate-x-3" />
                )}

                <Icon className="w-5 h-5 transition-transform group-hover:scale-105" />

                {/* Badge if present */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.2 text-[9px] font-mono font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}

                {/* Floating Tooltip */}
                <div className="absolute left-16 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900/95 border border-white/10 rounded-md shadow-glass whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Privacy Status Pill */}
      <div className="flex flex-col items-center gap-3">
        <div
          title="Privacy Shield: 100% Offline Local Model Inference (Air-Gapped)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <ShieldCheck className="w-5 h-5" />
        </div>

        <div className="text-[10px] font-mono text-zinc-500 text-center tracking-tighter">
          v1.4-loc
        </div>
      </div>
    </aside>
  );
};
