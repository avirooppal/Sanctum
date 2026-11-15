import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { resolveFsTarget } from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPath = String(body?.path || ".");
    const { target, relPath } = resolveFsTarget(rawPath, true, "read", "reveal");
    if (!fs.existsSync(target)) {
      return NextResponse.json({ error: `Path does not exist: ${rawPath}` }, { status: 404 });
    }
    if (req.headers.get("x-sanctum-dry-run") !== "1" && process.platform === "win32") {
      const isFile = fs.statSync(target).isFile();
      const args = isFile ? [`/select,${target}`] : [target];
      spawn("explorer.exe", args, { detached: true, stdio: "ignore" }).unref();
    }
    return NextResponse.json({ status: "revealed", path: relPath });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to reveal path" }, { status });
  }
}
