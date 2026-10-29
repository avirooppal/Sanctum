/**
 * Tool Execution Engine, Multi-Tool Batch Scheduler & Timeout Budget Enforcer
 * (ADR 0105 / Pipeline P8 / Multi-Tool Architecture v2).
 */

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import {
  type ToolDefinition,
  validateToolArguments,
} from "./schema.ts";
import {
  type ToolPermissionGate,
  type ApprovalDecision,
  type ApprovalScope,
} from "./permission_gate.ts";
import {
  type ToolCallRequest,
  type ToolExecutionResult,
  type ToolSpec,
  type MultiToolOptions,
  type ErrorCode,
} from "./types.ts";
import { ToolScheduler } from "./scheduler.ts";

export type { ToolExecutionResult } from "./types.ts";

export type ToolHandler = (
  args: Record<string, any>,
  signal: AbortSignal
) => Promise<{ stdout: string; exitCode: number }>;

export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' execution exceeded timeout budget of ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
  }
}

export class ToolExecutor {
  private handlers: Map<string, ToolHandler> = new Map();
  private specs: Map<string, ToolSpec> = new Map();
  private gate: ToolPermissionGate;
  private defaultTimeoutMs: number = 30000;
  private defaultMaxOutputChars: number = 20000;
  private scheduler: ToolScheduler;

  constructor(gate: ToolPermissionGate, defaultTimeoutMs: number = 30000) {
    this.gate = gate;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.scheduler = new ToolScheduler({ concurrency: 4, mode: "all-settled" });
  }

  public registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  public registerSpec(spec: ToolSpec): void {
    this.specs.set(spec.name, spec);
    if (!this.handlers.has(spec.name)) {
      this.handlers.set(spec.name, async (args, signal) => {
        const res = await spec.run(args, { signal });
        return {
          stdout: typeof res === "string" ? res : JSON.stringify(res),
          exitCode: 0,
        };
      });
    }
  }

  public getSpec(toolName: string): ToolSpec | undefined {
    return this.specs.get(toolName);
  }

  /**
   * Execute a single tool call with permission check, argument validation, and timeout protection.
   */
  public async executeCall(
    call: ToolCallRequest,
    sessionId: string,
    onUserPrompt?: (promptData: {
      toolName: string;
      arguments: Record<string, any>;
    }) => Promise<{ decision: ApprovalDecision; scope: ApprovalScope }>
  ): Promise<ToolExecutionResult> {
    const t0 = Date.now();
    const tool = this.gate.getTool(call.name);
    const spec = this.specs.get(call.name);

    // If call has a pre-existing parse error from lenient parser
    if (call.arguments?._parseError) {
      return {
        id: call.id,
        toolName: call.name,
        name: call.name,
        status: "error",
        ok: false,
        output: "",
        content: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: {
          code: "invalid_args",
          message: call.arguments._parseError,
          hint: "Check JSON argument syntax.",
        },
      };
    }

    if (!tool && !spec) {
      return {
        id: call.id,
        toolName: call.name,
        name: call.name,
        status: "error",
        ok: false,
        output: "",
        content: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: {
          code: "unknown_tool",
          message: `Tool '${call.name}' not registered`,
        },
      };
    }

    // 1. Argument validation against schema (if defined on tool)
    if (tool) {
      const validation = validateToolArguments(tool, call.arguments);
      if (!validation.valid) {
        return {
          id: call.id,
          toolName: call.name,
          name: call.name,
          status: "error",
          ok: false,
          output: "",
          content: "",
          exitCode: 1,
          durationMs: Date.now() - t0,
          error: {
            code: "invalid_args",
            message: `Validation error: ${validation.errors.join("; ")}`,
          },
        };
      }
    }

    // 2. Permission gate check
    const perm = this.gate.checkPermission(call.name, sessionId);
    if (!perm.allowed) {
      if (perm.requiresPrompt) {
        if (!onUserPrompt) {
          return {
            id: call.id,
            toolName: call.name,
            name: call.name,
            status: "denied",
            ok: false,
            output: "",
            content: "",
            exitCode: 126,
            durationMs: Date.now() - t0,
            error: {
              code: "denied",
              message: "User approval required but no prompt handler provided",
            },
          };
        }

        const userChoice = await onUserPrompt({
          toolName: call.name,
          arguments: call.arguments,
        });

        if (userChoice.decision !== "approved") {
          return {
            id: call.id,
            toolName: call.name,
            name: call.name,
            status: "denied",
            ok: false,
            output: "",
            content: "",
            exitCode: 126,
            durationMs: Date.now() - t0,
            error: {
              code: "denied",
              message: "Tool execution was explicitly denied by the user",
            },
          };
        }

        if (userChoice.scope === "session") {
          this.gate.grantSessionApproval(call.name, sessionId);
        }
      } else {
        return {
          id: call.id,
          toolName: call.name,
          name: call.name,
          status: "denied",
          ok: false,
          output: "",
          content: "",
          exitCode: 126,
          durationMs: Date.now() - t0,
          error: {
            code: "denied",
            message: perm.reason || `Tool '${call.name}' is denied by security policy`,
          },
        };
      }
    }

    // 3. Execution with timeout budget
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return {
        id: call.id,
        toolName: call.name,
        name: call.name,
        status: "error",
        ok: false,
        output: "",
        content: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: {
          code: "internal",
          message: `No implementation registered for tool '${call.name}'`,
        },
      };
    }

