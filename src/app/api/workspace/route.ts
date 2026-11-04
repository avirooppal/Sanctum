import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getSanctumDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getWorkspaceState(): { root: string; id: string } {
  const dataDir = getSanctumDataDir();
  const cfgPath = path.join(dataDir, "tool_workspace.txt");
  const idPath = path.join(dataDir, "tool_workspace_id.txt");
  let root = path.join(dataDir, "workspace");

  if (fs.existsSync(cfgPath)) {
    const saved = fs.readFileSync(cfgPath, "utf-8").trim();
    if (saved && fs.existsSync(saved)) {
      root = path.resolve(saved);
    }
  }
  fs.mkdirSync(root, { recursive: true });

  let id = "default-workspace";
  if (fs.existsSync(idPath)) {
    id = fs.readFileSync(idPath, "utf-8").trim() || id;
  } else {
    id = crypto.randomUUID().replace(/-/g, "");
    fs.writeFileSync(idPath, id, "utf-8");
  }

  return { root, id };
}

export async function GET() {
  try {
    return NextResponse.json(getWorkspaceState());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nextRoot = String(body?.root || "").trim();
    if (!nextRoot) {
      return NextResponse.json({ error: "Missing root path" }, { status: 400 });
    }
    const resolved = path.resolve(nextRoot);
    fs.mkdirSync(resolved, { recursive: true });
    const dataDir = getSanctumDataDir();
    const newId = crypto.randomUUID().replace(/-/g, "");
    fs.writeFileSync(path.join(dataDir, "tool_workspace.txt"), resolved, "utf-8");
    fs.writeFileSync(path.join(dataDir, "tool_workspace_id.txt"), newId, "utf-8");
    return NextResponse.json({ root: resolved, id: newId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
