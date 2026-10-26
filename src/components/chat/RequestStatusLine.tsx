"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  Clock,
  Sparkles,
  Search,
  Wrench,
  AlertCircle,
  Square,
  RefreshCw,
  Cpu,
  Brain,
  CheckCircle2,
  Hourglass,
  Layers,
} from "lucide-react";
import type { RequestStatusEvent, RequestPhase } from "@/types";
import { cn } from "@/lib/utils";

interface RequestStatusLineProps {
  status?: RequestStatusEvent;
  onStop?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const RequestStatusLine: React.FC<RequestStatusLineProps> = ({
  status,
  onStop,
  onRetry,
  className,
}) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  useEffect(() => {
    if (!status) return;
    const initialElapsed = Math.floor(status.elapsed_ms / 1000);
    setElapsedSec(initialElapsed);

    const isFinished = ["done", "stopped", "cancelled", "error"].includes(status.phase);
    if (isFinished) return;

    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.phase, status?.elapsed_ms]);

  if (!status) return null;

  const phase = status.phase;
  const isFinished = ["done", "stopped", "cancelled"].includes(phase);
  const isError = phase === "error";
  const isStalled = phase === "stalled";

  // Visual phase indicator and descriptive label
  const renderPhaseContent = () => {
    switch (phase) {
      case "sending":
        return {
          icon: <Loader2 className="size-3.5 animate-spin text-muted-foreground" />,
          title: "Sending message...",
          badge: "Dispatch",
          color: "text-muted-foreground",
        };
      case "queued":
        return {
          icon: <Hourglass className="size-3.5 animate-pulse text-amber-500" />,
          title: status.detail || "Queued in engine lane",
          badge: status.progress ? `Queue #${status.progress.current}` : "Queued",
          color: "text-amber-500",
        };
      case "loading_model":
        return {
          icon: <Cpu className="size-3.5 animate-spin text-blue-500" />,
          title: status.detail || "Loading weights into VRAM...",
          badge: status.progress?.percentage !== undefined ? `${status.progress.percentage}%` : "Loading",
          color: "text-blue-500",
        };
      case "reading_message":
        return {
          icon: <Layers className="size-3.5 animate-pulse text-sky-500" />,
          title: status.detail || "Processing prompt tokens...",
          badge: status.progress ? `${status.progress.current}/${status.progress.total} tok` : "Reading",
          color: "text-sky-500",
        };
      case "searching_documents":
        return {
          icon: <Search className="size-3.5 animate-spin text-purple-500" />,
          title: status.detail || "Searching Vault RAG documents...",
          badge: status.progress ? `${status.progress.current} passages` : "RAG Search",
          color: "text-purple-500",
        };
      case "thinking":
        return {
          icon: <Brain className="size-3.5 animate-pulse text-indigo-400" />,
          title: status.detail || "Reasoning trace active...",
          badge: "Thinking",
          color: "text-indigo-400",
        };
      case "using_tool":
        return {
          icon: <Wrench className="size-3.5 animate-bounce text-emerald-500" />,
          title: status.tool_call ? `Using tool: ${status.tool_call.name}` : "Executing local tool...",
          badge: status.tool_call?.name || "Tool",
          color: "text-emerald-500",
        };
      case "waiting_approval":
        return {
          icon: <AlertCircle className="size-3.5 text-amber-500 animate-pulse" />,
          title: "Waiting for your tool execution approval",
          badge: "Gated Action",
          color: "text-amber-500",
        };
      case "writing_answer":
        return {
          icon: <Sparkles className="size-3.5 text-primary animate-pulse" />,
          title: "Writing response...",
          badge: status.stats?.tokens_per_second
            ? `${status.stats.tokens_per_second.toFixed(1)} tok/s`
            : "Generating",
          color: "text-primary",
        };
      case "finishing":
        return {
          icon: <CheckCircle2 className="size-3.5 text-emerald-500" />,
          title: "Finalizing response & caching context...",
          badge: "Finishing",
          color: "text-emerald-500",
        };
      case "stalled":
        return {
          icon: <AlertCircle className="size-3.5 text-rose-500" />,
          title: status.detail || "No response received from engine",
          badge: "Stalled",
          color: "text-rose-500",
        };
      case "error":
        return {
          icon: <AlertCircle className="size-3.5 text-rose-500" />,
          title: status.error?.message || status.detail || "Inference error encountered",
          badge: status.error?.code || "Failed",
          color: "text-rose-500",
        };
      case "stopped":
        return {
          icon: <Square className="size-3.5 text-muted-foreground" />,
          title: "Generation stopped by user",
          badge: "Stopped",
          color: "text-muted-foreground",
        };
      case "cancelled":
        return {
          icon: <Square className="size-3.5 text-muted-foreground" />,
          title: "Request cancelled",
          badge: "Cancelled",
          color: "text-muted-foreground",
        };
      case "done":
      default:
        return {
          icon: <CheckCircle2 className="size-3.5 text-emerald-500" />,
          title: "Completed",
          badge: "Done",
          color: "text-emerald-500",
        };
    }
  };

  const current = renderPhaseContent();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs backdrop-blur-sm transition-all duration-200 select-none",
        isError && "border-rose-500/40 bg-rose-500/10 text-rose-300",
        isStalled && "border-amber-500/40 bg-amber-500/10 text-amber-300",
        className
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {current.icon}
        <span className={cn("font-medium", current.color)}>{current.badge}</span>
      </div>

      <span className="text-muted-foreground/40 font-mono text-[10px]">•</span>

      <span className="text-foreground/80 truncate max-w-[280px]" title={current.title}>
        {current.title}
      </span>

      <span className="text-muted-foreground/40 font-mono text-[10px]">•</span>

      <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
        <Clock className="size-3 opacity-60" />
        <span>{elapsedSec}s</span>
      </div>

      {status.stats?.tokens_generated !== undefined && status.stats.tokens_generated > 0 && (
        <>
          <span className="text-muted-foreground/40 font-mono text-[10px]">•</span>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {status.stats.tokens_generated} tok
          </span>
        </>
      )}

      {/* Action controls */}
      {!isFinished && !isError && onStop && (
        <button
          type="button"
          onClick={onStop}
          className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Stop inference request"
        >
          <Square className="size-2.5 fill-current" />
          <span>Stop</span>
        </button>
      )}

      {(isError || isStalled) && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/30 transition-colors"
          title="Retry request"
        >
          <RefreshCw className="size-2.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};
