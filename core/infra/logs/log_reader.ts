import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "../security/audit_logger.ts";
import { resolveScopedPath, type AccessScope } from "../security/path_resolver.ts";

export type LogSourceType = "sanctum" | "audit" | "terminal" | "file";

export interface ReadLogsOptions {
  source?: LogSourceType;
  path?: string;
  tail?: number;
  regex?: string;
  timeStart?: string;
  timeEnd?: string;
  workspaceRoot?: string;
  scope?: AccessScope;
  allowedFolders?: string[];
  overrideHardBlocked?: boolean;
}

export interface LogEntryResult {
  raw: string;
  timestamp?: string;
  level?: string;
  category?: string;
  message?: string;
  data?: any;
}

export interface ReadLogsResult {
  source: LogSourceType;
  resolvedPath: string;
  totalLinesScanned: number;
  matchedCount: number;
  lines: LogEntryResult[];
}

function getSanctumLogPath(): string {
  return path.join(getSanctumDataDir(), "logs", "desktop.jsonl");
}

function getAuditLogPath(): string {
  return path.join(getSanctumDataDir(), "audit.log");
}

function getTerminalSpillDirectory(): string {
  return path.join(getSanctumDataDir(), "spills");
}

function parseLogLine(line: string): LogEntryResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { raw: "" };
  }

  // Attempt JSON parsing (used by desktop.jsonl and audit.log)
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        raw: trimmed,
        timestamp: parsed.time || parsed.timestamp,
        level: parsed.level || (parsed.decision === "denied" ? "error" : "info"),
        category: parsed.category || parsed.tool,
        message: parsed.message || parsed.reason || parsed.action,
        data: parsed,
      };
    } catch {}
  }

  // Plain text log line: extract timestamp if present (e.g. [2026-11-09T12:00:00Z])
  const tsMatch = trimmed.match(/^\[?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?/);
  return {
    raw: trimmed,
    timestamp: tsMatch ? tsMatch[1] : undefined,
    message: trimmed,
  };
}

/**
 * Reads and filters logs from Sanctum, security audit, terminal tasks, or target files.
 */
export function readLogs(options: ReadLogsOptions): ReadLogsResult {
  const {
    source = "sanctum",
    tail = 100,
    regex,
    timeStart,
    timeEnd,
    workspaceRoot = process.cwd(),
    scope = "workspace_only",
    allowedFolders = [],
    overrideHardBlocked = false,
  } = options;

  let targetPath = "";

  if (source === "sanctum") {
    targetPath = getSanctumLogPath();
  } else if (source === "audit") {
    targetPath = getAuditLogPath();
  } else if (source === "terminal") {
    // Find most recent terminal spill file or specific terminal log
    if (options.path) {
      targetPath = path.isAbsolute(options.path)
        ? options.path
        : path.join(getTerminalSpillDirectory(), options.path);
    } else {
      const spillDir = getTerminalSpillDirectory();
      if (fs.existsSync(spillDir)) {
        const files = fs
          .readdirSync(spillDir, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith(".log"))
          .map((f) => ({
            name: f.name,
            full: path.join(spillDir, f.name),
            mtime: fs.statSync(path.join(spillDir, f.name)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) targetPath = files[0].full;
      }
    }
  } else if (source === "file") {
    if (!options.path) {
      throw new Error("Missing 'path' argument for source='file'.");
    }
    // Must respect access scope
    const resolved = resolveScopedPath({
      rawPath: options.path,
      workspaceRoot,
      mode: "read",
      scope,
      allowedFolders,
      overrideHardBlocked,
      toolName: "read_logs",
      actionName: "read_file_log",
    });
    targetPath = resolved.resolvedPath;
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    return {
      source,
      resolvedPath: targetPath || "none",
      totalLinesScanned: 0,
      matchedCount: 0,
      lines: [],
    };
  }

  let filterRegex: RegExp | null = null;
  if (regex) {
    try {
      filterRegex = new RegExp(regex, "i");
    } catch {
      filterRegex = null;
    }
  }

  const startTimeMs = timeStart ? new Date(timeStart).getTime() : null;
  const endTimeMs = timeEnd ? new Date(timeEnd).getTime() : null;

  const rawContent = fs.readFileSync(targetPath, "utf-8");
  const rawLines = rawContent.split(/\r?\n/).filter(Boolean);
  const totalLinesScanned = rawLines.length;

  const matched: LogEntryResult[] = [];

  for (let idx = rawLines.length - 1; idx >= 0; idx--) {
    const parsed = parseLogLine(rawLines[idx]);
    if (!parsed.raw) continue;

    // Regex filter
    if (filterRegex && !filterRegex.test(parsed.raw)) {
      continue;
    }

    // Time filter
    if (parsed.timestamp) {
      const tMs = new Date(parsed.timestamp).getTime();
      if (!isNaN(tMs)) {
        if (startTimeMs !== null && tMs < startTimeMs) continue;
        if (endTimeMs !== null && tMs > endTimeMs) continue;
      }
    }

    matched.unshift(parsed);
    if (matched.length >= tail) {
      break;
    }
  }

  return {
    source,
    resolvedPath: targetPath,
    totalLinesScanned,
    matchedCount: matched.length,
    lines: matched,
  };
}

/**
 * Gathers recent errors across Sanctum logs, audit denials, and terminal errors
 * for the automated "Diagnose" workflow.
 */
export function getRecentDiagnosticErrors(limit: number = 20): LogEntryResult[] {
  const errors: LogEntryResult[] = [];

  // 1. Sanctum app logs
  try {
    const appLogs = readLogs({ source: "sanctum", tail: 100, regex: "error|exception|fail" });
    errors.push(...appLogs.lines);
  } catch {}

  // 2. Audit log denials
  try {
    const auditLogs = readLogs({ source: "audit", tail: 100, regex: '"decision":"denied"' });
    errors.push(...auditLogs.lines);
  } catch {}

  // 3. Most recent terminal task errors
  try {
    const termLogs = readLogs({ source: "terminal", tail: 100, regex: "error|failed|exception|exit_code" });
    errors.push(...termLogs.lines);
  } catch {}

  return errors.slice(-limit);
}
