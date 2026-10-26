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
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconMessage,
  IconPlus,
  IconTrash,
  IconEdit,
  IconPin,
  IconPinnedFilled,
  IconCopy,
  IconDownload,
  IconDots,
  IconCheck,
  IconX,
  IconFolderSymlink,
} from "@tabler/icons-react";
import { DownloadPopover } from "./DownloadPopover";
import { AddProjectDialog } from "./AddProjectDialog";
import { SearchDialog } from "./SearchDialog";
import { handleTitleBarMouseDown } from "./WindowControls";
import { useAppStore } from "@/store/useAppStore";
import { ChatSession } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeftSidebarProps {
  onNavigate: (module: "chat" | "hub" | "settings") => void;
  activeModule: string;
  isProjectDialogOpen?: boolean;
  onProjectDialogOpenChange?: (open: boolean) => void;
  isSearchDialogOpen?: boolean;
  onSearchDialogOpenChange?: (open: boolean) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onNavigate,
  activeModule,
  isProjectDialogOpen: controlledProjectOpen,
  onProjectDialogOpenChange: controlledOnProjectOpenChange,
  isSearchDialogOpen: controlledSearchOpen,
  onSearchDialogOpenChange: controlledOnSearchOpenChange,
}) => {
  const {
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    togglePinChatSession,
    moveChatToProject,
    duplicateChatSession,
    deleteAllChatSessions,
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    renameProject,
    deleteProject,
    isExplorerCollapsed,
    toggleExplorer,
  } = useAppStore();

  const [internalProjectOpen, setInternalProjectOpen] = useState(false);
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);

  const isProjectDialogOpen =
    controlledProjectOpen !== undefined ? controlledProjectOpen : internalProjectOpen;
  const setIsProjectDialogOpen = controlledOnProjectOpenChange || setInternalProjectOpen;

  const isSearchDialogOpen =
    controlledSearchOpen !== undefined ? controlledSearchOpen : internalSearchOpen;
  const setIsSearchDialogOpen = controlledOnSearchOpenChange || setInternalSearchOpen;

  // Expanded project groups state
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    "proj-default": true,
  });

  // Inline rename states for chats and projects
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState<string>("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string>("");

  // Active context menu for a chat item
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);

  const handleCreateProject = (name: string, assistantId?: string) => {
    createProject(name, assistantId);
    toast.success(`Created chat group "${name}"`);
  };

  const toggleProjectExpand = (projId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projId]: prev[projId] === undefined ? false : !prev[projId],
    }));
  };

  const startEditingChat = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(session.id);
    setEditingChatTitle(session.title || "New Chat");
    setMenuOpenChatId(null);
  };

  const commitEditingChat = (id: string) => {
    if (editingChatTitle.trim()) {
      renameChatSession(id, editingChatTitle.trim());
      toast.success("Chat renamed");
    }
    setEditingChatId(null);
  };

  const startEditingProject = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(id);
    setEditingProjectName(currentName);
  };

  const commitEditingProject = (id: string) => {
    if (editingProjectName.trim()) {
      renameProject(id, editingProjectName.trim());
      toast.success("Group renamed");
    }
    setEditingProjectId(null);
  };

  const handleExportChat = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenChatId(null);
    const mdLines = [
      `# ${session.title || "Chat Export"}`,
      `Exported: ${new Date().toISOString()}`,
      "",
      ...session.messages.map(
        (m) => `### ${m.role === "user" ? "User" : "Assistant"} (${m.timestamp})\n\n${m.content}\n`
      ),
    ];
    const blob = new Blob([mdLines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(session.title || "chat").replace(/[^a-z0-9-_]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported "${session.title}" as Markdown`);
  };

  const renderChatRow = (session: ChatSession, compact = false) => {
    const isActive = session.id === activeSessionId && activeModule === "chat";
    const isEditing = editingChatId === session.id;
    const isMenuOpen = menuOpenChatId === session.id;

    if (isEditing) {
      return (
        <div
          key={session.id}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/80 border border-primary/40"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={editingChatTitle}
            onChange={(e) => setEditingChatTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEditingChat(session.id);
              if (e.key === "Escape") setEditingChatId(null);
            }}
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commitEditingChat(session.id)}
            className="p-0.5 text-emerald-500 hover:text-emerald-400"
            title="Save"
          >
            <IconCheck size={13} />
          </button>
          <button
            type="button"
            onClick={() => setEditingChatId(null)}
            className="p-0.5 text-muted-foreground hover:text-foreground"
            title="Cancel"
          >
            <IconX size={13} />
          </button>
        </div>
      );
    }

    return (
      <div key={session.id} className="relative group">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveSessionId(session.id);
            onNavigate("chat");
            setMenuOpenChatId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveSessionId(session.id);
              onNavigate("chat");
            }
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer",
            compact && "pl-6",
            isActive
              ? "bg-accent/90 text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          )}
        >
          {session.pinned ? (
            <IconPinnedFilled size={13} className="shrink-0 text-primary" />
          ) : (
            <IconMessage size={14} className="shrink-0 text-muted-foreground" />
          )}
          <span className="truncate flex-1">{session.title || "New Chat"}</span>

          {/* Quick Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => startEditingChat(session, e)}
              className="p-1 rounded hover:bg-background/70 text-muted-foreground hover:text-foreground"
              title="Rename chat"
              aria-label="Rename chat"
            >
              <IconEdit size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenChatId(isMenuOpen ? null : session.id);
              }}
              className="p-1 rounded hover:bg-background/70 text-muted-foreground hover:text-foreground"
              title="More chat actions (Group, Pin, Export, Delete)"
              aria-label="More chat actions"
            >
              <IconDots size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteChatSession(session.id);
                setMenuOpenChatId(null);
                toast.success(`Deleted "${session.title || "Chat"}"`);
              }}
              className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
              title="Delete chat"
              aria-label="Delete chat"
            >
              <IconTrash size={12} />
            </button>
          </div>
        </div>

        {/* Context Action Menu for Grouping, Pinning, Duplicating, Exporting, Deleting */}
        {isMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-1 mb-1.5 ml-2 mr-1 rounded-xl border border-border bg-popover p-2 shadow-xl space-y-1 text-[11px] z-50"
          >
            <div className="flex items-center justify-between px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Chat Options</span>
              <button
                type="button"
                onClick={() => setMenuOpenChatId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconX size={12} />
              </button>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePinChatSession(session.id);
                setMenuOpenChatId(null);
                toast.success(session.pinned ? "Chat unpinned" : "Chat pinned to top");
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground text-left"
            >
              <IconPin size={13} className="text-primary" />
              <span>{session.pinned ? "Unpin Chat" : "Pin Chat"}</span>
            </button>

            <button
              type="button"
              onClick={(e) => startEditingChat(session, e)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground text-left"
            >
              <IconEdit size={13} />
              <span>Rename Chat</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                duplicateChatSession(session.id);
                setMenuOpenChatId(null);
                toast.success("Chat duplicated");
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground text-left"
            >
              <IconCopy size={13} />
              <span>Duplicate Chat</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleExportChat(session, e)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground text-left"
            >
              <IconDownload size={13} />
              <span>Export Markdown (.md)</span>
            </button>

            {/* Move to Group / Project selector */}
            <div className="pt-1 border-t border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <IconFolderSymlink size={12} />
                <span>Move to Group / Project</span>
              </div>
              <select
                value={session.projectId || ""}
                onChange={(e) => {
                  const targetProj = e.target.value || undefined;
                  moveChatToProject(session.id, targetProj);
                  if (targetProj) {
                    setExpandedProjects((prev) => ({ ...prev, [targetProj]: true }));
                  }
                  setMenuOpenChatId(null);
                  toast.success(targetProj ? "Chat moved to group" : "Chat removed from group");
                }}
                className="w-full px-2 py-1 rounded-lg border border-border bg-background text-[11px] text-foreground"
              >
                <option value="">Ungrouped (All Chats)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-1 border-t border-border/50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChatSession(session.id);
                  setMenuOpenChatId(null);
                  toast.success(`Deleted "${session.title || "Chat"}"`);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-destructive/15 text-destructive text-left font-medium"
              >
                <IconTrash size={13} />
                <span>Delete Chat</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const pinnedSessions = chatSessions.filter((s) => s.pinned);
  const ungroupedSessions = chatSessions.filter((s) => !s.projectId);

  return (
    <>
      {!(isExplorerCollapsed && activeModule === "chat") && (
        <aside
          className={cn(
            "relative z-40 flex flex-col justify-between bg-sidebar border-r border-border/60 select-none transition-all duration-200 h-full shrink-0",
            isExplorerCollapsed ? "w-14 px-1.5 py-2.5" : "w-60 px-2.5 py-2.5"
          )}
        >
          <div className="flex flex-col gap-2.5 h-full min-h-0">
            {/* Top Header (Draggable in-window titlebar strip, no redundant 'Sanctum' label) */}
            <div
              onMouseDown={handleTitleBarMouseDown}
              className="flex items-center justify-end px-1 h-8 shrink-0"
            >
              <div className="flex items-center gap-1 ml-auto">
                <DownloadPopover />
                <button
                  type="button"
                  onClick={toggleExplorer}
                  aria-label={isExplorerCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Toggle Sidebar (Ctrl+B)"
                >
                  {isExplorerCollapsed ? <IconChevronRight size={15} /> : <IconChevronLeft size={15} />}
                </button>
              </div>
            </div>

          {/* Primary Action Buttons */}
          <nav className="space-y-1 shrink-0">
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

          {/* Projects (Chat Groups) and Threads list */}
          {!isExplorerCollapsed && (
            <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-0.5 min-h-0">
              {/* Pinned Chats */}
              {pinnedSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pinned
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      {pinnedSessions.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {pinnedSessions.map((session) => renderChatRow(session))}
                  </div>
                </div>
              )}

              {/* Projects / Chat Groups section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Projects & Groups
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsProjectDialogOpen(true)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Create New Project / Group"
                  >
                    <IconPlus size={12} />
                  </button>
                </div>

                <div className="space-y-1">
                  {projects.map((p) => {
                    const groupChats = chatSessions.filter((s) => s.projectId === p.id);
                    const isExpanded = expandedProjects[p.id] ?? true;
                    const isEditingProj = editingProjectId === p.id;

                    return (
                      <div key={p.id} className="space-y-0.5">
                        {isEditingProj ? (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/80 border border-primary/40">
                            <input
                              type="text"
                              value={editingProjectName}
                              onChange={(e) => setEditingProjectName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEditingProject(p.id);
                                if (e.key === "Escape") setEditingProjectId(null);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => commitEditingProject(p.id)}
                              className="p-0.5 text-emerald-500"
                            >
                              <IconCheck size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProjectId(null)}
                              className="p-0.5 text-muted-foreground"
                            >
                              <IconX size={13} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              toggleProjectExpand(p.id);
                              setActiveProjectId(activeProjectId === p.id ? null : p.id);
                            }}
                            className={cn(
                              "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                              activeProjectId === p.id
                                ? "bg-accent/60 text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            )}
                          >
                            <IconChevronDown
                              size={12}
                              className={cn(
                                "shrink-0 transition-transform duration-150",
                                !isExpanded && "-rotate-90"
                              )}
                            />
                            {isExpanded ? (
                              <IconFolderOpen size={14} className="shrink-0 text-primary/80" />
                            ) : (
                              <IconFolder size={14} className="shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate flex-1">{p.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground/70 group-hover:hidden">
                              {groupChats.length}
                            </span>

                            {/* Group hover actions: Add chat to group, Rename group, Delete group */}
                            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedProjects((prev) => ({ ...prev, [p.id]: true }));
                                  createNewChatSession(p.id);
                                  onNavigate("chat");
                                  toast.success(`New chat created in "${p.name}"`);
                                }}
                                className="p-0.5 rounded hover:bg-background/70 text-muted-foreground hover:text-foreground"
                                title="New chat in this group"
                              >
                                <IconPlus size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => startEditingProject(p.id, p.name, e)}
                                className="p-0.5 rounded hover:bg-background/70 text-muted-foreground hover:text-foreground"
                                title="Rename group"
                              >
                                <IconEdit size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(p.id);
                                  toast.success(`Removed group "${p.name}" (chats kept)`);
                                }}
                                className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                                title="Delete group"
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Grouped chats inside this Project */}
                        {isExpanded && groupChats.length > 0 && (
                          <div className="space-y-0.5 pt-0.5">
                            {groupChats.map((s) => renderChatRow(s, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ungrouped / All Chats section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Chats ({ungroupedSessions.length})
                  </span>
                  {chatSessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteAllChatSessions();
                        toast.success("Cleared all chat threads");
                      }}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete all chat threads"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {ungroupedSessions.map((session) => renderChatRow(session))}
                </div>
              </div>
            </div>
          )}
        </div>
        </aside>
      )}

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
