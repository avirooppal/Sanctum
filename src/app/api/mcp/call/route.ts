import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "../../../../../core/ai/mcp/client_manager.ts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const serverId = typeof body?.serverId === "string" ? body.serverId.trim() : "";
    const toolName = typeof body?.toolName === "string" ? body.toolName.trim() : "";
    const args = body?.arguments && typeof body.arguments === "object" ? body.arguments : {};
    const workspaceRoot = typeof body?.workspaceRoot === "string" ? body.workspaceRoot : undefined;

    if (!serverId || !toolName) {
      return NextResponse.json(
        { ok: false, error: "serverId and toolName are required" },
        { status: 400 }
      );
    }

    const res = await mcpClientManager.callTool(serverId, toolName, args, workspaceRoot);
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "MCP tool execution failed" },
      { status: 500 }
    );
  }
}
