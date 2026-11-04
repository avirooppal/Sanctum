import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getMcpConfigFile(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "mcp_servers.json");
}

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
    const file = getMcpConfigFile();
    const servers = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : null;
    const plugins = discoverFolderPlugins();
    return NextResponse.json({ servers, plugins });
  } catch {
    return NextResponse.json({ servers: null, plugins: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const file = getMcpConfigFile();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(body.servers ?? body, null, 2), "utf-8");
    fs.renameSync(tmp, file);
    return NextResponse.json({ status: "saved" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
