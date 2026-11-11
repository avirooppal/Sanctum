import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import {
  createCheckpoint,
  listCheckpoints,
  rewindCheckpoint,
  type RewindMode,
} from "@core/infra/checkpoints/checkpoint_manager.ts";

function getWorkspaceState(): { root: string; id: string } {
  const dataDir = getSanctumDataDir();
  const wsMetaFile = path.join(dataDir, "workspace.json");
  const defaultRoot = path.join(dataDir, "workspace");
  try {
    if (fs.existsSync(wsMetaFile)) {
      const parsed = JSON.parse(fs.readFileSync(wsMetaFile, "utf-8"));
      if (parsed && typeof parsed.root === "string" && fs.existsSync(parsed.root)) {
        const root = path.resolve(parsed.root);
        return { root, id: Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16) };
      }
    }
  } catch {}
  const root = path.resolve(defaultRoot);
  return { root, id: Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16) };
}

export async function GET(req: NextRequest) {
  try {
    const ws = getWorkspaceState();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
    const checkpoints = listCheckpoints(ws.id, limit);
    return NextResponse.json({ checkpoints, workspaceId: ws.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load checkpoints" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ws = getWorkspaceState();
    const action = String(body.action || "create");

    if (action === "create") {
      const affectedFiles = Array.isArray(body.affectedFiles) ? body.affectedFiles : [];
      const summary = String(body.summary || "Manual checkpoint");
      const conversationSnapshot = Array.isArray(body.conversationSnapshot) ? body.conversationSnapshot : undefined;

      const checkpoint = createCheckpoint({
        workspaceId: ws.id,
        workspaceRoot: ws.root,
        affectedFilePaths: affectedFiles,
        summary,
        conversationSnapshot,
      });

      return NextResponse.json(checkpoint);
    }

    if (action === "rewind") {
      const checkpointId = String(body.checkpointId || "");
      const mode = (body.mode as RewindMode) || "both";

      const result = rewindCheckpoint({
        workspaceId: ws.id,
        checkpointId,
        mode,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported checkpoint action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Checkpoint operation failed" }, { status: 400 });
  }
}
