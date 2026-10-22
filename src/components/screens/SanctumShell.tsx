"use client";

import React, { useEffect } from "react";
import {
  MessageCircle,
  Swords,
  LockKeyhole,
  Bot,
  Search,
  Settings,
  Sparkles,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { NavModule } from "@/types";
import { cn } from "@/lib/utils";

interface SanctumShellProps {
  children: React.ReactNode;
}

export const SanctumShell: React.FC<SanctumShellProps> = ({ children }) => {
  const {
    activeModule,
    setActiveModule,
    telemetry,
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    deleteChatSession,
    isExplorerCollapsed,
    toggleExplorer,
  } = useAppStore();

  // Keyboard shortcut Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleExplorer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleExplorer]);

  const navItems: {
    id: NavModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
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

  const currentMod =
    activeModule === "rag"
      ? "vault"
      : activeModule === "hub"
      ? "settings"
      : activeModule;

  return (
    <div className="bg-background text-foreground flex w-full min-h-screen h-screen overflow-hidden">
      {/* Collapsible Left Sidebar */}
      <aside
        className={cn(
          "bg-sidebar border-r border-border flex flex-col shrink-0 select-none transition-all duration-200 overflow-hidden",
          isExplorerCollapsed ? "w-16 px-2 py-4" : "w-64 px-3 py-4"
        )}
      >
        {/* Top: Mascot & Collapse Toggle */}
        <div className="flex pb-6 items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-background flex justify-center items-center size-10 overflow-hidden border border-border shadow-xs shrink-0">
              <img
                src="/assets/77a8ae8e-019d-4af5-be16-d21074f8d51e.jpg"
                alt="Sanctum mascot"
                className="size-10 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/mascot.jpg";
                }}
              />
            </div>
            {!isExplorerCollapsed && (
              <span className="font-semibold text-sm tracking-wide text-foreground">
                Sanctum
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleExplorer}
            title={isExplorerCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {isExplorerCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        {/* Navigation Rail & Nested Chat Threads */}
        <nav
          aria-label="Main navigation"
          className="flex flex-col flex-1 gap-1 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMod === item.id;
            const isChatItem = item.id === "chat";

            return (
              <div key={item.id} className="space-y-1">
                {/* Main Nav Button */}
                <button
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  title={item.label}
                  className={cn(
                    "w-full font-medium rounded-md text-sm flex items-center transition-colors text-left",
                    isExplorerCollapsed
                      ? "justify-center p-2.5"
                      : "px-3 py-2.5 gap-3",
                    isActive
                      ? "bg-accent text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!isExplorerCollapsed && <span>{item.label}</span>}
                </button>

                {/* Sub-threads Section (Nested directly below Chat when active) */}
                {isChatItem && isActive && !isExplorerCollapsed && (
                  <div className="pl-3 pr-1 py-1 space-y-1.5 animate-in fade-in-50 duration-150">
                    <button
                      type="button"
                      onClick={createNewChatSession}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-foreground bg-accent/80 hover:bg-accent border border-border/80 rounded-md transition-colors"
                    >
                      <Plus className="size-3.5 text-primary" />
                      <span>New conversation</span>
                    </button>

                    <div className="pt-2">
                      <p className="font-medium uppercase text-muted-foreground text-[10px] tracking-wider px-2 pb-1">
                        Recent Threads
                      </p>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {chatSessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={cn(
                              "group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                              session.id === activeSessionId
                                ? "bg-accent text-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                          >
                            <span className="truncate max-w-[150px]">
                              {session.title || "New Thread"}
                            </span>
                            {chatSessions.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChatSession(session.id);
                                }}
                                title="Delete thread"
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Live System Status & Telemetry at Sidebar Bottom */}
        <div
          className={cn(
            "flex pt-4 pb-1 items-center border-t border-border mt-auto",
            isExplorerCollapsed ? "justify-center" : "justify-between px-2"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              aria-label="Engine Status"
              title={telemetry.computeBackend || "Local Engine Online"}
              className="rounded-full bg-primary size-2 animate-pulse shrink-0"
            />
            {!isExplorerCollapsed && (
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                {telemetry.computeBackend.includes("Active")
                  ? "Ollama Live"
                  : "Local Engine"}
              </span>
            )}
          </div>
          {!isExplorerCollapsed && (
            <span className="text-[11px] font-mono text-muted-foreground">
              {telemetry.ramUsedGB} GB
            </span>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-background border-b border-border flex px-8 justify-between items-center shrink-0 h-16 select-none">
          <div className="flex items-center gap-8">
            <h1 className="font-medium text-foreground text-lg">
              {getScreenTitle(activeModule)}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Search"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[type="text"], input[type="search"]'
                );
                el?.focus();
              }}
              className="rounded-md text-muted-foreground text-sm border border-border flex px-3 items-center gap-2 h-9 hover:bg-accent hover:text-foreground transition-colors"
            >
              <Search className="size-4" />
              <span>Search</span>
              <span className="text-muted-foreground text-xs ml-2 font-mono">
                ⌘K
              </span>
            </button>
            <div
              aria-label="User profile"
              className="font-medium rounded-full bg-muted text-foreground text-xs flex justify-center items-center size-9 shadow-xs"
            >
              AM
            </div>
          </div>
        </header>

        {/* Primary Canvas Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
