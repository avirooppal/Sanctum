"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  RotateCcw,
  Check,
  FileDiff,
  ChevronRight,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";
import type { EnrichedCheckpoint, FileDiffSummary, CheckpointDiffHunk } from "@core/infra/checkpoints/checkpoint_manager.ts";

interface TurnChangesSummaryCardProps {
  checkpointId?: string;
  changedFilesCount?: number;
  onOpenReview: (checkpointId?: string) => void;
}

export const TurnChangesSummaryCard: React.FC<TurnChangesSummaryCardProps> = ({
  checkpointId,
  onOpenReview,
}) => {
  const [cp, setCp] = useState<EnrichedCheckpoint | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "diff", checkpointId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && typeof data.filesChanged === "number") {
          setCp(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [checkpointId]);

  if (!cp || cp.filesChanged === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/90 px-3.5 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">
          {cp.filesChanged} {cp.filesChanged === 1 ? "file" : "files"} changed
        </span>
        <span className="font-mono text-emerald-400">+{cp.totalAdded}</span>
        <span className="font-mono text-rose-400">-{cp.totalRemoved}</span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </div>
      <button
        type="button"
        onClick={() => onOpenReview(cp.id)}
        className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/60 hover:bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition-colors"
      >
        <FileDiff className="size-3.5" />
        <span>Review</span>
      </button>
    </div>
  );
};

