"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  RotateCcw,
  FileText,
  MessageSquare,
  RefreshCw,
  X,
  AlertCircle,
  FileDiff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Checkpoint } from "@core/infra/checkpoints/checkpoint_manager.ts";

interface CheckpointDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationRestored?: (messages: any[]) => void;
}

export const CheckpointDrawer: React.FC<CheckpointDrawerProps> = ({
  isOpen,
  onClose,
  onConversationRestored,
}) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [isRewinding, setIsRewinding] = useState(false);

  const fetchCheckpoints = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/checkpoints?limit=20");
      if (res.ok) {
        const data = await res.json();
        setCheckpoints(data.checkpoints || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCheckpoints();
    }
  }, [isOpen]);

  const handleRewind = async (mode: "files" | "conversation" | "both") => {
    if (!selectedCheckpoint) return;
    setIsRewinding(true);

    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rewind",
          checkpointId: selectedCheckpoint.id,
          mode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Rewound successfully (${mode})`);
        if (data.restoredConversation && onConversationRestored) {
          onConversationRestored(data.restoredConversation);
        }
        onClose();
      } else {
        toast.error(data.error || "Rewind failed");
      }
    } catch {
      toast.error("Network error during rewind");
    } finally {
      setIsRewinding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0d0e14]/95 backdrop-blur-2xl border border-border shadow-2xl rounded-2xl p-6 flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground">
                  File & Turn Checkpoints
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Rollback file modifications or restore earlier conversation states.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchCheckpoints}
              disabled={isLoading}
              className="h-7 text-xs rounded-lg flex items-center gap-1"
            >
              <RefreshCw size={11} className={cn(isLoading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1">
          {isLoading ? (
            <p className="text-center py-10 text-muted-foreground text-xs">Loading snapshots...</p>
          ) : checkpoints.length === 0 ? (
            <div className="text-center py-10 space-y-1">
              <p className="text-muted-foreground text-xs">No checkpoints recorded yet.</p>
              <p className="text-[11px] text-muted-foreground/60">
                Checkpoints are automatically created before file edits and agent turns.
              </p>
            </div>
          ) : (
            checkpoints.map((cp) => {
              const isSelected = selectedCheckpoint?.id === cp.id;
              return (
                <div
                  key={cp.id}
                  onClick={() => setSelectedCheckpoint(cp)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5",
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-card/40 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[340px]">
                      {cp.summary}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(cp.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileDiff size={12} className="text-primary" />
                      {cp.files.length} affected file{cp.files.length === 1 ? "" : "s"}
                    </span>
                    {cp.conversationSnapshot && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} className="text-sky-400" />
                        Chat turn saved
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <div className="pt-2 border-t border-border/40 mt-1 flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[260px]">
                        ID: {cp.id}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRewinding}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRewind("files");
                          }}
                          className="h-6 px-2 text-[10px] rounded-lg flex items-center gap-1"
                        >
                          <FileText size={10} /> Rewind Files
                        </Button>
                        {cp.conversationSnapshot && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRewinding}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRewind("conversation");
                            }}
                            className="h-6 px-2 text-[10px] rounded-lg flex items-center gap-1"
                          >
                            <MessageSquare size={10} /> Rewind Chat
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={isRewinding}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRewind("both");
                          }}
                          className="h-6 px-2 text-[10px] rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1 font-medium"
                        >
                          <RotateCcw size={10} /> Rewind Both
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
