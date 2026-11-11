import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;
  path?: string;
  command?: string;
  action: string;
  scope: string;
  decision: "allowed" | "denied";
  reason?: string;
  details?: Record<string, any>;
}

export function getSanctumDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

export function getAuditLogPath(): string {
  return path.join(getSanctumDataDir(), "audit.log");
}

export function recordAuditLog(
  entry: Omit<AuditEntry, "id" | "timestamp"> & { id?: string; timestamp?: string }
): AuditEntry {
  const record: AuditEntry = {
    id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    tool: entry.tool,
    path: entry.path,
    command: entry.command,
    action: entry.action,
    scope: entry.scope,
    decision: entry.decision,
    reason: entry.reason,
    details: entry.details,
  };

  try {
    const logPath = getAuditLogPath();
    const line = JSON.stringify(record) + "\n";
    fs.appendFileSync(logPath, line, "utf-8");
  } catch (err) {
    console.error("Failed to write to audit log:", err);
  }

  return record;
}

export function readRecentAuditLogs(limit: number = 200): AuditEntry[] {
  const logPath = getAuditLogPath();
  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries: AuditEntry[] = [];
    const start = Math.max(0, lines.length - limit);
    for (let i = lines.length - 1; i >= start; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        entries.push(parsed);
      } catch {}
    }
    return entries;
  } catch (err) {
    console.error("Failed to read audit logs:", err);
    return [];
  }
}

export function clearAuditLogs(): void {
  const logPath = getAuditLogPath();
  try {
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "", "utf-8");
    }
  } catch {}
}
