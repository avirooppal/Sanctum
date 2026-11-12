"use client";

import React from "react";
import { ShieldAlert, Terminal, FileEdit, Trash2, FolderPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

const SHELL_TOOLS = new Set(["run_command", "start_background", "stop_background"]);

export const ToolApprovalModal: React.FC = () => {
  const pending = useAppStore((s) => s.pendingToolApproval);
  const resolveToolApproval = useAppStore((s) => s.resolveToolApproval);

  if (!pending) return null;

  const { toolName, arguments: args } = pending;
  const isShell = SHELL_TOOLS.has(toolName);
  const isDelete = toolName === "delete_path";

  const renderDetails = () => {
    if (isShell) {
      return (
        <div className="space-y-2 text-xs">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground mb-1">Command</div>
            <pre className="rounded-lg border border-amber-500/30 bg-black/40 p-2.5 font-mono text-amber-200 whitespace-pre-wrap break-all">
              {String(args.command || args.taskId || "")}
            </pre>
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground mb-1">Working Directory (cwd)</div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 font-mono text-foreground break-all">
              {String(args.cwd || "(workspace root)")}
            </div>
          </div>
        </div>
      );
    }

    if (toolName === "edit_file" || toolName === "apply_patch") {
      return (
        <div className="space-y-2 text-xs">
          <div className="font-mono text-foreground/90">Path: {String(args.path || "")}</div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/70 bg-black/40 p-2.5 font-mono text-[11px] space-y-1.5">
            {String(args.old_text || "")
              .split(/\r?\n/)
              .map((line, i) => (
                <div key={`old-${i}`} className="text-red-300 bg-red-500/10 px-1 rounded whitespace-pre-wrap break-all">
                  - {line}
                </div>
              ))}
            {String(args.new_text || "")
              .split(/\r?\n/)
              .map((line, i) => (
                <div key={`new-${i}`} className="text-emerald-300 bg-emerald-500/10 px-1 rounded whitespace-pre-wrap break-all">
                  + {line}
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (toolName === "create_file") {
      const content = String(args.content || "");
      const preview = content.length > 1200 ? `${content.slice(0, 1200)}\n... (${content.length - 1200} more chars)` : content;
      return (
        <div className="space-y-2 text-xs">
          <div className="font-mono text-foreground/90">Create: {String(args.path || "")}</div>
          <pre className="max-h-48 overflow-y-auto rounded-lg border border-emerald-500/30 bg-black/40 p-2.5 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap break-all">
            {preview}
          </pre>
        </div>
      );
    }

    if (toolName === "move_path") {
      return (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 font-mono text-xs text-foreground break-all">
          Move: {String(args.path || "")} &rarr; {String(args.destination || "")}
        </div>
      );
    }

    return null;
  };

  const Icon = isShell ? Terminal : isDelete ? Trash2 : toolName === "create_directory" ? FolderPlus : FileEdit;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) resolveToolApproval("denied", "once");
      }}
    >
      <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl rounded-2xl p-5">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <ShieldAlert size={18} />
            <span>Approve Tool Execution?</span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
            <Icon size={13} className="text-foreground shrink-0" />
            <span>
              Tool <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{toolName}</code> requested permission to modify host state.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {renderDetails()}
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Raw arguments</summary>
            <pre className="mt-1.5 max-h-36 overflow-auto rounded-lg border border-border/50 bg-black/30 p-2 font-mono text-[10px] text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(args, null, 2)}
            </pre>
          </details>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => resolveToolApproval("denied", "once")}
            className="rounded-xl text-xs"
          >
            Deny
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => resolveToolApproval("approved", "session")}
            className="rounded-xl text-xs"
          >
            Approve for this session
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => resolveToolApproval("approved", "once")}
            className="rounded-xl text-xs"
          >
            Approve once
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
