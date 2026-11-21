import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  MCP_CONNECTOR_PRESETS,
  mcpClientManager,
  readMcpServersConfig,
  writeMcpServersConfig,
  type McpServerConfig,
} from "../../../../core/ai/mcp/client_manager.ts";

function discoverFolderPlugins(): any[] {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const pluginsDir = path.join(appData, "Sanctum", "plugins");
  if (!fs.existsSync(pluginsDir)) return [];
  const found: any[] = [];
  try {
    for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(pluginsDir, entry.name, "tool.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          found.push({ id: entry.name, ...manifest });
        } catch {}
      }
    }
  } catch {}
  return found;
}

export async function GET() {
  try {
    const servers = readMcpServersConfig();
    const plugins = discoverFolderPlugins();
    return NextResponse.json({
      servers: servers.length > 0 ? servers : null,
      plugins,
      presets: MCP_CONNECTOR_PRESETS,
    });
  } catch {
    return NextResponse.json({ servers: null, plugins: [], presets: MCP_CONNECTOR_PRESETS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const servers: McpServerConfig[] = Array.isArray(body?.servers)
      ? body.servers
      : Array.isArray(body)
        ? body
        : [];
    writeMcpServersConfig(servers);
    mcpClientManager.invalidateAll();
    return NextResponse.json({ status: "saved", count: servers.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save MCP servers" }, { status: 400 });
  }
}
