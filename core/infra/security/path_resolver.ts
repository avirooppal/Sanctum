import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { recordAuditLog } from "./audit_logger.ts";

export type AccessScope = "workspace_only" | "selected_folders" | "system_read" | "system_full";
export type OperationMode = "read" | "write";

export interface PathResolutionOptions {
  rawPath: string;
  workspaceRoot: string;
  allowRoot?: boolean;
  mode?: OperationMode;
  scope?: AccessScope;
  allowedFolders?: string[];
  overrideHardBlocked?: boolean;
  toolName?: string;
  actionName?: string;
}

export interface ResolvedPathResult {
  resolvedPath: string;
  outsideWorkspace: boolean;
  scope: AccessScope;
}

export class SecurityPathError extends Error {
  public code: string;
  constructor(message: string, code: string = "SECURITY_PATH_DENIED") {
    super(message);
    this.name = "SecurityPathError";
    this.code = code;
  }
}

function normalizePathSeparators(p: string): string {
  return p.replace(/\//g, "\\");
}

function getSystemHardBlockedPrefixes(): string[] {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const systemRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  return [
    systemRoot,
    path.join(systemRoot, "System32"),
    path.join(systemRoot, "SysWOW64"),
    programFiles,
    programFilesX86,
    // Sensitive credential & configuration stores in user home
    path.join(home, ".ssh"),
    path.join(home, ".aws"),
    path.join(home, ".azure"),
    path.join(home, ".config", "gcloud"),
    path.join(home, ".gnupg"),
    path.join(home, ".git-credentials"),
    path.join(home, ".netrc"),
    // Browser profiles
    path.join(localAppData, "Google", "Chrome"),
    path.join(localAppData, "Microsoft", "Edge"),
    path.join(appData, "Mozilla", "Firefox"),
    path.join(localAppData, "BraveSoftware"),
    // Sanctum sensitive host config (API keys, secrets)
    path.join(appData, "Sanctum", "settings.json"),
  ].map((p) => path.resolve(p).toLowerCase());
}

/**
 * Resolves real path, normalizes 8.3 short names and symlinks where possible.
 */
function getCanonicalPath(targetPath: string): string {
  let cur = path.resolve(targetPath);
  try {
    if (fs.existsSync(cur)) {
      // fs.realpathSync.native unwraps 8.3 short names on Windows
      if (typeof (fs.realpathSync as any).native === "function") {
        return (fs.realpathSync as any).native(cur);
      }
      return fs.realpathSync(cur);
    }
  } catch {
    // If target does not exist yet (e.g. file creation), resolve existing parent
  }

  // Walk up to find nearest existing parent and canonicalize that
  const segments: string[] = [];
  while (cur && !fs.existsSync(cur)) {
    segments.unshift(path.basename(cur));
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  if (cur && fs.existsSync(cur)) {
    try {
      const canonicalParent = typeof (fs.realpathSync as any).native === "function"
        ? (fs.realpathSync as any).native(cur)
        : fs.realpathSync(cur);
      return path.resolve(canonicalParent, ...segments);
    } catch {
      // Fallback to resolved
    }
  }

  return path.resolve(targetPath);
}

/**
 * Validates that no ancestor in the chain is a symbolic link or junction reparse point.
 */
function verifyNoSymlinksOrJunctions(targetPath: string, boundaryRoot?: string): void {
  let cur = path.resolve(targetPath);
  const boundary = boundaryRoot ? path.resolve(boundaryRoot).toLowerCase() : null;

  while (cur) {
    if (boundary && cur.toLowerCase() === boundary) {
      break;
    }
    if (fs.existsSync(cur)) {
      try {
        const stat = fs.lstatSync(cur);
        if (stat.isSymbolicLink()) {
          throw new SecurityPathError(
            `Symbolic links and junctions are blocked: ${cur}`,
            "SYMLINK_BLOCKED"
          );
        }
      } catch (err: any) {
        if (err instanceof SecurityPathError) throw err;
      }
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

/**
 * Check if a path targets any hard-blocked system or credential location.
 */
export function isHardBlockedPath(targetPath: string): { blocked: boolean; matchedPath?: string } {
  const canonical = getCanonicalPath(targetPath).toLowerCase();
  const blockedPrefixes = getSystemHardBlockedPrefixes();

  for (const blocked of blockedPrefixes) {
    if (canonical === blocked || canonical.startsWith(blocked + path.sep)) {
      return { blocked: true, matchedPath: blocked };
    }
  }
  return { blocked: false };
}

/**
 * Central Host Path Resolver.
 * Enforces canonical resolution, 8.3 anti-traversal, symlink blocking,
 * hard-blocked boundaries, and access scopes (workspace_only | selected_folders | system_read | system_full).
 */
export function resolveScopedPath(options: PathResolutionOptions): ResolvedPathResult {
  const {
    rawPath,
    workspaceRoot,
    allowRoot = false,
    mode = "read",
    scope = "workspace_only",
    allowedFolders = [],
    overrideHardBlocked = false,
    toolName = "workspace_files",
    actionName = "access",
  } = options;

  if (rawPath === null || rawPath === undefined || typeof rawPath !== "string") {
    throw new SecurityPathError("Path argument is missing or invalid.", "INVALID_ARGUMENT");
  }

  // Reject null bytes
  if (rawPath.includes("\0")) {
    throw new SecurityPathError("Null byte injection detected in path.", "NULL_BYTE_DETECTED");
  }

  // Reject UNC paths and protocol paths
  const trimmed = rawPath.trim();
  if (trimmed.startsWith("\\\\") || trimmed.startsWith("//")) {
    throw new SecurityPathError("UNC network paths are not allowed.", "UNC_PATH_FORBIDDEN");
  }

  // Inspect path segments for invalid Windows stems & device names
  const normalizedSegments = normalizePathSeparators(trimmed).split("\\");
  for (const part of normalizedSegments) {
    if (!part || part === ".") continue;
    if (part === "..") continue; // handled by canonical resolver
    const stem = part.split(".")[0].toUpperCase();
    if (
      part.endsWith(" ") ||
      part.endsWith(".") ||
      ["CON", "PRN", "AUX", "NUL"].includes(stem) ||
      /^(COM|LPT)[0-9]$/.test(stem)
    ) {
      throw new SecurityPathError(`Invalid Windows path segment: "${part}"`, "INVALID_SEGMENT");
    }
  }

  const rootCanonical = path.resolve(workspaceRoot);
  let candidatePath: string;

  // If path is relative, resolve relative to workspaceRoot
  if (!path.isAbsolute(trimmed)) {
    if (trimmed === "." && allowRoot) {
      candidatePath = rootCanonical;
    } else {
      candidatePath = path.resolve(rootCanonical, trimmed);
    }
  } else {
    // Path is absolute
    if (scope === "workspace_only") {
      throw new SecurityPathError(
        "Absolute paths are forbidden under 'workspace_only' access scope.",
        "ABSOLUTE_PATH_FORBIDDEN"
      );
    }
    candidatePath = path.resolve(trimmed);
  }

  // Resolve canonical path and check symlinks
  const canonicalTarget = getCanonicalPath(candidatePath);
  verifyNoSymlinksOrJunctions(canonicalTarget);

  const targetLower = canonicalTarget.toLowerCase();
  const rootLower = rootCanonical.toLowerCase();
  const isSameAsRoot = targetLower === rootLower;
  const isInsideRoot = targetLower.startsWith(rootLower + path.sep);
  const isInWorkspace = (allowRoot && isSameAsRoot) || isInsideRoot;

  // Check hard-blocked list
  const hardBlockedCheck = isHardBlockedPath(canonicalTarget);
  if (hardBlockedCheck.blocked && !overrideHardBlocked) {
    const errorMsg = `Access to critical system or credential path is hard-blocked: ${canonicalTarget}`;
    recordAuditLog({
      tool: toolName,
      path: canonicalTarget,
      action: actionName,
      scope,
      decision: "denied",
      reason: errorMsg,
    });
    throw new SecurityPathError(errorMsg, "HARD_BLOCKED_PATH");
  }

  if (isInWorkspace) {
    // Within workspace boundaries
    return {
      resolvedPath: canonicalTarget,
      outsideWorkspace: false,
      scope,
    };
  }

  // Target is OUTSIDE workspace
  const auditDecision = (decision: "allowed" | "denied", reason: string) => {
    recordAuditLog({
      tool: toolName,
      path: canonicalTarget,
      action: `${actionName} (${mode})`,
      scope,
      decision,
      reason,
    });
  };

  if (scope === "workspace_only") {
    const reason = "Path is outside the workspace under 'workspace_only' scope.";
    auditDecision("denied", reason);
    throw new SecurityPathError(reason, "SCOPE_VIOLATION");
  }

  if (scope === "selected_folders") {
    // Validate against allowlist
    const matchedFolder = allowedFolders.find((folder) => {
      const fCanonical = getCanonicalPath(folder).toLowerCase();
      return targetLower === fCanonical || targetLower.startsWith(fCanonical + path.sep);
    });

    if (!matchedFolder) {
      const reason = `Path is not in the granted folders allowlist for 'selected_folders' scope.`;
      auditDecision("denied", reason);
      throw new SecurityPathError(reason, "NOT_IN_ALLOWLIST");
    }

    auditDecision("allowed", `Matched granted allowlist folder: ${matchedFolder}`);
    return {
      resolvedPath: canonicalTarget,
      outsideWorkspace: true,
      scope,
    };
  }

  if (scope === "system_read") {
    if (mode === "write") {
      const reason = "Write operations outside the workspace are blocked in 'system_read' mode.";
      auditDecision("denied", reason);
      throw new SecurityPathError(reason, "WRITE_BLOCKED_IN_READ_ONLY");
    }

    auditDecision("allowed", "Permitted under 'system_read' scope.");
    return {
      resolvedPath: canonicalTarget,
      outsideWorkspace: true,
      scope,
    };
  }

  if (scope === "system_full") {
    auditDecision("allowed", "Permitted under 'system_full' scope.");
    return {
      resolvedPath: canonicalTarget,
      outsideWorkspace: true,
      scope,
    };
  }

  const reason = `Unknown access scope: ${scope}`;
  auditDecision("denied", reason);
  throw new SecurityPathError(reason, "UNKNOWN_SCOPE");
}
