"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  RefreshCw,
  Copy,
  FolderOpen,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { WorkspaceFileTree } from "./WorkspaceFileTree";
import { FileContentRenderer, FsReadResponse } from "./FileContentRenderer";
import { FeedPaneTab } from "./FeedPaneTab";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

export const ArtifactViewerPanel: React.FC = () => {
  const {
    isViewerOpen,
    setIsViewerOpen,
    viewerWidth,
    setViewerWidth,
    isTreeOpen,
    toggleTree,
    viewerTabs,
    activeViewerTabId,
    openFileTab,
    closeViewerTab,
    setActiveViewerTab,
    reorderViewerTabs,
    updateViewerTab,
    refreshViewerTab,
    markPathChangedOnDisk,
  } = useAppStore(
    useShallow((s) => ({
      isViewerOpen: s.isViewerOpen,
      setIsViewerOpen: s.setIsViewerOpen,
      viewerWidth: s.viewerWidth,
      setViewerWidth: s.setViewerWidth,
      isTreeOpen: s.isTreeOpen,
      toggleTree: s.toggleTree,
      viewerTabs: s.viewerTabs,
      activeViewerTabId: s.activeViewerTabId,
      openFileTab: s.openFileTab,
      closeViewerTab: s.closeViewerTab,
      setActiveViewerTab: s.setActiveViewerTab,
      reorderViewerTabs: s.reorderViewerTabs,
      updateViewerTab: s.updateViewerTab,
      refreshViewerTab: s.refreshViewerTab,
      markPathChangedOnDisk: s.markPathChangedOnDisk,
    }))
  );

  const [workspaceInfo, setWorkspaceInfo] = useState<{
    root: string;
    id: string;
    name: string;
  }>({ root: "", id: "default", name: "Workspace" });
  const [tabDataMap, setTabDataMap] = useState<Record<string, FsReadResponse>>({});
  const [loadingTabId, setLoadingTabId] = useState<string | null>(null);
  const [treeRefreshSignal, setTreeRefreshSignal] = useState(0);
  const [dragTabIndex, setDragTabIndex] = useState<number | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<"viewer" | "feed">("viewer");
  const lastEventSeqRef = useRef<number>(0);

  useEffect(() => {
    const onToggleFeed = () => {
      setIsViewerOpen(true);
      setRightPanelMode((prev) => (prev === "feed" ? "viewer" : "feed"));
    };
    window.addEventListener("sanctum:toggle-feed-pane", onToggleFeed);
    return () => window.removeEventListener("sanctum:toggle-feed-pane", onToggleFeed);
  }, [setIsViewerOpen]);

  const activeTab = viewerTabs.find((t) => t.id === activeViewerTabId) || viewerTabs[0] || null;

  // Fetch workspace metadata
  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) return;
      const data = await res.json();
      const root = String(data.root || "");
      const parts = root.replace(/\\/g, "/").split("/").filter(Boolean);
      const name = parts[parts.length - 1] || "Workspace";
      setWorkspaceInfo({ root, id: data.id || "default", name });
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void fetchWorkspace();
    const wv = (window as any).chrome?.webview;
    const onMsg = (e: any) => {
      if (e.data?.type === "toolWorkspaceChanged") {
        void fetchWorkspace();
        setTreeRefreshSignal((s) => s + 1);
      }
    };
    wv?.addEventListener("message", onMsg);
    return () => wv?.removeEventListener("message", onMsg);
  }, [fetchWorkspace]);

  // Listen for agent tool `present_file(path)` events
  useEffect(() => {
    const onPresentFile = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        openFileTab(String(detail.path), {
          title: detail.title,
          line: detail.line,
          addDeliverable: true,
        });
      }
    };
    const onBrowserUpdated = () => {
      openFileTab("__browser__", { title: "Browser Agent" });
    };
    window.addEventListener("sanctum:present-file", onPresentFile);
    window.addEventListener("sanctum:open-file", onPresentFile);
    window.addEventListener("sanctum:browser-updated", onBrowserUpdated);
    return () => {
      window.removeEventListener("sanctum:present-file", onPresentFile);
      window.removeEventListener("sanctum:open-file", onPresentFile);
      window.removeEventListener("sanctum:browser-updated", onBrowserUpdated);
    };
  }, [openFileTab]);

  // Load active tab content
  const loadTabContent = useCallback(
    async (tabId: string, relPath: string) => {
      setLoadingTabId(tabId);
      try {
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(relPath)}`);
        const data: FsReadResponse = await res.json();
        setTabDataMap((prev) => ({ ...prev, [tabId]: data }));
        if (data.revision) {
          updateViewerTab(tabId, { diskRevision: data.revision, changedOnDisk: false });
        }
      } catch (err: any) {
        setTabDataMap((prev) => ({
          ...prev,
          [tabId]: {
            path: relPath,
            exists: false,
            isBinary: false,
            truncated: false,
            size: 0,
            modifiedAt: "",
            revision: "",
            lineCount: 0,
            content: null,
            error: err?.message || "Failed to read file",
          },
        }));
      } finally {
        setLoadingTabId((cur) => (cur === tabId ? null : cur));
      }
    },
    [updateViewerTab]
  );

  useEffect(() => {
    if (isViewerOpen && activeTab && activeTab.path !== "__browser__") {
      void loadTabContent(activeTab.id, activeTab.path);
    }
  }, [
    isViewerOpen,
    activeTab?.id,
    activeTab?.path,
    activeTab?.refreshCounter,
    loadTabContent,
  ]);

  // Live file-change subscription via /api/fs/events
  useEffect(() => {
    if (!isViewerOpen) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/fs/events?poll=1&since=${lastEventSeqRef.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.seq === "number" && data.seq > lastEventSeqRef.current) {
          lastEventSeqRef.current = data.seq;
          const events = Array.isArray(data.events) ? data.events : [];
          if (events.length > 0) {
            setTreeRefreshSignal((s) => s + 1);
            const seenPaths = new Set<string>();
            for (const ev of events) {
              if (ev.path && !seenPaths.has(ev.path)) {
                seenPaths.add(ev.path);
                markPathChangedOnDisk(String(ev.path));
              }
            }
          }
        }
      } catch {
        // Ignore poll error
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [isViewerOpen, markPathChangedOnDisk]);

  // Resize drag handler
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = viewerWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setViewerWidth(startWidth + delta);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleCopyPath = async () => {
    if (!activeTab) return;
    try {
      await navigator.clipboard.writeText(activeTab.path);
      toast.success(`Copied path: ${activeTab.path}`);
    } catch {
      toast.error("Failed to copy path");
    }
  };

  const handleRevealInExplorer = async () => {
    const targetPath = activeTab?.path || ".";
    try {
      const res = await fetch("/api/fs/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Could not reveal in Explorer");
      }
    } catch {
      toast.error("Could not reveal in Explorer");
    }
  };

  const handleOpenExternal = async (relPath: string) => {
    try {
      const res = await fetchWithApproval(
        "/api/fs/open-external",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: relPath }),
        },
        "open_external"
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Blocked or failed to open external application");
      }
    } catch {
      toast.error("Failed to open external application");
    }
  };

  if (!isViewerOpen) {
    return null;
  }

  const breadcrumbSegments = activeTab
    ? [workspaceInfo.name, ...activeTab.path.split("/").filter(Boolean)]
    : [workspaceInfo.name];

  const activeData = activeTab ? tabDataMap[activeTab.id] || null : null;
  const hasUnsavedChanges =
    activeTab &&
    activeTab.dirtyContent !== null &&
    activeTab.dirtyContent !== undefined &&
    activeData &&
    activeTab.dirtyContent !== activeData.content;

  return (
    <section
      aria-label="Artifact and Workspace Viewer Panel"
      style={{ width: `${viewerWidth}px` }}
      className="relative flex flex-col shrink-0 h-full border-l border-border/80 bg-card/95 select-none z-20"
    >
      {/* Left Resize Splitter */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleStartResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-primary/50 transition-colors z-30"
      />

      {/* Top Multi-Tab Bar (leaves right padding for native window controls) */}
      <div className="flex items-center justify-between gap-1 h-10 px-2 pr-32 border-b border-border/70 bg-sidebar/90 shrink-0">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 shrink-0 mr-1" role="tablist" aria-label="Right panel mode">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelMode === "viewer"}
            onClick={() => setRightPanelMode("viewer")}
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              rightPanelMode === "viewer" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Viewer
          </button>
          <button
            type="button"
            role="tab"
            data-testid="right-panel-feed-tab"
            aria-selected={rightPanelMode === "feed"}
            onClick={() => setRightPanelMode("feed")}
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              rightPanelMode === "feed" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Feed
          </button>
        </div>
        <div
          role="tablist"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0 flex-1 py-1"
        >
          {viewerTabs.length === 0 ? (
            <span className="text-xs text-muted-foreground px-2">
              Workspace Explorer
            </span>
          ) : (
            viewerTabs.map((t, idx) => {
              const isActive = t.id === activeTab?.id;
              const isDirty =
                t.dirtyContent !== null &&
                t.dirtyContent !== undefined &&
                tabDataMap[t.id] &&
                t.dirtyContent !== tabDataMap[t.id]?.content;

              return (
                <div
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  draggable
                  onDragStart={() => setDragTabIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragTabIndex !== null && dragTabIndex !== idx) {
                      reorderViewerTabs(dragTabIndex, idx);
                    }
                    setDragTabIndex(null);
                  }}
                  onClick={() => setActiveViewerTab(t.id)}
                  onAuxClick={(e) => {
                    // Middle-click closes tab
                    if (e.button === 1) {
                      e.preventDefault();
                      closeViewerTab(t.id);
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs cursor-pointer shrink-0 max-w-[180px] border transition-colors",
                    isActive
                      ? "bg-card text-foreground border-border/80 shadow-xs font-medium"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <FileText className="size-3 text-sky-400 shrink-0" />
                  <span className="truncate" title={t.path}>
                    {t.title}
                  </span>
                  {(isDirty || t.changedOnDisk) && (
                    <span
                      title={
                        t.changedOnDisk
                          ? "File changed on disk"
                          : "Unsaved changes"
                      }
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        t.changedOnDisk ? "bg-amber-400" : "bg-primary"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Close ${t.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeViewerTab(t.id);
                    }}
                    className="p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsViewerOpen(false)}
            aria-label="Close viewer panel"
            title="Collapse Viewer Panel"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
          >
            <PanelRightClose className="size-3.5" />
          </button>
        </div>
      </div>

      {rightPanelMode === "feed" ? (
        <FeedPaneTab />
      ) : (
      <>
      {/* Sub-bar: Breadcrumb + Preview/Raw Toggle + Actions (only shown when a file tab is active or sidebar is collapsed) */}
      {(activeTab || !isTreeOpen) && (
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-card/70 text-xs shrink-0">
        {/* Breadcrumb: workspace > folder > file */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden text-[11px] text-muted-foreground">
          {breadcrumbSegments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-50" />}
              <span
                className={cn(
                  "truncate",
                  i === breadcrumbSegments.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {seg}
              </span>
            </React.Fragment>
          ))}
          {hasUnsavedChanges && (
            <span className="ml-1 text-[10px] text-primary font-mono">(modified)</span>
          )}
        </div>

        {/* Viewer Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab && activeData && !activeData.isBinary && (
            <div className="flex items-center rounded-md border border-border/70 bg-background/60 p-0.5 mr-1">
              <button
                type="button"
                onClick={() => updateViewerTab(activeTab.id, { mode: "preview" })}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  activeTab.mode === "preview"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => updateViewerTab(activeTab.id, { mode: "raw" })}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  activeTab.mode === "raw"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Raw
              </button>
            </div>
          )}

          {activeTab && (
            <>
              <button
                type="button"
                onClick={() => refreshViewerTab(activeTab.id)}
                title="Refresh file"
                aria-label="Refresh file"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleCopyPath()}
                title="Copy relative path"
                aria-label="Copy relative path"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleRevealInExplorer()}
                title="Reveal in Windows Explorer"
                aria-label="Reveal in Windows Explorer"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <FolderOpen className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleOpenExternal(activeTab.path)}
                title="Open in default application"
                aria-label="Open in default application"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <ExternalLink className="size-3.5" />
              </button>
            </>
          )}

          {!isTreeOpen && (
            <button
              type="button"
              onClick={toggleTree}
              title="Toggle workspace file tree"
              className="ml-1 px-2 py-0.5 rounded-md border border-border/70 bg-card text-[11px] text-foreground/90 hover:bg-accent"
            >
              Toggle sidebar
            </button>
          )}
        </div>
      </div>
      )}

      {/* Changed-on-Disk Banner when Tab has Unsaved Edits */}
      {activeTab?.changedOnDisk && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Changed on disk while you have unsaved edits.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              updateViewerTab(activeTab.id, { dirtyContent: null, changedOnDisk: false });
              refreshViewerTab(activeTab.id);
            }}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium"
          >
            Reload from disk
          </button>
        </div>
      )}

      {/* Main Split Body: File Renderer (left) + Collapsible Workspace Tree (right) */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden select-text">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeTab ? (
            <FileContentRenderer
              tab={activeTab}
              data={activeData}
              loading={loadingTabId === activeTab.id}
              onUpdateTab={(patch) => updateViewerTab(activeTab.id, patch)}
              onOpenFilePath={(p) => openFileTab(p)}
              onOpenExternal={(p) => void handleOpenExternal(p)}
              onSaved={(newRev) => {
                updateViewerTab(activeTab.id, {
                  dirtyContent: null,
                  diskRevision: newRev,
                  changedOnDisk: false,
                });
                refreshViewerTab(activeTab.id);
                setTreeRefreshSignal((s) => s + 1);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
              <FileText className="size-7 opacity-40" />
              <div className="text-xs font-medium text-foreground/80">
                No file selected
              </div>
              <p className="text-[11px] max-w-xs">
                Click any file in the Workspace tree on the right, or click a file path mentioned in chat to inspect it here.
              </p>
            </div>
          )}
        </div>

        {isTreeOpen && (
          <WorkspaceFileTree
            workspaceName={workspaceInfo.name}
            workspaceId={workspaceInfo.id}
            refreshSignal={treeRefreshSignal}
            onRefresh={() => setTreeRefreshSignal((s) => s + 1)}
            onToggleSidebar={toggleTree}
          />
        )}
      </div>
      </>
      )}
    </section>
  );
};
