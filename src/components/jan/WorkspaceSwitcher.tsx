"use client";

import React, { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconFolder,
  IconMessageCircle,
  IconPlus,
  IconPin,
  IconPinFilled,
  IconArchive,
  IconAlertTriangle,
  IconBell,
  IconDownload,
  IconSearch,
  IconPencil,
  IconCheck,
} from "@tabler/icons-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WORKSPACE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export const WorkspaceChip: React.FC<{ onClick?: () => void; compact?: boolean }> = ({
  onClick,
  compact = false,
}) => {
  const { workspaces, activeWorkspaceId, attentionInbox } = useAppStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      activeWorkspaceId: s.activeWorkspaceId,
      attentionInbox: s.attentionInbox,
    }))
  );
  const active = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  if (!active) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="workspace-switcher-trigger"
      title={`Workspace: ${active.name} (Ctrl+Shift+W)`}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 transition-colors text-left",
        compact ? "px-2 py-1 text-[11px]" : "w-full px-2.5 py-2 text-xs"
      )}
    >
      <span
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: active.color || "#6366f1" }}
      />
      <span className="font-semibold text-foreground truncate flex-1">{active.name}</span>
      {active.rootStatus === "missing" && (
        <IconAlertTriangle size={13} className="text-amber-400 shrink-0" />
      )}
      {attentionInbox.totalAttention > 0 && (
        <span
          data-testid="workspace-attention-badge"
          className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30"
        >
          {attentionInbox.totalAttention}
        </span>
      )}
      <IconChevronDown size={13} className="text-muted-foreground shrink-0" />
    </button>
  );
};

