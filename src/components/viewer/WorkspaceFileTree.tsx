"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  ExternalLink,
  Trash2,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

export interface FsTreeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  ignored: boolean;
  size: number;
  extension: string;
  modifiedAt: string;
}

function getFileIcon(entry: FsTreeEntry, isOpen?: boolean) {
  if (entry.isDirectory) {
    return isOpen ? (
      <FolderOpen className="size-3.5 text-amber-400/90 shrink-0" />
    ) : (
      <Folder className="size-3.5 text-amber-400/80 shrink-0" />
    );
  }
  const ext = entry.extension.toLowerCase();
  if ([".md", ".mdx", ".txt", ".pdf"].includes(ext)) {
    return <FileText className="size-3.5 text-sky-400 shrink-0" />;
  }
  if ([".json", ".yaml", ".yml", ".csv", ".toml"].includes(ext)) {
    return <FileJson className="size-3.5 text-emerald-400 shrink-0" />;
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp"].includes(ext)) {
    return <FileImage className="size-3.5 text-purple-400 shrink-0" />;
  }
  if ([".mp4", ".webm", ".mov"].includes(ext)) {
    return <FileVideo className="size-3.5 text-rose-400 shrink-0" />;
  }
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
    return <FileAudio className="size-3.5 text-pink-400 shrink-0" />;
  }
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".html", ".css", ".rs", ".go", ".cpp", ".c", ".sh", ".ps1"].includes(ext)) {
    return <FileCode className="size-3.5 text-indigo-400 shrink-0" />;
  }
  return <FileArchive className="size-3.5 text-muted-foreground shrink-0" />;
}

interface TreeNodeProps {
  entry: FsTreeEntry;
  depth: number;
  activePath: string | null;
  showIgnored: boolean;
  filterQuery: string;
  refreshSignal: number;
  onSelectFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FsTreeEntry) => void;
}

