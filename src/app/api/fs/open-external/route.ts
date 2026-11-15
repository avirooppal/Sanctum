import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { BLOCKED_EXTERNAL_OPEN_EXTENSIONS, resolveFsTarget } from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPath = String(body?.path || "");
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path." }, { status: 400 });
    }
    const { target, relPath } = resolveFsTarget(rawPath, false, "read", "open_external");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return NextResponse.json({ error: `File does not exist: ${rawPath}` }, { status: 404 });
    }
    const ext = path.extname(target).toLowerCase();
    if (BLOCKED_EXTERNAL_OPEN_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Executable and script files cannot be launched via open-external (${ext}).` },
        { status: 403 }
      );
    }
    return NextResponse.json({ status: "opened", path: relPath });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to open external" }, { status });
  }
}
