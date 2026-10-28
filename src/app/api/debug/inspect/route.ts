import { NextRequest, NextResponse } from "next/server";
import { defaultSettingsStore } from "../../../../../core/infra/storage/settings_store.ts";
import { gateDebugRequest } from "../../../../../core/ai/observability/debug_gate.ts";
import { getOrCreateDebugToken } from "../../../../../core/ai/observability/debug_token.ts";
import { globalInspectStore } from "../../../../../core/ai/observability/inspect.ts";

export async function GET(req: NextRequest) {
  const isEnabled = Boolean(defaultSettingsStore.get("developer.inspectRequests"));
  const presentedToken = req.headers.get("x-sanctum-debug-token");
  const expectedToken = getOrCreateDebugToken();

  const gateResult = gateDebugRequest({
    enabled: isEnabled,
    presented: presentedToken,
    expected: expectedToken,
  });

  if (gateResult === 404) {
    return NextResponse.json({ error: "Debug inspection disabled" }, { status: 404 });
  }

  if (gateResult === 401) {
    return NextResponse.json({ error: "Unauthorized: invalid debug token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const traceId = searchParams.get("traceId");

  if (messageId) {
    const record = globalInspectStore.byMessage(messageId);
    if (!record) {
      return NextResponse.json({ error: "Inspect record not found" }, { status: 404 });
    }
    return NextResponse.json({ record });
  }

  if (traceId) {
    const record = globalInspectStore.byTrace(traceId);
    if (!record) {
      return NextResponse.json({ error: "Inspect record not found" }, { status: 404 });
    }
    return NextResponse.json({ record });
  }

  return NextResponse.json({
    status: "ok",
    records: globalInspectStore.list(),
  });
}
