import { NextResponse } from "next/server";
import { getRecentDiagnosticErrors } from "@core/infra/logs/log_reader.ts";

export async function GET() {
  try {
    const errors = getRecentDiagnosticErrors(20);
    const count = errors.length;

    let errorSummary = "No recent system or tool errors detected.";
    if (count > 0) {
      errorSummary = errors
        .map((e, idx) => `[${idx + 1}] ${e.category || "system"} (${e.level || "error"}): ${e.message || e.raw}`)
        .join("\n");
    }

    const suggestedGoal = count > 0
      ? `Diagnose and fix the following recent errors:\n${errorSummary}`
      : "Perform a routine diagnostic check on project logs and configuration.";

    return NextResponse.json({
      count,
      errors,
      suggestedGoal,
      planMode: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to gather diagnostics" }, { status: 500 });
  }
}
