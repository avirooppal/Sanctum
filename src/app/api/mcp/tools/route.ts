import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "../../../../../core/ai/mcp/client_manager.ts";

export async function GET(req: NextRequest) {
  try {
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const workspaceRoot = req.nextUrl.searchParams.get("workspaceRoot") || undefined;
    const { tools, errors } = await mcpClientManager.listAllEnabledTools(workspaceRoot, refresh);
    return NextResponse.json({ tools, errors });
  } catch (err: any) {
    return NextResponse.json(
      { tools: [], errors: [{ serverId: "mcp", serverName: "MCP", error: err?.message || "Discovery failed" }] },
      { status: 500 }
    );
  }
}
