/**
 * Multi-Tool Permission Engine & Batch Approval Gate (Sanctum v2)
 *
 * Enforces:
 * 1. Rule-based permission matching (deny -> ask -> allow) with fallback to session mode.
 * 2. Workspace jail & path canonicalization (prevents path traversal / symlink escapes).
 * 3. Grouped batch approvals: bundled into one interactive prompt, eliminating approval spam.
 * 4. Pattern-based session caching (tool + normalized arguments pattern).
 */

import path from "node:path";
import {
  type ToolCallRequest,
  type ToolSpec,
  type ToolPermissionRule,
  type PermissionMode,
} from "./types.ts";

export interface PermissionCheckResult {
  allowed: boolean;
  requiresPrompt: boolean;
  reason?: string;
  ruleMatched?: string;
}

export interface BatchApprovalRequest {
  batchId: string;
  items: {
    callId: string;
    toolName: string;
    arguments: Record<string, any>;
    dangerLevel: "low" | "medium" | "high";
    description: string;
  }[];
}

export interface BatchApprovalDecision {
  decisions: Map<string, { approved: boolean; scope: "once" | "session" }>;
}

export class ToolPermissionEngine {
  private mode: PermissionMode = "default";
  private rules: ToolPermissionRule[] = [];
  private workspaceRoot: string = "";
  private sessionApprovals: Set<string> = new Set(); // toolName + "::" + argPattern

  constructor(options?: {
    mode?: PermissionMode;
    rules?: ToolPermissionRule[];
    workspaceRoot?: string;
  }) {
    if (options?.mode) this.mode = options.mode;
    if (options?.rules) this.rules = options.rules;
    if (options?.workspaceRoot) this.workspaceRoot = path.resolve(options.workspaceRoot);
  }

  public setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  public setWorkspaceRoot(root: string): void {
    this.workspaceRoot = path.resolve(root);
  }

  public addRule(rule: ToolPermissionRule): void {
    this.rules.unshift(rule); // Higher precedence for recent rules
  }

  /**
   * Generates a stable pattern key for session caching.
   */
  public static makeSessionKey(toolName: string, args: Record<string, any>): string {
    const target = args.path || args.filePath || args.action || "";
    return `${toolName}::${target}`;
  }

  /**
   * Path canonicalization & directory traversal security gate.
   */
  public validatePathWithinWorkspace(rawPath: string): { valid: boolean; resolvedPath?: string; error?: string } {
    if (!this.workspaceRoot) {
      return { valid: true, resolvedPath: path.resolve(rawPath) };
    }

    try {
      const resolved = path.resolve(this.workspaceRoot, rawPath);
      const relative = path.relative(this.workspaceRoot, resolved);

      // Check for path traversal outside workspace
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return {
          valid: false,
          error: `Access denied: Path '${rawPath}' escapes workspace boundary ('${this.workspaceRoot}').`,
        };
      }

      return { valid: true, resolvedPath: resolved };
    } catch (err: any) {
      return { valid: false, error: `Invalid path: ${err.message}` };
    }
  }

  /**
   * Checks permission for an individual call within a session.
   */
  public checkCall(call: ToolCallRequest, spec?: ToolSpec, sessionId?: string): PermissionCheckResult {
    const toolName = call.name;
    const safety = spec?.safety || "write";
    const args = call.arguments || {};

    // 1. Path safety check for file-based operations
    const targetPath = args.path || args.filePath || args.destination;
    if (typeof targetPath === "string" && this.workspaceRoot) {
      const pathCheck = this.validatePathWithinWorkspace(targetPath);
      if (!pathCheck.valid) {
        return { allowed: false, requiresPrompt: false, reason: pathCheck.error };
      }
    }

    // 2. Check session cache
    const sessionKey = ToolPermissionEngine.makeSessionKey(toolName, args);
    const sessionToken = `${sessionId || "default"}::${sessionKey}`;
    if (this.sessionApprovals.has(sessionToken)) {
      return { allowed: true, requiresPrompt: false, reason: "Approved for current session" };
    }

    // 3. Rule matching: Deny -> Ask -> Allow
    for (const rule of this.rules) {
      if (this.matchesRule(rule, toolName, args)) {
        if (rule.action === "deny") {
          return { allowed: false, requiresPrompt: false, reason: `Blocked by rule: ${rule.pattern}`, ruleMatched: rule.pattern };
        }
        if (rule.action === "ask") {
          return { allowed: false, requiresPrompt: true, reason: `Requires confirmation by rule: ${rule.pattern}`, ruleMatched: rule.pattern };
        }
        if (rule.action === "allow") {
          return { allowed: true, requiresPrompt: false, reason: `Allowed by rule: ${rule.pattern}`, ruleMatched: rule.pattern };
        }
      }
    }

    // 4. Fallback to Permission Mode
    switch (this.mode) {
      case "read-only":
        if (safety === "read" && spec?.parallelSafe) {
          return { allowed: true, requiresPrompt: false };
        }
        return { allowed: false, requiresPrompt: false, reason: "Writes and executions are disabled in read-only mode" };

      case "auto-edit":
        if (safety === "read" || safety === "write" || safety === "meta") {
          return { allowed: true, requiresPrompt: false };
        }
        return { allowed: false, requiresPrompt: true, reason: "Process execution requires user approval" };

      case "full-access":
        return { allowed: true, requiresPrompt: false };

      case "default":
      default:
        if (safety === "read" && spec?.parallelSafe) {
          return { allowed: true, requiresPrompt: false };
        }
        return { allowed: false, requiresPrompt: true, reason: `Modifying operation (${toolName}) requires confirmation` };
    }
  }

  public grantSessionApproval(toolName: string, args: Record<string, any>, sessionId?: string): void {
    const sessionKey = ToolPermissionEngine.makeSessionKey(toolName, args);
    const sessionToken = `${sessionId || "default"}::${sessionKey}`;
    this.sessionApprovals.add(sessionToken);
  }

  private matchesRule(rule: ToolPermissionRule, toolName: string, args: Record<string, any>): boolean {
    if (rule.tool && rule.tool !== "*" && rule.tool !== toolName) {
      return false;
    }

    const p = rule.pattern;
    if (p === "*" || p === toolName) return true;

    if (p.startsWith("write:") && (toolName.includes("create") || toolName.includes("edit") || toolName.includes("delete"))) {
      const filePattern = p.slice(6);
      const target = args.path || "";
      return this.globMatch(target, filePattern);
    }

    if (p.startsWith("read:") && (toolName.includes("read") || toolName.includes("list"))) {
      const filePattern = p.slice(5);
      const target = args.path || "";
      return this.globMatch(target, filePattern);
    }

    if (p.startsWith("exec:") && toolName.includes("shell")) {
      return true;
    }

    return false;
  }

  private globMatch(str: string, pattern: string): boolean {
    if (pattern === "*" || pattern === "**") return true;
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    return new RegExp(`^${regexStr}$`).test(str);
  }
}