const TreeNode: React.FC<TreeNodeProps> = React.memo(
  ({
    entry,
    depth,
    activePath,
    showIgnored,
    filterQuery,
    refreshSignal,
    onSelectFile,
    onContextMenu,
  }) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FsTreeEntry[] | null>(null);
    const [loading, setLoading] = useState(false);

    const loadChildren = useCallback(async () => {
      if (!entry.isDirectory) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/fs/tree?path=${encodeURIComponent(entry.path)}&showIgnored=${showIgnored}`
        );
        if (res.ok) {
          const data = await res.json();
          setChildren(Array.isArray(data.entries) ? data.entries : []);
        }
      } catch {
        // Ignore transient tree fetch error
      } finally {
        setLoading(false);
      }
    }, [entry.isDirectory, entry.path, showIgnored]);

    useEffect(() => {
      if (expanded) {
        void loadChildren();
      }
    }, [expanded, showIgnored, refreshSignal, loadChildren]);

    const matchesFilter =
      !filterQuery || entry.name.toLowerCase().includes(filterQuery.toLowerCase());

    if (!entry.isDirectory && !matchesFilter) {
      return null;
    }

    const isSelected = activePath?.toLowerCase() === entry.path.toLowerCase();

    return (
      <div>
        <div
          role="treeitem"
          aria-expanded={entry.isDirectory ? expanded : undefined}
          aria-selected={isSelected}
          draggable={!entry.isDirectory}
          onDragStart={(e) => {
            if (!entry.isDirectory) {
              e.dataTransfer.setData("application/x-sanctum-path", entry.path);
              e.dataTransfer.setData("text/plain", `@${entry.path}`);
            }
          }}
          onClick={() => {
            if (entry.isDirectory) {
              setExpanded((v) => !v);
            } else {
              onSelectFile(entry.path);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, entry)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={cn(
            "group flex items-center gap-1.5 py-1 pr-2 text-xs cursor-pointer rounded-md select-none transition-colors",
            isSelected
              ? "bg-accent text-foreground font-medium"
              : "text-foreground/85 hover:bg-muted/50 hover:text-foreground",
            entry.ignored && "opacity-50"
          )}
        >
          {entry.isDirectory ? (
            <span className="w-3.5 flex items-center justify-center text-muted-foreground">
              {expanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}
          {getFileIcon(entry, expanded)}
          <span className="truncate flex-1" title={entry.path}>
            {entry.name}
          </span>
        </div>

        {entry.isDirectory && expanded && (
          <div>
            {loading && !children && (
              <div
                style={{ paddingLeft: `${(depth + 1) * 12 + 22}px` }}
                className="py-1 text-[11px] text-muted-foreground"
              >
                Loading…
              </div>
            )}
            {children?.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                activePath={activePath}
                showIgnored={showIgnored}
                filterQuery={filterQuery}
                refreshSignal={refreshSignal}
                onSelectFile={onSelectFile}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
TreeNode.displayName = "TreeNode";

interface WorkspaceFileTreeProps {
  workspaceName: string;
  workspaceId: string;
  refreshSignal: number;
  onRefresh: () => void;
  onToggleSidebar: () => void;
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
  workspaceName,
  workspaceId,
  refreshSignal,
  onRefresh,
  onToggleSidebar,
}) => {
  const {
    viewerTabs,
    activeViewerTabId,
    showIgnoredFiles,
    setShowIgnoredFiles,
    treeSearchQuery,
    setTreeSearchQuery,
    openFileTab,
    closeViewerTab,
  } = useAppStore(
    useShallow((s) => ({
      viewerTabs: s.viewerTabs,
      activeViewerTabId: s.activeViewerTabId,
      showIgnoredFiles: s.showIgnoredFiles,
      setShowIgnoredFiles: s.setShowIgnoredFiles,
      treeSearchQuery: s.treeSearchQuery,
      setTreeSearchQuery: s.setTreeSearchQuery,
      openFileTab: s.openFileTab,
      closeViewerTab: s.closeViewerTab,
    }))
  );

  const [rootEntries, setRootEntries] = useState<FsTreeEntry[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FsTreeEntry;
  } | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<FsTreeEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const filterInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onFocusTree = () => {
      setTimeout(() => filterInputRef.current?.focus(), 40);
    };
    window.addEventListener("sanctum:focus-file-tree", onFocusTree);
    return () => window.removeEventListener("sanctum:focus-file-tree", onFocusTree);
  }, []);

  const activeTab = viewerTabs.find((t) => t.id === activeViewerTabId) || null;

  const loadRoot = useCallback(async () => {
    try {
      const res = await fetch(`/api/fs/tree?path=.&showIgnored=${showIgnoredFiles}`);
      if (res.ok) {
        const data = await res.json();
        setRootEntries(Array.isArray(data.entries) ? data.entries : []);
      }
    } catch {
      // Ignore offline fetch error
    }
  }, [showIgnoredFiles]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot, refreshSignal, workspaceId]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FsTreeEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const handleCopyPath = async (relPath: string) => {
    try {
      await navigator.clipboard.writeText(relPath);
      toast.success(`Copied path: ${relPath}`);
    } catch {
      toast.error("Failed to copy path");
    }
  };

  const handleReveal = async (relPath: string) => {
    try {
      const res = await fetch("/api/fs/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: relPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Could not reveal in Explorer");
      }
    } catch {
      toast.error("Could not reveal in Explorer");
    }
  };

  const handleDeleteEntry = async (entry: FsTreeEntry) => {
    try {
      const res = await fetchWithApproval(
        "/api/tools/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "workspace_files",
            workspaceId,
            arguments: { action: "delete", path: entry.path },
          }),
        },
        "delete_path"
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Moved ${entry.name} to recoverable tool-trash`);
        const openMatch = viewerTabs.find(
          (t) => t.path.toLowerCase() === entry.path.toLowerCase()
        );
        if (openMatch) closeViewerTab(openMatch.id);
        onRefresh();
      } else {
        toast.error(data.error || "Delete failed");
      }
    } catch {
      toast.error("Delete operation failed");
    }
  };

  const submitRename = async () => {
    if (!renamingEntry || !renameValue.trim() || renameValue.trim() === renamingEntry.name) {
      setRenamingEntry(null);
      return;
    }
    const parentDir = renamingEntry.path.includes("/")
      ? renamingEntry.path.slice(0, renamingEntry.path.lastIndexOf("/"))
      : "";
    const destination = parentDir ? `${parentDir}/${renameValue.trim()}` : renameValue.trim();

    try {
      const res = await fetchWithApproval(
        "/api/tools/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "workspace_files",
            workspaceId,
            arguments: {
              action: "move",
              path: renamingEntry.path,
              destination,
            },
          }),
        },
        "move_path"
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Renamed to ${destination}`);
        onRefresh();
      } else {
        toast.error(data.error || "Rename failed");
      }
    } catch {
      toast.error("Rename failed");
    } finally {
      setRenamingEntry(null);
    }
  };

  return (
    <aside
      aria-label="Workspace file tree"
      className="w-60 shrink-0 border-l border-border/70 bg-sidebar/60 flex flex-col min-h-0 select-none"
    >
      {/* Workspace Header & Toggle Sidebar */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 border-b border-border/60">
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          Workspace
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowIgnoredFiles(!showIgnoredFiles)}
            title={showIgnoredFiles ? "Hide ignored files (.git, node_modules)" : "Show ignored files"}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {showIgnoredFiles ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh file tree"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="px-2 py-0.5 rounded-md border border-border/70 bg-card/80 text-[11px] text-foreground/90 hover:bg-accent transition-colors"
          >
            Toggle sidebar
          </button>
        </div>
      </div>

      {/* Filter Input */}
      <div className="px-2 py-1.5 border-b border-border/50">
        <div className="relative flex items-center">
          <Search className="size-3 text-muted-foreground absolute left-2 pointer-events-none" />
          <input
            ref={filterInputRef}
            type="text"
            value={treeSearchQuery}
            onChange={(e) => setTreeSearchQuery(e.target.value)}
            placeholder="Filter files…"
            aria-label="Filter workspace files"
            className="w-full rounded-md bg-background/70 border border-border/60 pl-6 pr-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60"
          />
        </div>
      </div>

      {/* Inline Rename Prompt */}
      {renamingEntry && (
        <div className="px-2.5 py-2 border-b border-border bg-accent/40 space-y-1.5">
          <div className="text-[10px] text-muted-foreground truncate">
            Rename {renamingEntry.name}:
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename();
                if (e.key === "Escape") setRenamingEntry(null);
              }}
              autoFocus
              className="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => void submitRename()}
              className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px]"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Root Folder + Entries */}
      <div role="tree" className="flex-1 overflow-y-auto py-1.5 px-1 space-y-0.5">
        <div className="flex items-center gap-1.5 px-1.5 py-1 text-xs font-semibold text-foreground/90">
          <ChevronDown className="size-3 text-muted-foreground" />
          <FolderOpen className="size-3.5 text-amber-400" />
          <span className="truncate">{workspaceName || "Workspace"}</span>
        </div>

        {rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={1}
            activePath={activeTab?.path || null}
            showIgnored={showIgnoredFiles}
            filterQuery={treeSearchQuery}
            refreshSignal={refreshSignal}
            onSelectFile={(path) => openFileTab(path)}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: Math.min(contextMenu.y, window.innerHeight - 180),
            left: Math.min(contextMenu.x, window.innerWidth - 180),
          }}
          className="z-50 w-44 rounded-lg border border-border bg-popover p-1 shadow-xl text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <button
              type="button"
              onClick={() => {
                openFileTab(contextMenu.entry.path);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
            >
              <FileText className="size-3.5" />
              <span>Open</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void handleCopyPath(contextMenu.entry.path);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
          >
            <Copy className="size-3.5" />
            <span>Copy path</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void handleReveal(contextMenu.entry.path);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
          >
            <ExternalLink className="size-3.5" />
            <span>Reveal in Explorer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRenamingEntry(contextMenu.entry);
              setRenameValue(contextMenu.entry.name);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
          >
            <Edit3 className="size-3.5" />
            <span>Rename…</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const target = contextMenu.entry;
              setContextMenu(null);
              void handleDeleteEntry(target);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/15"
          >
            <Trash2 className="size-3.5" />
            <span>Delete (Trash)</span>
          </button>
        </div>
      )}
    </aside>
  );
};
