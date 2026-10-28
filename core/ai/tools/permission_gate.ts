/**
 * Tool Permission Gate & Approval Broker (ADR 0105 / Pipeline P8).
 * Enforces Deny/Ask/Allow access control with session-scoped caching.
 */
import type { ToolDefinition } from "./schema.ts";

export type ApprovalDecision = "approved" | "denied";
export type ApprovalScope = "once" | "session";

export interface PermissionCheckResult {
  toolName: string;
  allowed: boolean;
  requiresPrompt: boolean;
  reason: string;
}

export class ToolPermissionDeniedError extends Error {
  constructor(toolName: string, reason: string) {
    super(`Tool execution denied for '${toolName}': ${reason}`);
    this.name = "ToolPermissionDeniedError";
  }
}

export class ToolPermissionGate {
  private toolRegistry: Map<string, ToolDefinition> = new Map();
  // Map of `${sessionId}:${toolName}` -> boolean
  private sessionApprovals: Set<string> = new Set();

  public registerTool(tool: ToolDefinition): void {
    this.toolRegistry.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.toolRegistry.get(name);
  }

  public checkPermission(toolName: string, sessionId: string): PermissionCheckResult {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        toolName,
        allowed: false,
        requiresPrompt: false,
        reason: `Tool '${toolName}' is not registered in active manifest`,
      };
    }

    if (tool.permissionLevel === "deny") {
      return {
        toolName,
        allowed: false,
        requiresPrompt: false,
        reason: `Tool '${toolName}' policy is permanently set to 'deny'`,
      };
    }

    if (tool.permissionLevel === "auto_allow") {
      return {
        toolName,
        allowed: true,
        requiresPrompt: false,
        reason: "Auto-allowed by tool policy",
      };
    }

    // "always_ask"
    const sessionKey = `${sessionId}:${toolName}`;
    if (this.sessionApprovals.has(sessionKey)) {
      return {
        toolName,
        allowed: true,
        requiresPrompt: false,
        reason: "Pre-approved for current active session",
      };
    }

    return {
      toolName,
      allowed: false,
      requiresPrompt: true,
      reason: "User confirmation required (always_ask)",
    };
  }

  public grantSessionApproval(toolName: string, sessionId: string): void {
    this.sessionApprovals.add(`${sessionId}:${toolName}`);
  }

  public revokeSessionApproval(toolName: string, sessionId: string): void {
    this.sessionApprovals.delete(`${sessionId}:${toolName}`);
  }

  public clearSession(sessionId: string): void {
    for (const key of this.sessionApprovals.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.sessionApprovals.delete(key);
      }
    }
  }

  public clearAll(): void {
    this.toolRegistry.clear();
    this.sessionApprovals.clear();
  }
}