export const WorkspaceSwitcher: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const {
    workspaces,
    activeWorkspaceId,
    attentionInbox,
    isWorkspaceSwitcherOpen,
    setWorkspaceSwitcherOpen,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    relocateWorkspace,
    togglePinWorkspace,
    archiveWorkspace,
  } = useAppStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      activeWorkspaceId: s.activeWorkspaceId,
      attentionInbox: s.attentionInbox,
      isWorkspaceSwitcherOpen: s.isWorkspaceSwitcherOpen,
      setWorkspaceSwitcherOpen: s.setWorkspaceSwitcherOpen,
      switchWorkspace: s.switchWorkspace,
      createWorkspace: s.createWorkspace,
      renameWorkspace: s.renameWorkspace,
      relocateWorkspace: s.relocateWorkspace,
      togglePinWorkspace: s.togglePinWorkspace,
      archiveWorkspace: s.archiveWorkspace,
    }))
  );

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizName, setWizName] = useState("");
  const [wizMode, setWizMode] = useState<"folder" | "chat_only">("folder");
  const [wizRootPath, setWizRootPath] = useState("");
  const [wizColor, setWizColor] = useState(WORKSPACE_COLORS[0]);
  const [wizCopyFrom, setWizCopyFrom] = useState("");
  const [wizError, setWizError] = useState("");
  const [wizOverlapId, setWizOverlapId] = useState("");
  const [relocateInput, setRelocateInput] = useState("");
  const [showRelocate, setShowRelocate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const active = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = workspaces.filter((w) => !w.archived && (!q || w.name.toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastOpenedAt || "").localeCompare(a.lastOpenedAt || "");
    });
  }, [workspaces, search]);

  const handleCreate = async () => {
    setWizError("");
    setWizOverlapId("");
    const res = await createWorkspace({
      name: wizName.trim(),
      rootPath: wizMode === "folder" ? wizRootPath.trim() : null,
      color: wizColor,
      icon: wizMode === "folder" ? "folder" : "message",
      copySettingsFromId: wizCopyFrom || undefined,
    });
    if (!res.ok) {
      setWizError(res.error || "Failed to create workspace");
      if (res.existingWorkspaceId) setWizOverlapId(res.existingWorkspaceId);
      return;
    }
    if (res.warnings && res.warnings.length > 0) {
      toast.warning(res.warnings[0]);
    } else {
      toast.success(`Workspace '${wizName.trim()}' created`);
    }
    setWizardOpen(false);
    setWizName("");
    setWizRootPath("");
    setWizCopyFrom("");
  };

  const handleExport = async (wsId: string, wsName: string) => {
    try {
      const res = await fetch(`/v1/workspaces/${encodeURIComponent(wsId)}/export`);
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanctum-workspace-${wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported Sanctum workspace data (project files not included)");
    } catch {
      toast.error("Export failed");
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setWorkspaceSwitcherOpen(true)}
        title={active ? `Workspace: ${active.name} (Ctrl+Shift+W)` : "Workspaces (Ctrl+Shift+W)"}
        className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-muted/50"
      >
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: active?.color || "#6366f1" }}
        />
      </button>
    );
  }

  return (
    <div className="space-y-1.5" data-testid="workspace-switcher-container">
      <WorkspaceChip onClick={() => setWorkspaceSwitcherOpen(!isWorkspaceSwitcherOpen)} />

      {/* Missing root folder banner */}
      {active?.rootStatus === "missing" && (
        <div
          data-testid="workspace-missing-root-banner"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] space-y-2"
        >
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <IconAlertTriangle size={13} />
            <span>Folder missing: Locate / Remove</span>
          </div>
          <p className="text-muted-foreground leading-snug">
            Tools are disabled until relocated. Chat history remains readable.
          </p>
          {showRelocate ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={relocateInput}
                onChange={(e) => setRelocateInput(e.target.value)}
                placeholder="C:\path\to\folder"
                className="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-mono"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={async () => {
                    const r = await relocateWorkspace(active.id, relocateInput.trim());
                    if (r.ok) {
                      toast.success("Workspace folder relocated");
                      setShowRelocate(false);
                      setRelocateInput("");
                    } else {
                      toast.error(r.error || "Invalid folder");
                    }
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowRelocate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRelocate(true)}
                className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
              >
                Locate
              </button>
              <button
                type="button"
                onClick={() => void archiveWorkspace(active.id, true)}
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Archive
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workspace Switcher & Global Attention Inbox Dialog */}
      <Dialog open={isWorkspaceSwitcherOpen} onOpenChange={setWorkspaceSwitcherOpen}>
        <DialogContent className="max-w-[540px] w-full p-0 rounded-2xl border border-border/80 bg-background/95 backdrop-blur-2xl shadow-2xl overflow-hidden gap-0">
          <DialogTitle className="sr-only">Switch Workspace</DialogTitle>
          <div className="px-4 py-3.5 border-b border-border/60 flex items-center gap-3">
            <IconSearch size={16} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              autoFocus
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <Button
              size="sm"
              className="h-8 px-3 rounded-xl text-xs font-medium gap-1.5 shrink-0"
              onClick={() => {
                setWorkspaceSwitcherOpen(false);
                setWizardOpen(true);
              }}
            >
              <IconPlus size={14} />
              <span>New Workspace</span>
            </Button>
          </div>

          <div className="max-h-[340px] overflow-y-auto p-2.5 space-y-1">
            {filtered.map((ws) => {
              const counts = attentionInbox.byWorkspace[ws.id] || { runningCount: 0, attentionCount: 0 };
              const isCurrent = ws.id === activeWorkspaceId;
              return (
                <div
                  key={ws.id}
                  className={cn(
                    "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors",
                    isCurrent
                      ? "bg-accent/80 border-border/80 text-foreground"
                      : "border-transparent hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void switchWorkspace(ws.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: ws.color || "#6366f1" }} />
                    {ws.rootPath ? <IconFolder size={15} className="shrink-0 text-muted-foreground" /> : <IconMessageCircle size={15} className="shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      {editingId === ws.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void renameWorkspace(ws.id, editName);
                              setEditingId(null);
                            }
                          }}
                          className="w-full rounded-lg bg-background px-2 py-1 text-xs border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <div className="text-sm font-medium text-foreground truncate">{ws.name}</div>
                      )}
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {ws.rootPath || "Chat-only workspace"}
                      </div>
                    </div>
                  </button>

                  {counts.runningCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 shrink-0">
                      {counts.runningCount} run
                    </span>
                  )}
                  {counts.attentionCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-400 shrink-0">
                      {counts.attentionCount} attn
                    </span>
                  )}

                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      title={ws.pinned ? "Unpin" : "Pin"}
                      onClick={() => void togglePinWorkspace(ws.id, !ws.pinned)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {ws.pinned ? <IconPinFilled size={13} className="text-primary" /> : <IconPin size={13} />}
                    </button>
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => {
                        if (editingId === ws.id) {
                          void renameWorkspace(ws.id, editName);
                          setEditingId(null);
                        } else {
                          setEditingId(ws.id);
                          setEditName(ws.name);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {editingId === ws.id ? <IconCheck size={13} /> : <IconPencil size={13} />}
                    </button>
                    <button
                      type="button"
                      title="Export Sanctum workspace data"
                      onClick={() => void handleExport(ws.id, ws.name)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <IconDownload size={13} />
                    </button>
                    <button
                      type="button"
                      title="Archive workspace"
                      onClick={() => void archiveWorkspace(ws.id, true)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <IconArchive size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global Attention Inbox */}
          {attentionInbox.items.length > 0 && (
            <div className="border-t border-border/60 p-3.5 bg-muted/20 space-y-2" data-testid="global-attention-inbox">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <IconBell size={14} />
                <span>Attention Needed Across Workspaces ({attentionInbox.items.length})</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {attentionInbox.items.map((item) => (
                  <div
                    key={item.approvalId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-amber-500/20 bg-card text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {item.workspaceName} · {item.tool}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {item.workspaceRoot}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0"
                      onClick={() => void switchWorkspace(item.workspaceId)}
                    >
                      Jump
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer shortcuts matching SearchDialog */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] border border-border font-mono">Ctrl+Shift+W</kbd>
              <span>to toggle switcher</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] border border-border font-mono">esc</kbd>
              <span>to close</span>
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Workspace Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-[480px] w-full rounded-2xl border border-border/80 bg-background/95 backdrop-blur-2xl p-6 shadow-2xl space-y-4">
          <DialogTitle className="text-sm font-semibold text-foreground">New Workspace</DialogTitle>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWizMode("folder")}
                className={cn(
                  "p-2.5 rounded-xl border text-left text-xs",
                  wizMode === "folder" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground"
                )}
              >
                <div className="font-semibold">Project Folder</div>
                <div className="text-[10px] opacity-80">Scoped tools, git &amp; vault</div>
              </button>
              <button
                type="button"
                onClick={() => setWizMode("chat_only")}
                className={cn(
                  "p-2.5 rounded-xl border text-left text-xs",
                  wizMode === "chat_only" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground"
                )}
              >
                <div className="font-semibold">Chat-Only</div>
                <div className="text-[10px] opacity-80">No folder attached</div>
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">Workspace Name</label>
              <input
                type="text"
                value={wizName}
                onChange={(e) => setWizName(e.target.value)}
                placeholder="e.g. Backend API"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>

            {wizMode === "folder" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">Root Folder Path</label>
                <input
                  type="text"
                  value={wizRootPath}
                  onChange={(e) => setWizRootPath(e.target.value)}
                  placeholder="C:\Users\you\Projects\my-repo"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">Color</span>
              <div className="flex gap-1.5">
                {WORKSPACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setWizColor(c)}
                    className={cn("size-5 rounded-full border-2", wizColor === c ? "border-foreground" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {workspaces.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">
                  Copy settings from (settings only, never data)
                </label>
                <select
                  value={wizCopyFrom}
                  onChange={(e) => setWizCopyFrom(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                >
                  <option value="">None (defaults)</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            {wizError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] space-y-1.5">
                <div>{wizError}</div>
                {wizOverlapId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      setWizardOpen(false);
                      void switchWorkspace(wizOverlapId);
                    }}
                  >
                    Open Existing Workspace
                  </Button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setWizardOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!wizName.trim()} onClick={() => void handleCreate()}>
                Create Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
