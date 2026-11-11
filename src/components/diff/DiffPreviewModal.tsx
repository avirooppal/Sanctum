"use client";

import React, { useState } from "react";
import {
  Check,
  X,
  FileCode,
  CheckCheck,
  RotateCcw,
  Plus,
  Minus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StructuredDiff, DiffHunk } from "@core/infra/diff/diff_engine.ts";

interface DiffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  diff: StructuredDiff | null;
  onApplyHunks: (acceptedHunks: DiffHunk[]) => void;
}

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  onClose,
  diff,
  onApplyHunks,
}) => {
  const [hunks, setHunks] = useState<DiffHunk[]>(diff?.hunks || []);

  React.useEffect(() => {
    if (diff?.hunks) {
      setHunks(diff.hunks.map((h) => ({ ...h, status: "accepted" })));
    }
  }, [diff]);

  if (!diff) return null;

  const toggleHunk = (hunkId: string) => {
    setHunks((prev) =>
      prev.map((h) =>
        h.id === hunkId ? { ...h, status: h.status === "accepted" ? "rejected" : "accepted" } : h
      )
    );
  };

  const handleAcceptAll = () => {
    setHunks((prev) => prev.map((h) => ({ ...h, status: "accepted" })));
  };

  const handleRejectAll = () => {
    setHunks((prev) => prev.map((h) => ({ ...h, status: "rejected" })));
  };

  const handleConfirm = () => {
    onApplyHunks(hunks);
    onClose();
  };

  const acceptedCount = hunks.filter((h) => h.status === "accepted").length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#0d0e14]/95 backdrop-blur-2xl border border-border shadow-2xl rounded-2xl p-6 flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FileCode className="size-5 text-primary" />
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>Review File Diff</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-card border border-border/80 text-muted-foreground">
                    {diff.filePath}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Accept or reject specific hunks before changes are written to disk.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-0.5">
                <Plus size={12} /> {diff.totalAdditions}
              </span>
              <span className="text-red-400 flex items-center gap-0.5">
                <Minus size={12} /> {diff.totalDeletions}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Global Bulk Actions */}
        <div className="flex items-center justify-between py-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {acceptedCount} of {hunks.length} hunks accepted
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              className="h-7 text-xs rounded-lg flex items-center gap-1"
            >
              <CheckCheck size={12} /> Accept All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectAll}
              className="h-7 text-xs rounded-lg flex items-center gap-1 text-muted-foreground hover:text-red-400"
            >
              <RotateCcw size={12} /> Reject All
            </Button>
          </div>
        </div>

        {/* Hunk List View */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
          {hunks.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No line changes detected.</p>
          ) : (
            hunks.map((hunk) => {
              const isAccepted = hunk.status === "accepted";
              return (
                <div
                  key={hunk.id}
                  className={cn(
                    "rounded-xl border transition-all overflow-hidden",
                    isAccepted
                      ? "border-emerald-500/40 bg-card/60"
                      : "border-border/60 bg-muted/20 opacity-60"
                  )}
                >
                  {/* Hunk Header */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#14151e] border-b border-border/50 text-[11px]">
                    <span className="text-muted-foreground">{hunk.header}</span>
                    <button
                      type="button"
                      onClick={() => toggleHunk(hunk.id)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1",
                        isAccepted
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {isAccepted ? <Check size={10} /> : <X size={10} />}
                      {isAccepted ? "Accepted" : "Rejected"}
                    </button>
                  </div>

                  {/* Hunk Lines */}
                  <div className="p-2 space-y-0.5 overflow-x-auto text-[11px]">
                    {hunk.lines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className={cn(
                          "flex items-start px-1.5 py-0.5 rounded font-mono select-text",
                          line.type === "addition" && "bg-emerald-500/15 text-emerald-300",
                          line.type === "deletion" && "bg-red-500/15 text-red-300",
                          line.type === "context" && "text-muted-foreground/90"
                        )}
                      >
                        <span className="w-10 shrink-0 text-muted-foreground/50 select-none text-right pr-2">
                          {line.oldLineNumber || line.newLineNumber || ""}
                        </span>
                        <span className="w-4 shrink-0 select-none font-bold">
                          {line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " "}
                        </span>
                        <span className="whitespace-pre-wrap break-all flex-1">{line.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-4 gap-2 shrink-0 border-t border-border/60 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={acceptedCount === 0}
            className="rounded-xl text-xs bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
          >
            <Check size={14} /> Apply Accepted Hunks ({acceptedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
