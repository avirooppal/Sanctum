/**
 * Request Status State Machine (AMENDMENT 1)
 * Enforces strictly valid phase transitions, calculates real elapsed durations and TTFT,
 * and handles timeout/stall detection.
 */

import type { RequestPhase, RequestStatusEvent, RequestStatusProgress } from "../../contracts/types/index.ts";

export interface StateMachineListener {
  (event: RequestStatusEvent): void;
}

export class RequestStatusTracker {
  private requestId: string;
  private threadId: string;
  private messageId: string;
  private currentPhase: RequestPhase = "sending";
  private startTime: number;
  private firstTokenTime: number | null = null;
  private listeners: Set<StateMachineListener> = new Set();
  private stallTimer: any = null;
  private stallTimeoutMs: number;
  private lastEvent: RequestStatusEvent;

  // Transition validation map matching docs/design/INTERACTION.md
  private static readonly LEGAL_TRANSITIONS: Record<RequestPhase, RequestPhase[]> = {
    sending: ["stopped", "queued", "loading_model", "reading_message", "error"],
    queued: ["loading_model", "reading_message", "cancelled"],
    loading_model: ["reading_message", "cancelled", "error"],
    reading_message: ["stopped", "finishing", "searching_documents", "thinking", "using_tool", "writing_answer", "error"],
    searching_documents: ["stopped", "reading_message", "finishing", "thinking", "writing_answer", "error"],
    thinking: ["using_tool", "writing_answer", "stopped", "error"],
    using_tool: ["waiting_approval", "thinking", "writing_answer", "error"],
    waiting_approval: ["using_tool", "thinking", "writing_answer", "cancelled"],
    writing_answer: ["stalled", "finishing", "stopped", "error"],
    stalled: ["finishing", "writing_answer", "stopped", "error"],
    finishing: ["done", "error"],
    done: [],
    stopped: [],
    cancelled: [],
    error: [],
  };

  constructor(options: {
    requestId: string;
    threadId: string;
    messageId: string;
    stallTimeoutMs?: number;
  }) {
    this.requestId = options.requestId;
    this.threadId = options.threadId;
    this.messageId = options.messageId;
    this.stallTimeoutMs = options.stallTimeoutMs ?? 5000;
    this.startTime = Date.now();

    this.lastEvent = {
      request_id: this.requestId,
      thread_id: this.threadId,
      message_id: this.messageId,
      phase: "sending",
      timestamp: this.startTime,
      elapsed_ms: 0,
      detail: "Sending message...",
    };
  }

  public subscribe(listener: StateMachineListener): () => void {
    this.listeners.add(listener);
    listener(this.lastEvent);
    return () => this.listeners.delete(listener);
  }

  public getCurrentPhase(): RequestPhase {
    return this.currentPhase;
  }

  public getLastEvent(): RequestStatusEvent {
    return this.lastEvent;
  }

  private resetStallTimer() {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }

    // Only monitor stalls during actively waiting phases
    const activeWaitPhases: RequestPhase[] = ["writing_answer", "thinking", "searching_documents", "loading_model"];
    if (activeWaitPhases.includes(this.currentPhase)) {
      this.stallTimer = setTimeout(() => {
        this.transition("stalled", {
          detail: `No response from engine for ${(this.stallTimeoutMs / 1000).toFixed(0)}s`,
        });
      }, this.stallTimeoutMs);
    }
  }

  public transition(
    toPhase: RequestPhase,
    meta?: {
      detail?: string;
      progress?: RequestStatusProgress;
      stats?: RequestStatusEvent["stats"];
      tool_call?: RequestStatusEvent["tool_call"];
      error?: RequestStatusEvent["error"];
    }
  ): boolean {
    const isTerminal = ["done", "stopped", "cancelled", "error"].includes(this.currentPhase);
    if (isTerminal) {
      return false;
    }

    if (toPhase !== this.currentPhase) {
      const allowed = RequestStatusTracker.LEGAL_TRANSITIONS[this.currentPhase] || [];
      if (!allowed.includes(toPhase)) {
        // Disallowed transition
        return false;
      }
    }

    const now = Date.now();
    const elapsed = now - this.startTime;

    if (toPhase === "writing_answer" && !this.firstTokenTime) {
      this.firstTokenTime = now;
    }

    this.currentPhase = toPhase;

    let mergedStats = meta?.stats ? { ...meta.stats } : undefined;
    if (this.firstTokenTime) {
      mergedStats = {
        time_to_first_token_ms: this.firstTokenTime - this.startTime,
        total_time_ms: elapsed,
        ...mergedStats,
      };
    }

    this.lastEvent = {
      request_id: this.requestId,
      thread_id: this.threadId,
      message_id: this.messageId,
      phase: toPhase,
      timestamp: now,
      elapsed_ms: elapsed,
      detail: meta?.detail,
      progress: meta?.progress,
      stats: mergedStats,
      tool_call: meta?.tool_call,
      error: meta?.error,
    };

    if (["done", "stopped", "cancelled", "error"].includes(toPhase)) {
      if (this.stallTimer) {
        clearTimeout(this.stallTimer);
        this.stallTimer = null;
      }
    } else {
      this.resetStallTimer();
    }

    for (const listener of this.listeners) {
      try {
        listener(this.lastEvent);
      } catch {
        // Safe dispatch
      }
    }

    return true;
  }

  public destroy() {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    this.listeners.clear();
  }
}
