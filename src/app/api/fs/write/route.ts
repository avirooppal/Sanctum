import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createCheckpoint } from "@core/infra/checkpoints/checkpoint_manager.ts";
import { computeRevisionHash, resolveFsTarget } from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPath = String(body?.path || "");
    const content = typeof body?.content === "string" ? body.content : "";
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path." }, { status: 400 });
    }
    if (Buffer.byteLength(content, "utf-8") > 5242880) {
      return NextResponse.json({ error: "File content exceeds 5 MiB write limit." }, { status: 413 });
    }

    const { target, relPath, ws } = resolveFsTarget(rawPath, false, "write", "edit");
    const cp = createCheckpoint({
      workspaceId: ws.id,
      workspaceRoot: ws.root,
      affectedFilePaths: [target],
      summary: `Raw editor save: ${relPath}`,
    });

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");

    return NextResponse.json({
      status: "saved",
      path: relPath,
      revision: computeRevisionHash(Buffer.from(content, "utf-8")),
      checkpointId: cp.id,
    });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to write file" }, { status });
  }
}