export const DiffReviewModal: React.FC = () => {
  const { activeDiffCheckpointId, setActiveDiffCheckpointId, openFileTab } = useAppStore(
    useShallow((s) => ({
      activeDiffCheckpointId: s.activeDiffCheckpointId,
      setActiveDiffCheckpointId: s.setActiveDiffCheckpointId,
      openFileTab: s.openFileTab,
    }))
  );

  const [cp, setCp] = useState<EnrichedCheckpoint | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [acceptedByFile, setAcceptedByFile] = useState<Record<string, Set<number>>>({});
  const [busy, setBusy] = useState(false);

  const loadCheckpointDiff = useCallback(async (cpId: string) => {
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "diff",
          checkpointId: cpId === "latest" ? "" : cpId,
        }),
      });
      if (!res.ok) return;
      const data: EnrichedCheckpoint = await res.json();
      setCp(data);
      const initialMap: Record<string, Set<number>> = {};
      for (const fd of data.fileDiffs || []) {
        initialMap[fd.path] = new Set(fd.hunks.map((h) => h.index));
      }
      setAcceptedByFile(initialMap);
      setSelectedFileIndex(0);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (activeDiffCheckpointId) {
      void loadCheckpointDiff(activeDiffCheckpointId);
    } else {
      setCp(null);
    }
  }, [activeDiffCheckpointId, loadCheckpointDiff]);

  if (!activeDiffCheckpointId || !cp) return null;

  const activeFileDiff: FileDiffSummary | undefined = cp.fileDiffs?.[selectedFileIndex];
  const acceptedSet = activeFileDiff
    ? acceptedByFile[activeFileDiff.path] || new Set<number>()
    : new Set<number>();

  const toggleHunk = (filePath: string, hunkIndex: number) => {
    setAcceptedByFile((prev) => {
      const next = new Set(prev[filePath] || []);
      if (next.has(hunkIndex)) next.delete(hunkIndex);
      else next.add(hunkIndex);
      return { ...prev, [filePath]: next };
    });
  };

  const handleApplyHunks = async (fileDiff: FileDiffSummary) => {
    if (busy) return;
    setBusy(true);
    try {
      const acceptedIndices = Array.from(acceptedByFile[fileDiff.path] || []);
      const res = await fetchWithApproval(
        "/api/checkpoints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply_hunks",
            checkpointId: cp.id,
            path: fileDiff.path,
            acceptedHunkIndices: acceptedIndices,
          }),
        },
        "checkpoint_rewind"
      );
      const updated = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Updated hunks for ${fileDiff.path}`);
        setCp(updated);
      } else {
        toast.error(updated.error || "Failed to apply hunk selection");
      }
    } catch {
      toast.error("Failed to apply hunk selection");
    } finally {
      setBusy(false);
    }
  };

  const handleRewindAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetchWithApproval(
        "/api/checkpoints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rewind",
            checkpointId: cp.id,
            mode: "files",
          }),
        },
        "checkpoint_rewind"
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          `Rewound ${(body.restoredFiles?.length || 0) + (body.deletedFiles?.length || 0)} file(s) to pre-turn state`
        );
        setActiveDiffCheckpointId(null);
      } else {
        toast.error(body.error || "Rewind failed");
      }
    } catch {
      toast.error("Rewind failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review file changes and hunks"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
    >
      <div className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-sidebar">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="size-4 text-primary" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Review Workspace Changes ({cp.filesChanged} files ·{" "}
                <span className="text-emerald-400 font-mono">+{cp.totalAdded}</span>{" "}
                <span className="text-rose-400 font-mono">-{cp.totalRemoved}</span>)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Accept or reject individual hunks, or rewind the entire turn checkpoint ({cp.id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRewindAll()}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive transition-colors disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              <span>Rewind All Files</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDiffCheckpointId(null)}
              aria-label="Close diff review"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left File List */}
          <aside className="w-60 shrink-0 border-r border-border/70 bg-sidebar/50 overflow-y-auto p-2 space-y-1">
            {(cp.fileDiffs || []).map((fd, idx) => (
              <button
                key={fd.path}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={cn(
                  "flex items-center justify-between gap-2 w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                  idx === selectedFileIndex
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="truncate flex-1" title={fd.path}>
                  {fd.path}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                  <span className="text-emerald-400">+{fd.added}</span>
                  <span className="text-rose-400">-{fd.removed}</span>
                </span>
              </button>
            ))}
          </aside>

          {/* Right Hunk Diff Viewer */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {activeFileDiff ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-foreground">
                      {activeFileDiff.path}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {activeFileDiff.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        openFileTab(activeFileDiff.path);
                        setActiveDiffCheckpointId(null);
                      }}
                      className="px-2.5 py-1 rounded border border-border text-[11px] hover:bg-accent"
                    >
                      Open in Viewer
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleApplyHunks(activeFileDiff)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50"
                    >
                      <Check className="size-3" />
                      <span>Apply Selected Hunks</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
                  {activeFileDiff.hunks.map((hunk: CheckpointDiffHunk) => {
                    const isAccepted = acceptedSet.has(hunk.index);
                    return (
                      <div
                        key={hunk.index}
                        className={cn(
                          "rounded-xl border overflow-hidden",
                          isAccepted ? "border-border/80" : "border-rose-500/40 opacity-70"
                        )}
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border/60 text-[11px]">
                          <span className="text-muted-foreground">{hunk.header}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleHunk(activeFileDiff.path, hunk.index)}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-sans font-medium border transition-colors",
                                isAccepted
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                  : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                              )}
                            >
                              {isAccepted ? "Accepted (Click to Reject)" : "Rejected (Click to Accept)"}
                            </button>
                          </div>
                        </div>
                        <div className="divide-y divide-border/20">
                          {hunk.lines.map((line, lIdx) => (
                            <div
                              key={lIdx}
                              className={cn(
                                "flex px-2 py-0.5 whitespace-pre overflow-x-auto",
                                line.type === "add" && "bg-emerald-500/10 text-emerald-300",
                                line.type === "del" && "bg-rose-500/10 text-rose-300",
                                line.type === "context" && "text-foreground/80"
                              )}
                            >
                              <span className="w-8 shrink-0 select-none text-right pr-2 text-muted-foreground/50">
                                {line.oldLine > 0 ? line.oldLine : ""}
                              </span>
                              <span className="w-8 shrink-0 select-none text-right pr-2 text-muted-foreground/50">
                                {line.newLine > 0 ? line.newLine : ""}
                              </span>
                              <span className="w-4 shrink-0 select-none text-center">
                                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                              </span>
                              <span className="flex-1">{line.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                No changed files remaining in this checkpoint.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
