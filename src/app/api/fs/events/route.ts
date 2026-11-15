import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceAndScope } from "../_shared";

export async function GET(req: NextRequest) {
  const ws = getWorkspaceAndScope();
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since")) || 0;
  return NextResponse.json({
    seq: since,
    workspaceId: ws.id,
    events: [],
  });
}
