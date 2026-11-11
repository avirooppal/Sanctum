import { NextRequest, NextResponse } from "next/server";
import { readRecentAuditLogs, clearAuditLogs } from "@core/infra/security/audit_logger.ts";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200));
    const entries = readRecentAuditLogs(limit);
    return NextResponse.json({ entries, total: entries.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load audit logs" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearAuditLogs();
    return NextResponse.json({ cleared: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to clear audit logs" }, { status: 500 });
  }
}
