/**
 * Core Types & Contracts for Multi-Tool Execution & Conflict-Aware Scheduling
 * Sanctum Multi-Tool Architecture (v2)
 */

import type { ToolActivity } from "../../../contracts/types/index.ts";
export type { ToolActivity };

export type SafetyClass = "read" | "write" | "exec" | "network" | "meta";

export type ResourceKey = string; // e.g. 'file:/src/a.ts', 'dir:/src', 'proc:shell', 'net:api.github.com'

export type ErrorCode =
  | "invalid_args"
  | "unknown_tool"
  | "denied"
  | "timeout"
  | "cancelled"
  | "skipped"
  | "not_found"
  | "conflict"
  | "internal"
  | "budget_exceeded";

export interface ToolContext {
  sessionId?: string;
  workspaceId?: string;
  signal: AbortSignal;
}

export interface ToolSpec<A = Record<string, any>, R = any> {
  name: string;
  description?: string;
  schema?: any;
  safety: SafetyClass; // default 'write' if omitted
  parallelSafe: boolean; // true only for pure reads without side effects
  resources?: (args: A) => ResourceKey[];
  timeoutMs?: number; // per-tool execution timeout override
  maxOutputChars?: number; // per-tool output cap (default 20,000)
  retry?: { max: number; on: ErrorCode[] };
  run(args: A, ctx: ToolContext): Promise<R>;
}

export interface ToolCallRequest {
  id: string; // normalized, unique per turn
  name: string;
  arguments: Record<string, any>;
  index: number; // model's original order (0..N-1)
}

export interface ToolExecutionResult {
  id: string;
  toolName: string;
  name?: string; // alias for toolName
  status: "completed" | "denied" | "timeout" | "error" | "cancelled" | "skipped";
  ok: boolean;
  output: string;
  content?: string; // alias for output
  exitCode: number;
  durationMs: number;
  error?: { code: ErrorCode; message: string; hint?: string } | string;
  meta?: {
    startedAt: number;
    durationMs: number;
    truncated: boolean;
    fullOutputRef?: string;
  };
}

export interface MultiToolOptions {
  concurrency?: number; // default 4
  mode?: "all-settled" | "fail-fast"; // default all-settled
  batchTimeoutMs?: number; // total budget, default 120_000
  signal?: AbortSignal;
  onActivity?: (e: ToolActivity) => void;
  sessionId?: string;
  workspaceId?: string;
}

export interface ToolPermissionRule {
  action: "allow" | "ask" | "deny";
  pattern: string; // tool name or glob e.g. 'read:*', 'write:**/.env'
  tool?: string;
}

export type PermissionMode = "read-only" | "default" | "auto-edit" | "full-access";