    const timeoutMs = spec?.timeoutMs ?? this.defaultTimeoutMs;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await handler(call.arguments, ac.signal);
      clearTimeout(timeoutId);

      // 4. Output truncation with spill-to-file
      let finalOutput = res.stdout;
      let truncated = false;
      let fullOutputRef: string | undefined;

      const maxChars = spec?.maxOutputChars ?? this.defaultMaxOutputChars;
      if (finalOutput && finalOutput.length > maxChars) {
        truncated = true;
        try {
          const tmpFile = path.join(
            os.tmpdir(),
            `sanctum_tool_${call.name}_${Date.now()}.txt`
          );
          fs.writeFileSync(tmpFile, finalOutput, "utf-8");
          fullOutputRef = tmpFile;
          finalOutput = `${finalOutput.slice(
            0,
            maxChars
          )}\n\n[Output truncated at ${maxChars} chars. Full output preserved at: ${tmpFile}]`;
        } catch {
          finalOutput = finalOutput.slice(0, maxChars) + "\n\n[Output truncated]";
        }
      }

      return {
        id: call.id,
        toolName: call.name,
        name: call.name,
        status: "completed",
        ok: true,
        output: finalOutput,
        content: finalOutput,
        exitCode: res.exitCode,
        durationMs: Date.now() - t0,
        meta: {
          startedAt: t0,
          durationMs: Date.now() - t0,
          truncated,
          fullOutputRef,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout =
        ac.signal.aborted ||
        err.name === "AbortError" ||
        /timeout/i.test(err.message);

      const code: ErrorCode = isTimeout ? "timeout" : "internal";
      return {
        id: call.id,
        toolName: call.name,
        name: call.name,
        status: isTimeout ? "timeout" : "error",
        ok: false,
        output: "",
        content: "",
        exitCode: isTimeout ? 124 : 1,
        durationMs: Date.now() - t0,
        error: {
          code,
          message: isTimeout
            ? `Tool '${call.name}' timed out after ${timeoutMs}ms`
            : err.message,
        },
      };
    }
  }

  /**
   * Execute multiple tool calls concurrently and safely using conflict-aware scheduling.
   * Guarantees deterministic return ordering matching input calls index.
   */
  public async executeMultipleCalls(
    calls: ToolCallRequest[],
    sessionId: string,
    options?: MultiToolOptions,
    onUserPrompt?: (promptData: {
      toolName: string;
      arguments: Record<string, any>;
    }) => Promise<{ decision: ApprovalDecision; scope: ApprovalScope }>
  ): Promise<ToolExecutionResult[]> {
    if (!calls || calls.length === 0) return [];

    // Ensure all calls have an index
    const indexedCalls = calls.map((c, i) => ({
      ...c,
      index: c.index !== undefined ? c.index : i,
    }));

    // Read de-duplication cache: identical read calls within the same turn share results
    const readCache = new Map<string, Promise<ToolExecutionResult>>();

    const runner = async (
      call: ToolCallRequest,
      spec?: ToolSpec,
      signal?: AbortSignal
    ): Promise<ToolExecutionResult> => {
      // De-duplication check for pure reads
      const isRead = spec?.parallelSafe === true && spec?.safety === "read";
      const cacheKey = isRead
        ? `${call.name}::${JSON.stringify(call.arguments)}`
        : null;

      if (cacheKey && readCache.has(cacheKey)) {
        const cached = await readCache.get(cacheKey)!;
        return {
          ...cached,
          id: call.id, // preserve this call's unique ID
        };
      }

      const execPromise = this.executeCall(call, sessionId, onUserPrompt);
      if (cacheKey) {
        readCache.set(cacheKey, execPromise);
      }

      return execPromise;
    };

    return this.scheduler.scheduleAndRun(indexedCalls, this.specs, runner, options);
  }

  /**
   * Format tool result as an OpenAI/Ollama compatible tool message for the next chat turn.
   */
  public static formatToolResponse(result: ToolExecutionResult): {
    role: "tool";
    tool_call_id: string;
    name: string;
    content: string;
  } {
    const errorStr =
      typeof result.error === "object"
        ? `ERROR[${result.error.code}]: ${result.error.message}${
            result.error.hint ? ` (${result.error.hint})` : ""
          }`
        : result.error;

    return {
      role: "tool",
      tool_call_id: result.id,
      name: result.toolName || result.name || "unknown_tool",
      content:
        result.status === "completed" && result.ok !== false
          ? result.output || result.content || ""
          : errorStr || `ERROR: ${result.status}`,
    };
  }

  /**
   * Formats multiple tool results into deterministic OpenAI/Ollama tool messages in call order.
   */
  public static formatMultipleToolResponses(
    results: ToolExecutionResult[]
  ): {
    role: "tool";
    tool_call_id: string;
    name: string;
    content: string;
  }[] {
    return results.map(ToolExecutor.formatToolResponse);
  }
}
