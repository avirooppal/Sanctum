"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  FolderPlus,
  FolderX,
  Monitor,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { fetchWithApproval } from "@/lib/hostBridge";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RECENT_WORKSPACES_KEY = "sanctum.recentWorkspaces.v1";
const NO_PROJECT_KEY = "sanctum.noProjectMode.v1";

interface RecentWorkspace {
  path: string;
  name: string;
  lastUsed: number;
}

function basenameOf(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p || "workspace";
}

function loadRecentWorkspaces(): RecentWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.path === "string" && x.path.length > 0);
  } catch {
    return [];
  }
}

function saveRecentWorkspace(path: string): RecentWorkspace[] {
  const trimmed = path.trim();
  if (!trimmed) return loadRecentWorkspaces();
  const existing = loadRecentWorkspaces().filter(
    (w) => w.path.toLowerCase() !== trimmed.toLowerCase()
  );
  const next: RecentWorkspace[] = [
    { path: trimmed, name: basenameOf(trimmed), lastUsed: Date.now() },
    ...existing,
  ].slice(0, 8);
  try {
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

interface ComposerWorkspacePickerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ComposerWorkspacePicker: React.FC<ComposerWorkspacePickerProps> = ({
  open: controlledOpen,
  onOpenChange,
}) => {
  const { toolsEnabled, setToolsEnabled, setIsViewerOpen, setIsTreeOpen } = useAppStore(
    useShallow((s) => ({
      toolsEnabled: s.toolsEnabled,
      setToolsEnabled: s.setToolsEnabled,
      setIsViewerOpen: s.setIsViewerOpen,
      setIsTreeOpen: s.setIsTreeOpen,
    }))
  );

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? v(isOpen) : v;
      if (onOpenChange) onOpenChange(next);
      else setInternalOpen(next);
    },
    [isOpen, onOpenChange]
  );

  const [workspaceRoot, setWorkspaceRoot] = useState<string>("");
  const [noProjectMode, setNoProjectMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(NO_PROJECT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const [manualPathOpen, setManualPathOpen] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchCurrentWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) return;
      const data = await res.json();
      const root = String(data?.root || "").trim();
      if (root) {
        setWorkspaceRoot(root);
        setRecent(saveRecentWorkspace(root));
      }
    } catch {}
  }, []);

  useEffect(() => {
    setRecent(loadRecentWorkspaces());
    void fetchCurrentWorkspace();

    const wv = (window as any).chrome?.webview;
    const onMsg = (e: any) => {
      if (e.data?.type === "toolWorkspaceChanged") {
        setNoProjectMode(false);
        try {
          localStorage.removeItem(NO_PROJECT_KEY);
        } catch {}
        void fetchCurrentWorkspace();
        setIsOpen(false);
      }
    };
    wv?.addEventListener("message", onMsg);
    return () => wv?.removeEventListener("message", onMsg);
  }, [fetchCurrentWorkspace, setIsOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setManualPathOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setManualPathOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, setIsOpen]);

  const handleSelectRecent = async (targetPath: string) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetchWithApproval(
        "/api/workspace",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: targetPath }),
        },
        "workspace_change"
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not switch workspace folder.");
        return;
      }
      const nextRoot = String(data?.root || targetPath);
      setWorkspaceRoot(nextRoot);
      setNoProjectMode(false);
      try {
        localStorage.removeItem(NO_PROJECT_KEY);
      } catch {}
      setRecent(saveRecentWorkspace(nextRoot));
      setToolsEnabled(true);
      setIsOpen(false);
      setManualPathOpen(false);
      toast.success(`Workspace set to ${basenameOf(nextRoot)}`);
    } catch {
      toast.error("Failed to switch workspace folder.");
    } finally {
      setSwitching(false);
    }
  };

  const handleBrowseComputer = () => {
    const wv = (window as any).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type: "selectToolWorkspace" }));
      setIsOpen(false);
    } else {
      setManualPath(workspaceRoot);
      setManualPathOpen(true);
    }
  };

  const handleNoProject = () => {
    setNoProjectMode(true);
    setToolsEnabled(false);
    try {
      localStorage.setItem(NO_PROJECT_KEY, "1");
    } catch {}
    setIsOpen(false);
    toast.info("Switched to No Project (chat-only mode, folder tools off)");
  };

  const filteredRecent = recent.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.path.toLowerCase().includes(search.toLowerCase())
  );

  const activeName = noProjectMode
    ? "No Project"
    : workspaceRoot
    ? basenameOf(workspaceRoot)
    : "Choose Project";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/20 rounded-t-2xl"
    >
      {/* Left: Workspace Selector Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={
          noProjectMode
            ? "Chat-only mode (no workspace folder attached)"
            : workspaceRoot
            ? `Active workspace: ${workspaceRoot}\nClick to switch folder`
            : "Choose a workspace folder"
        }
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs transition-colors max-w-[260px]",
          isOpen
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        {noProjectMode ? (
          <FolderX className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <Folder className="size-3.5 text-primary/85 shrink-0" />
        )}
        <span className="font-medium truncate">{activeName}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground shrink-0 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Right: Quick File Explorer Button (when a project is active) */}
      {!noProjectMode && workspaceRoot && (
        <button
          type="button"
          onClick={() => {
            setIsViewerOpen(true);
            setIsTreeOpen(true);
          }}
          title={`Browse files in ${activeName}`}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Monitor className="size-3.5" />
        </button>
      )}

      {/* Popover Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-2 mb-2 z-50 w-72 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden text-xs"
        >
          {/* Search Projects */}
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Projects"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Recent Projects */}
          <div className="py-1.5">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </div>
            {filteredRecent.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                No recent folders yet
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto px-1.5 space-y-0.5">
                {filteredRecent.map((item) => {
                  const isActive =
                    !noProjectMode &&
                    workspaceRoot.toLowerCase() === item.path.toLowerCase();
                  return (
                    <button
                      key={item.path}
                      type="button"
                      disabled={switching}
                      onClick={() => void handleSelectRecent(item.path)}
                      title={item.path}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        isActive
                          ? "bg-accent/80 text-foreground font-medium"
                          : "text-foreground/85 hover:bg-muted/60"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Folder className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </span>
                      {isActive && <Check className="size-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* This Computer */}
          <div className="border-t border-border/60 p-1.5 space-y-0.5">
            <button
              type="button"
              onClick={handleBrowseComputer}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-foreground/90 hover:bg-muted/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Monitor className="size-3.5 text-muted-foreground" />
                <span>This Computer</span>
              </span>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={handleBrowseComputer}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-foreground/90 hover:bg-muted/60 transition-colors"
            >
              <FolderPlus className="size-3.5 text-muted-foreground" />
              <span>New Project Folder…</span>
            </button>
          </div>

          {/* Manual path fallback (web dev mode) */}
          {manualPathOpen && (
            <div className="border-t border-border/60 p-2 bg-muted/30 space-y-1.5">
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="C:\Users\...\project"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualPathOpen(false)}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!manualPath.trim() || switching}
                  onClick={() => void handleSelectRecent(manualPath)}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Use Folder
                </button>
              </div>
            </div>
          )}

          {/* No Project */}
          <div className="border-t border-border/60 p-1.5">
            <button
              type="button"
              onClick={handleNoProject}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                noProjectMode
                  ? "bg-accent/80 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span className="flex items-center gap-2">
                <FolderX className="size-3.5" />
                <span>No Project</span>
              </span>
              {noProjectMode && <Check className="size-3.5 text-primary shrink-0" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
