import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getMemoryFilePath(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "memory.json");
}

export async function GET() {
  try {
    const file = getMemoryFilePath();
    if (!fs.existsSync(file)) {
      return NextResponse.json({ enabled: true, facts: [], episodes: [] });
    }
    const raw = fs.readFileSync(file, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ enabled: true, facts: [], episodes: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const file = getMemoryFilePath();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2), "utf-8");
    fs.renameSync(tmp, file);
    return NextResponse.json({ status: "saved" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const file = getMemoryFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return NextResponse.json({ status: "cleared" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
