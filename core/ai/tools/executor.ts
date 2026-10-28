/**
 * Tool Execution Engine & Timeout Budget Enforcer (ADR 0105 / Pipeline P8).
 * Executes approved tool calls with byte-exact parameters, execution timeout,
 * and structured output formatting for the model.
 */
import {
  type ToolDefinition,
  type ToolCallRequest,
  validateToolArguments,
  ToolValidationError,
} from "./schema.ts";
import {
  type ToolPermissionGate,
  ToolPermissionDeniedError,
  type ApprovalDecision,
  type ApprovalScope,
} from "./permission_gate.ts";

export interface ToolExecutionResult {
  id: string;
  toolName: string;
  status: "completed" | "denied" | "timeout" | "error";
  output: string;
  exitCode: number;
  durationMs: number;
  error?: string;
}

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
  private gate: ToolPermissionGate;
  private defaultTimeoutMs: number = 3000;

  constructor(gate: ToolPermissionGate, defaultTimeoutMs: number = 3000) {
    this.gate = gate;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  public registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  /**
   * Execute a tool call with permission check, argument validation, and timeout protection.
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
    if (!tool) {
      return {
        id: call.id,
        toolName: call.name,
        status: "error",
        output: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: `Tool '${call.name}' not registered`,
      };
    }

    // 1. Argument validation against JSON schema
    const validation = validateToolArguments(tool, call.arguments);
    if (!validation.valid) {
      return {
        id: call.id,
        toolName: call.name,
        status: "error",
        output: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: `Validation error: ${validation.errors.join("; ")}`,
      };
    }

    // 2. Permission gate check
    const perm = this.gate.checkPermission(call.name, sessionId);
    if (!perm.allowed) {
      if (perm.requiresPrompt) {
        if (!onUserPrompt) {
          return {
            id: call.id,
            toolName: call.name,
            status: "denied",
            output: "",
            exitCode: 126,
            durationMs: Date.now() - t0,
            error: "User approval required but no prompt handler provided",
          };
        }

        // Await interactive user confirmation
        const userChoice = await onUserPrompt({
          toolName: call.name,
          arguments: call.arguments,
        });

        if (userChoice.decision !== "approved") {
          return {
            id: call.id,
            toolName: call.name,
            status: "denied",
            output: "",
            exitCode: 126,
            durationMs: Date.now() - t0,
            error: "Tool execution was explicitly denied by the user",
          };
        }

        // User approved
        if (userChoice.scope === "session") {
          this.gate.grantSessionApproval(call.name, sessionId);
        }
      } else {
        // Explicitly denied by policy
        return {
          id: call.id,
          toolName: call.name,
          status: "denied",
          output: "",
          exitCode: 126,
          durationMs: Date.now() - t0,
          error: perm.reason,
        };
      }
    }

    // 3. Execution with timeout budget
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return {
        id: call.id,
        toolName: call.name,
        status: "error",
        output: "",
        exitCode: 1,
        durationMs: Date.now() - t0,
        error: `No implementation registered for tool '${call.name}'`,
      };
    }

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), this.defaultTimeoutMs);

    try {
      const res = await handler(call.arguments, ac.signal);
      clearTimeout(timeoutId);

      return {
        id: call.id,
        toolName: call.name,
        status: "completed",
        output: res.stdout,
        exitCode: res.exitCode,
        durationMs: Date.now() - t0,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = ac.signal.aborted || err.name === "AbortError" || /timeout/i.test(err.message);

      return {
        id: call.id,
        toolName: call.name,
        status: isTimeout ? "timeout" : "error",
        output: "",
        exitCode: isTimeout ? 124 : 1,
        durationMs: Date.now() - t0,
        error: err.message,
      };
    }
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
    return {
      role: "tool",
      tool_call_id: result.id,
      name: result.toolName,
      content: result.status === "completed" ? result.output : `ERROR: ${result.error || result.status}`,
    };
  }
}
