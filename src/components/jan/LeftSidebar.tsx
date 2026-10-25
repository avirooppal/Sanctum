"use client";

import React, { useState } from "react";
import {
  IconMessageCircle,
  IconFolderPlus,
  IconSearch,
  IconGridDots,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconMessage,
  IconPlus,
} from "@tabler/icons-react";
import { DownloadPopover } from "./DownloadPopover";
import { AddProjectDialog } from "./AddProjectDialog";
import { SearchDialog } from "./SearchDialog";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  onNavigate: (module: "chat" | "hub" | "settings") => void;
  activeModule: string;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onNavigate,
  activeModule,
}) => {
  const {
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    isExplorerCollapsed,
    toggleExplorer,
  } = useAppStore();

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  // Projects store state
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([
    { id: "proj-1", name: "Default Project" },
  ]);

  const handleCreateProject = (name: string) => {
    setProjects((prev) => [...prev, { id: `proj-${Date.now()}`, name }]);
  };

  return (
    <>
      <aside
        className={cn(
          "relative z-40 flex flex-col justify-between bg-sidebar/95 border-r border-border/70 select-none transition-all duration-200 backdrop-blur-xl h-full",
          isExplorerCollapsed ? "w-14 px-1 py-3" : "w-64 p-3"
        )}
      >
        {/* Top Header matching Screenshot 2026-10-25 190854.png */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1.5 h-8">
            {!isExplorerCollapsed && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-foreground font-sans">
                  Sanctum
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              {/* Downloads popover */}
              <DownloadPopover />
              {/* Collapse toggle */}
              <button
                type="button"
                onClick={toggleExplorer}
                aria-label={isExplorerCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Toggle Sidebar (Ctrl+B)"
              >
                {isExplorerCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                createNewChatSession();
                onNavigate("chat");
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                activeModule === "chat"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <IconMessageCircle size={16} className="text-primary shrink-0" />
              {!isExplorerCollapsed && (
                <>
                  <span className="flex-1">New Chat</span>
                  <span className="text-[10px] font-mono text-muted-foreground/70">Ctrl+N</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsProjectDialogOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
            >
              <IconFolderPlus size={16} className="shrink-0" />
              {!isExplorerCollapsed && (
                <>
                  <span className="flex-1">New Projects</span>
                  <span className="text-[10px] font-mono text-muted-foreground/70">Ctrl+P</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSearchDialogOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
            >
              <IconSearch size={16} className="shrink-0" />
              {!isExplorerCollapsed && (
                <>
                  <span className="flex-1">Search</span>
                  <span className="text-[10px] font-mono text-muted-foreground/70">Ctrl+K</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("hub")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                activeModule === "hub"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <IconGridDots size={16} className="shrink-0" />
              {!isExplorerCollapsed && <span>Hub</span>}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                activeModule === "settings"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <IconSettings size={16} className="shrink-0" />
              {!isExplorerCollapsed && <span>Settings</span>}
            </button>
          </nav>

          {/* Projects and Threads list */}
          {!isExplorerCollapsed && (
            <div className="flex-1 overflow-y-auto space-y-4 pt-2">
              {/* Projects section */}
              {projects.length > 0 && (
                <div className="space-y-1">
                  <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Projects
                  </span>
                  <div className="space-y-0.5">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground cursor-pointer transition-colors"
                      >
                        <IconFolder size={14} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Threads section */}
              <div className="space-y-1">
                <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Chats
                </span>
                <div className="space-y-0.5">
                  {chatSessions.map((session) => {
                    const isActive = session.id === activeSessionId && activeModule === "chat";
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(session.id);
                          onNavigate("chat");
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                          isActive
                            ? "bg-accent/80 text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        <IconMessage size={14} className="shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1">{session.title || "New Thread"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Dialog Modals */}
      <AddProjectDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        onSave={handleCreateProject}
      />

      <SearchDialog
        open={isSearchDialogOpen}
        onOpenChange={setIsSearchDialogOpen}
      />
    </>
  );
};
