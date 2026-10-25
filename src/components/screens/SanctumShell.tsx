"use client";

import React, { useEffect } from "react";
import {
  MessageCircle,
  Swords,
  LockKeyhole,
  Bot,
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

const NAV_ITEMS: { id: NavModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "arena", label: "Arena", icon: Swords },
  { id: "vault", label: "Vault", icon: LockKeyhole },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "research", label: "Research", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Legacy module ids map onto the six visible sections */
const normalize = (mod: NavModule): NavModule =>
  mod === "rag" ? "vault" : mod === "hub" || mod === "telemetry" ? "settings" : mod;

export const SanctumShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeModule,
    setActiveModule,
    daemons,
    models,
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    deleteChatSession,
    isExplorerCollapsed: collapsed,
    toggleExplorer,
  } = useAppStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleExplorer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleExplorer]);

  const current = normalize(activeModule);
  const title = current === "settings" ? "Models & Settings" : NAV_ITEMS.find((n) => n.id === current)?.label;
  const ollama = daemons.find((d) => d.type === "ollama");
  const online = Boolean(ollama?.online);

  return (
    <div className="bg-background text-foreground flex w-full h-screen overflow-hidden">
      <aside
        className={cn(
          "bg-sidebar border-r border-border flex flex-col shrink-0 select-none transition-[width] duration-200",
          collapsed ? "w-14 px-2" : "w-60 px-3"
        )}
      >
        {/* Brand + collapse */}
        <div className={cn("flex items-center h-14", collapsed ? "justify-center" : "justify-between px-1")}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <img src="/mascot.jpg" alt="" width={28} height={28} style={{ width: "28px", height: "28px", maxWidth: "28px", maxHeight: "28px" }} className="size-7 w-7 h-7 rounded-full object-cover bg-white" />
              <span className="font-semibold text-sm">Sanctum</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleExplorer}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex flex-col flex-1 gap-0.5 overflow-y-auto pt-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = current === id;
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => setActiveModule(id)}
                  title={collapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "w-full rounded-md text-sm flex items-center transition-colors",
                    collapsed ? "justify-center h-9" : "gap-3 px-2.5 h-9",
                    active
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </button>

                {/* Threads nest directly under Chat */}
                {id === "chat" && active && !collapsed && (
                  <div className="ml-4 pl-3 border-l border-border my-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={createNewChatSession}
                      className="w-full flex items-center gap-2 px-2 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-md transition-colors"
                    >
                      <Plus className="size-3.5" />
                      New chat
                    </button>
                    <div className="max-h-64 overflow-y-auto space-y-0.5">
                      {chatSessions.map((s) => (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveSessionId(s.id)}
                          onKeyDown={(e) => e.key === "Enter" && setActiveSessionId(s.id)}
                          className={cn(
                            "group flex items-center justify-between gap-1 px-2 h-8 rounded-md text-xs cursor-pointer transition-colors",
                            s.id === activeSessionId
                              ? "bg-accent/70 text-foreground"
                              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                          )}
                        >
                          <span className="truncate">{s.title || "Untitled"}</span>
                          {chatSessions.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Delete ${s.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChatSession(s.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Real engine status */}
        <button
          type="button"
          onClick={() => setActiveModule("settings")}
          title={online ? `Ollama connected · ${ollama?.latencyMs}ms` : "Ollama not reachable on localhost:11434"}
          className={cn(
            "flex items-center gap-2 h-11 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors",
            collapsed ? "justify-center" : "px-2"
          )}
        >
          <span className={cn("size-2 rounded-full shrink-0", online ? "bg-chart-4" : "bg-muted-foreground/40")} />
          {!collapsed && (
            <span className="truncate">
              {online ? `Ollama · ${models.length} model${models.length === 1 ? "" : "s"}` : "Engine offline"}
            </span>
          )}
        </button>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center h-14 px-6 border-b border-border shrink-0">
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        <div className="flex-1 flex min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
