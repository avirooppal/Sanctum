import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "../security/audit_logger.ts";

export interface SnapshotFile {
  relativePath: string;
  fullPath: string;
  originalContent: string | null; // null if file didn't exist before turn
  existsBefore: boolean;
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  workspaceId: string;
  turnId: string;
  summary: string;
  files: SnapshotFile[];
  conversationSnapshot?: any[];
}

export type RewindMode = "files" | "conversation" | "both";

export interface RewindResult {
  checkpointId: string;
  mode: RewindMode;
  restoredFiles: string[];
  deletedFiles: string[];
  conversationRestored: boolean;
  restoredConversation?: any[];
}

function getSnapshotsBaseDir(): string {
  const dir = path.join(getSanctumDataDir(), "snapshots");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

function getWorkspaceSnapshotDir(workspaceId: string): string {
  const dir = path.join(getSnapshotsBaseDir(), workspaceId || "default");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

/**
 * Creates a pre-turn snapshot of affected files and current conversation.
 */
export function createCheckpoint(options: {
  workspaceId: string;
  turnId?: string;
  summary: string;
  affectedFilePaths: string[]; // absolute or relative to workspace
  workspaceRoot: string;
  conversationSnapshot?: any[];
}): Checkpoint {
  const {
    workspaceId,
    turnId = `turn-${Date.now()}`,
    summary,
    affectedFilePaths,
    workspaceRoot,
    conversationSnapshot,
  } = options;

  const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const snapshotDir = getWorkspaceSnapshotDir(workspaceId);
  const cpDir = path.join(snapshotDir, id);
  fs.mkdirSync(cpDir, { recursive: true });

  const files: SnapshotFile[] = [];

  for (const rawPath of affectedFilePaths) {
    const fullPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspaceRoot, rawPath);
    const rel = path.relative(workspaceRoot, fullPath).replace(/\\/g, "/");

    let originalContent: string | null = null;
    let existsBefore = false;

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      existsBefore = true;
      try {
        originalContent = fs.readFileSync(fullPath, "utf-8");
      } catch {
        originalContent = null;
      }
    }

    files.push({
      relativePath: rel,
      fullPath,
      originalContent,
      existsBefore,
    });
  }

  const checkpoint: Checkpoint = {
    id,
    timestamp: new Date().toISOString(),
    workspaceId,
    turnId,
    summary,
    files,
    conversationSnapshot,
  };

  const metaPath = path.join(cpDir, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(checkpoint, null, 2), "utf-8");

  return checkpoint;
}

/**
 * Lists checkpoints for a workspace in reverse chronological order.
 */
export function listCheckpoints(workspaceId: string, limit: number = 50): Checkpoint[] {
  const snapshotDir = getWorkspaceSnapshotDir(workspaceId);
  if (!fs.existsSync(snapshotDir)) return [];

  try {
    const dirs = fs
      .readdirSync(snapshotDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({
        name: d.name,
        metaPath: path.join(snapshotDir, d.name, "meta.json"),
      }))
      .filter((d) => fs.existsSync(d.metaPath));

    const checkpoints: Checkpoint[] = [];
    for (const d of dirs) {
      try {
        const raw = fs.readFileSync(d.metaPath, "utf-8");
        const parsed = JSON.parse(raw);
        checkpoints.push(parsed);
      } catch {}
    }

    checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return checkpoints.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Gets a specific checkpoint by ID.
 */
export function getCheckpoint(workspaceId: string, checkpointId: string): Checkpoint | null {
  const cpDir = path.join(getWorkspaceSnapshotDir(workspaceId), checkpointId);
  const metaPath = path.join(cpDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Rewinds to a checkpoint.
 * mode: "files" | "conversation" | "both"
 */
export function rewindCheckpoint(options: {
  workspaceId: string;
  checkpointId: string;
  mode: RewindMode;
}): RewindResult {
  const { workspaceId, checkpointId, mode } = options;
  const cp = getCheckpoint(workspaceId, checkpointId);
  if (!cp) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  const restoredFiles: string[] = [];
  const deletedFiles: string[] = [];

  if (mode === "files" || mode === "both") {
    for (const f of cp.files) {
      if (f.existsBefore && f.originalContent !== null) {
        fs.mkdirSync(path.dirname(f.fullPath), { recursive: true });
        fs.writeFileSync(f.fullPath, f.originalContent, "utf-8");
        restoredFiles.push(f.relativePath);
      } else if (!f.existsBefore && fs.existsSync(f.fullPath)) {
        // File did not exist before turn -> delete it
        try {
          fs.unlinkSync(f.fullPath);
          deletedFiles.push(f.relativePath);
        } catch {}
      }
    }
  }

  const conversationRestored = (mode === "conversation" || mode === "both") && Boolean(cp.conversationSnapshot);

  return {
    checkpointId,
    mode,
    restoredFiles,
    deletedFiles,
    conversationRestored,
    restoredConversation: conversationRestored ? cp.conversationSnapshot : undefined,
  };
}
