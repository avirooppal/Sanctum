import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import {
  createCheckpoint,
  listCheckpoints,
  getCheckpoint,
  rewindCheckpoint,
  enrichCheckpointWithDiffs,
  applyCheckpointHunks,
  type RewindMode,
} from "@core/infra/checkpoints/checkpoint_manager.ts";

function getWorkspaceState(): { root: string; id: string } {
  const dataDir = getSanctumDataDir();
  const cfgPath = path.join(dataDir, "tool_workspace.txt");
  const idPath = path.join(dataDir, "tool_workspace_id.txt");
  const wsMetaFile = path.join(dataDir, "workspace.json");
  let root = path.join(dataDir, "workspace");

  try {
    if (fs.existsSync(cfgPath)) {
      const saved = fs.readFileSync(cfgPath, "utf-8").trim();
      if (saved && fs.existsSync(saved)) root = path.resolve(saved);
    } else if (fs.existsSync(wsMetaFile)) {
      const parsed = JSON.parse(fs.readFileSync(wsMetaFile, "utf-8"));
      if (parsed && typeof parsed.root === "string" && fs.existsSync(parsed.root)) {
        root = path.resolve(parsed.root);
      }
    }
  } catch {}

  let id = Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16);
  try {
    if (fs.existsSync(idPath)) {
      id = fs.readFileSync(idPath, "utf-8").trim() || id;
    }
  } catch {}

  return { root, id };
}

export async function GET(req: NextRequest) {
  try {
    const ws = getWorkspaceState();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
    const checkpoints = listCheckpoints(ws.id, limit).map((cp) => enrichCheckpointWithDiffs(cp));
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

      return NextResponse.json(enrichCheckpointWithDiffs(checkpoint));
    }

    if (action === "diff") {
      const cpId = String(body.checkpointId || "");
      const cp = cpId ? getCheckpoint(ws.id, cpId) : listCheckpoints(ws.id, 1)[0] || null;
      if (!cp) {
        return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
      }
      return NextResponse.json(enrichCheckpointWithDiffs(cp));
    }

    if (action === "apply_hunks") {
      const checkpointId = String(body.checkpointId || "");
      const relPath = String(body.path || "");
      const acceptedHunkIndices = Array.isArray(body.acceptedHunkIndices)
        ? body.acceptedHunkIndices.map(Number)
        : [];
      const updated = applyCheckpointHunks({
        workspaceId: ws.id,
        checkpointId,
        path: relPath,
        acceptedHunkIndices,
      });
      return NextResponse.json(updated);
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
