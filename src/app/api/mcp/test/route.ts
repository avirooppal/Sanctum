import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager, type McpServerConfig } from "../../../../../core/ai/mcp/client_manager.ts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const server = body?.server as McpServerConfig | undefined;
    const workspaceRoot = typeof body?.workspaceRoot === "string" ? body.workspaceRoot : undefined;
    if (!server || !server.id || !server.name) {
      return NextResponse.json({ ok: false, error: "Invalid MCP server config" }, { status: 400 });
    }
    const result = await mcpClientManager.testServerConnection(server, workspaceRoot);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, latencyMs: 0, tools: [], error: err?.message || "MCP test failed" },
      { status: 500 }
    );
  }
}
