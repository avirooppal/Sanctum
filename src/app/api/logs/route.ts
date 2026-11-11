import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";

function getLogPath(): string {
  return path.join(getSanctumDataDir(), "logs", "desktop.jsonl");
}

export async function GET() {
  try {
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ entries: [], path: logPath });
    }

    const lines = fs.readFileSync(logPath, "utf-8").split(/\r?\n/).filter(Boolean);
    const recent = lines.slice(-300).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { time: new Date().toISOString(), level: "info", category: "general", message: line };
      }
    });

    return NextResponse.json({ entries: recent, path: logPath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load logs" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const logPath = getLogPath();
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    if (fs.existsSync(logPath + ".1")) fs.unlinkSync(logPath + ".1");
    return NextResponse.json({ cleared: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to clear logs" }, { status: 500 });
  }
}
