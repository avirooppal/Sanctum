"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Code2,
  FolderGit2,
  PackageCheck,
  Download,
  ChevronDown,
  Search,
  FileText,
  Sparkles,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DetectedIde {
  id: string;
  name: string;
  executable?: string;
}

export const WorkspaceHeaderActions: React.FC<{
  onOpenSettings?: () => void;
  sessionTitle?: string;
  expanded?: boolean;
  hideBreadcrumb?: boolean;
}> = ({ onOpenSettings, sessionTitle, expanded = false, hideBreadcrumb = false }) => {
  const {
    viewerTabs,
    activeViewerTabId,
    openFileTab,
    closeViewerTab,
    setActiveViewerTab,
    toggleViewer,
    setIsViewerOpen,
    setIsTreeOpen,
    toggleExplorer,
    deliverables,
    updateAvailableInfo,
  } = useAppStore(
    useShallow((s) => ({
      viewerTabs: s.viewerTabs,
      activeViewerTabId: s.activeViewerTabId,
      openFileTab: s.openFileTab,
      closeViewerTab: s.closeViewerTab,
      setActiveViewerTab: s.setActiveViewerTab,
      toggleViewer: s.toggleViewer,
      setIsViewerOpen: s.setIsViewerOpen,
      setIsTreeOpen: s.setIsTreeOpen,
      toggleExplorer: s.toggleExplorer,
      deliverables: s.deliverables,
      updateAvailableInfo: s.updateAvailableInfo,
    }))
  );

  const [workspaceName, setWorkspaceName] = useState("workspace");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [detectedIdes, setDetectedIdes] = useState<DetectedIde[]>([]);
  const [selectedIdeId, setSelectedIdeId] = useState<string>("code");
  const [ideMenuOpen, setIdeMenuOpen] = useState(false);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  // Quick-Open (Ctrl+P) state
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [quickOpenFiles, setQuickOpenFiles] = useState<string[]>([]);

  const refreshWorkspaceAndIdes = useCallback(async () => {
    try {
      const wsRes = await fetch("/api/workspace");
      if (wsRes.ok) {
        const ws = await wsRes.json();
        const root = String(ws.root || "");
        setWorkspaceRoot(root);
        const parts = root.replace(/\\/g, "/").split("/").filter(Boolean);
        setWorkspaceName(parts[parts.length - 1] || "workspace");
      }
    } catch {}

    try {
      const ideRes = await fetch("/api/ide/detect");
      if (ideRes.ok) {
        const data = await ideRes.json();
        const list: DetectedIde[] = Array.isArray(data.ides) ? data.ides : [];
        setDetectedIdes(list);
        if (data.preferred) {
          setSelectedIdeId(String(data.preferred));
        } else if (list.length > 0) {
          setSelectedIdeId(list[0].id);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshWorkspaceAndIdes();
    const wv = (window as any).chrome?.webview;
    const onMsg = (e: any) => {
      if (e.data?.type === "toolWorkspaceChanged") {
        void refreshWorkspaceAndIdes();
      }
    };
    wv?.addEventListener("message", onMsg);
    return () => wv?.removeEventListener("message", onMsg);
  }, [refreshWorkspaceAndIdes]);

  // Global keyboard shortcuts:
  // Ctrl+B (left sidebar), Ctrl+\ (right viewer), Ctrl+P (quick-open),
  // Ctrl+W (close active viewer tab), Ctrl+Tab (next viewer tab), Ctrl+Shift+E (focus file tree)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key.toLowerCase() === "b" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleExplorer();
        return;
      }

      if (e.key === "\\" || e.code === "Backslash") {
        e.preventDefault();
        toggleViewer();
        return;
      }

      if (e.key.toLowerCase() === "p" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setQuickOpenVisible((v) => !v);
        setQuickOpenQuery("");
        return;
      }

      if (e.key.toLowerCase() === "w" && !e.shiftKey && !e.altKey) {
        if (activeViewerTabId) {
          e.preventDefault();
          closeViewerTab(activeViewerTabId);
        }
        return;
      }

      if (e.key === "Tab") {
        if (viewerTabs.length > 1) {
          e.preventDefault();
          const idx = viewerTabs.findIndex((t) => t.id === activeViewerTabId);
          const nextIdx = (idx + 1) % viewerTabs.length;
          setActiveViewerTab(viewerTabs[nextIdx].id);
        }
        return;
      }

      if (e.key.toLowerCase() === "e" && e.shiftKey) {
        e.preventDefault();
        setIsViewerOpen(true);
        setIsTreeOpen(true);
        window.dispatchEvent(new CustomEvent("sanctum:focus-file-tree"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeViewerTabId,
    viewerTabs,
    toggleExplorer,
    toggleViewer,
    closeViewerTab,
    setActiveViewerTab,
    setIsViewerOpen,
    setIsTreeOpen,
  ]);

  // Load files for Quick-Open (Ctrl+P)
  useEffect(() => {
    if (!quickOpenVisible) return;
    let cancelled = false;
    fetch("/api/fs/tree?path=")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.entries)) return;
        const files = data.entries
          .filter((e: any) => e.type === "file")
          .map((e: any) => String(e.path));
        setQuickOpenFiles(files);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quickOpenVisible]);

  const handleOpenIde = async (ideOverride?: string) => {
    const ideToUse = ideOverride || selectedIdeId || "code";
    const activeTab = viewerTabs.find((t) => t.id === activeViewerTabId);
    const fileArg = activeTab ? activeTab.path : undefined;
    const lineArg = activeTab?.jumpLine || 1;

    try {
      const res = await fetchWithApproval(
        "/api/ide/open",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ideId: ideToUse,
            file: fileArg,
            line: lineArg,
          }),
        },
        "ide_open"
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          `Opened ${fileArg ? `${fileArg}:${lineArg}` : workspaceName} in ${data.ide || ideToUse}`
        );
      } else {
        toast.error(data.error || "Could not launch IDE");
      }
    } catch {
      toast.error("Failed to launch IDE");
    }
  };

  const handleExportDeliverablesZip = async () => {
    if (deliverables.length === 0 || exportingZip) return;
    setExportingZip(true);
    try {
      const paths = deliverables.map((d) => d.path);
      const res = await fetch("/api/fs/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paths,
          archiveName: `${workspaceName.toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "sanctum"}-deliverables.zip`,
          saveToWorkspace: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to export deliverables ZIP");
        return;
      }
      if (data.zipBase64) {
        const binary = atob(data.zipBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.archiveName || "sanctum-deliverables.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(
        `Exported ${data.fileCount} deliverable(s) (${data.savedPath || data.archiveName})`
      );
      setDeliverablesOpen(false);
    } catch {
      toast.error("Failed to export deliverables ZIP");
    } finally {
      setExportingZip(false);
    }
  };

  const handleSelectWorkspaceFolder = () => {
    const wv = (window as any).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type: "selectToolWorkspace" }));
    } else {
      toast.info("Use the desktop host window to browse for a workspace folder.");
    }
  };

  const filteredQuickOpen = quickOpenFiles
    .filter((f) => f.toLowerCase().includes(quickOpenQuery.toLowerCase()))
    .slice(0, 12);

  return (
    <>
      <div className="flex items-center justify-between gap-2 min-w-0 flex-1" data-no-drag>
        {/* Left: Minimal Workspace / Session Title Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0 truncate text-xs">
          {expanded && (
            <button
              type="button"
              onClick={handleSelectWorkspaceFolder}
              title={
                workspaceRoot
                  ? `Workspace: ${workspaceRoot}\nClick to change folder`
                  : "Select workspace folder"
              }
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            >
              <FolderGit2 className="size-3.5 text-primary/80 shrink-0" />
              <span className="font-medium text-foreground/90 max-w-[120px] truncate">
                {workspaceName}
              </span>
            </button>
          )}
          {!hideBreadcrumb && sessionTitle && (
            <>
              {expanded && <span className="text-muted-foreground/40">/</span>}
              <span className="text-muted-foreground truncate max-w-[240px]">
                {sessionTitle}
              </span>
            </>
          )}
        </div>

        {/* Right: Compact Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {updateAvailableInfo && (
            <button
              type="button"
              onClick={onOpenSettings}
              title={updateAvailableInfo.releaseNotes}
              className="flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/30 transition-colors"
            >
              <Sparkles className="size-3" />
              <span>Update v{updateAvailableInfo.latestVersion}</span>
            </button>
          )}

          {/* Deliverables Pill (only visible when deliverables exist in session, keeping UI minimal) */}
          {deliverables.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDeliverablesOpen((v) => !v)}
                title="Session Deliverables & Export as ZIP"
                className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <PackageCheck className="size-3.5" />
                <span className="font-mono text-[10px]">{deliverables.length}</span>
              </button>

              {deliverablesOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-72 rounded-xl border border-border/80 bg-popover p-2.5 shadow-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="font-semibold text-foreground">
                      Deliverables ({deliverables.length})
                    </span>
                    <button
                      type="button"
                      disabled={exportingZip}
                      onClick={() => void handleExportDeliverablesZip()}
                      className="flex items-center gap-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary px-2 py-0.5 text-[11px] font-medium"
                    >
                      <Download className="size-3" />
                      <span>{exportingZip ? "Zipping…" : "Export as ZIP"}</span>
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {deliverables.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          openFileTab(d.path, { title: d.title });
                          setDeliverablesOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="size-3.5 text-sky-400 shrink-0" />
                          <span className="font-mono text-[11px] text-foreground truncate">
                            {d.path}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {d.timestamp}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Open IDE Button (shown when header workspace controls are expanded) */}
          {expanded && (
            <div className="relative flex items-center rounded-lg border border-border/60 bg-card/80">
              <button
                type="button"
                onClick={() => void handleOpenIde()}
                title={`Open ${workspaceName} in ${selectedIdeId}`}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Code2 className="size-3.5 text-muted-foreground" />
                <span>Open IDE</span>
              </button>
              {detectedIdes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIdeMenuOpen((v) => !v)}
                  aria-label="Choose IDE"
                  className="px-1 py-1 border-l border-border/60 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="size-3" />
                </button>
              )}

              {ideMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-xl border border-border/80 bg-popover p-1 shadow-xl text-xs">
                  {detectedIdes.map((ide) => (
                    <button
                      key={ide.id}
                      type="button"
                      onClick={() => {
                        setSelectedIdeId(ide.id);
                        setIdeMenuOpen(false);
                        void handleOpenIde(ide.id);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-muted/70",
                        selectedIdeId === ide.id && "text-primary font-medium"
                      )}
                    >
                      <span>{ide.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {ide.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick-Open Workspace File Modal (Ctrl+P) */}
      {quickOpenVisible && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-xs"
          onClick={() => setQuickOpenVisible(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/80 bg-popover p-3 shadow-2xl space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/60 pb-2 px-1">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                autoFocus
                value={quickOpenQuery}
                onChange={(e) => setQuickOpenQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuickOpenVisible(false);
                  if (e.key === "Enter" && filteredQuickOpen.length > 0) {
                    openFileTab(filteredQuickOpen[0]);
                    setQuickOpenVisible(false);
                  }
                }}
                placeholder="Quick open file in workspace (Ctrl+P)…"
                className="flex-1 bg-transparent text-xs text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickOpenVisible(false)}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filteredQuickOpen.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No matching files in workspace
                </div>
              ) : (
                filteredQuickOpen.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      openFileTab(f);
                      setQuickOpenVisible(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-mono text-foreground hover:bg-muted/70"
                  >
                    <FileText className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">{f}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
