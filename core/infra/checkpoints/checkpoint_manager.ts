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

export interface DiffHunkLine {
  type: "context" | "add" | "del";
  text: string;
  oldLine: number;
  newLine: number;
}

export interface CheckpointDiffHunk {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  added: number;
  removed: number;
  lines: DiffHunkLine[];
}

export interface FileDiffSummary {
  path: string;
  status: "added" | "modified" | "deleted";
  added: number;
  removed: number;
  hunks: CheckpointDiffHunk[];
}

export interface EnrichedCheckpoint extends Checkpoint {
  fileDiffs: FileDiffSummary[];
  filesChanged: number;
  totalAdded: number;
  totalRemoved: number;
}

function splitLinesNormalized(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function computeFileDiffWithHunks(
  relPath: string,
  existsBefore: boolean,
  originalContent: string | null,
  existsNow: boolean,
  currentContent: string | null
): FileDiffSummary {
  const status: "added" | "modified" | "deleted" =
    !existsBefore && existsNow ? "added" : existsBefore && !existsNow ? "deleted" : "modified";
  const oldLines = existsBefore && originalContent !== null ? splitLinesNormalized(originalContent) : [];
  const newLines = existsNow && currentContent !== null ? splitLinesNormalized(currentContent) : [];

  const n = Math.min(oldLines.length, 2000);
  const m = Math.min(newLines.length, 2000);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const edits: DiffHunkLine[] = [];
  let x = 0;
  let y = 0;
  let totalAdded = 0;
  let totalRemoved = 0;

  while (x < n && y < m) {
    if (oldLines[x] === newLines[y]) {
      edits.push({ type: "context", text: oldLines[x], oldLine: x + 1, newLine: y + 1 });
      x++;
      y++;
    } else if (dp[x + 1][y] >= dp[x][y + 1]) {
      edits.push({ type: "del", text: oldLines[x], oldLine: x + 1, newLine: -1 });
      totalRemoved++;
      x++;
    } else {
      edits.push({ type: "add", text: newLines[y], oldLine: -1, newLine: y + 1 });
      totalAdded++;
      y++;
    }
  }
  while (x < n) {
    edits.push({ type: "del", text: oldLines[x], oldLine: x + 1, newLine: -1 });
    totalRemoved++;
    x++;
  }
  while (y < m) {
    edits.push({ type: "add", text: newLines[y], oldLine: -1, newLine: y + 1 });
    totalAdded++;
    y++;
  }

  const hunks: CheckpointDiffHunk[] = [];
  let idx = 0;
  let hunkIndex = 0;
  while (idx < edits.length) {
    if (edits[idx].type === "context") {
      idx++;
      continue;
    }
    const startIdx = Math.max(0, idx - 3);
    let endIdx = idx;
    while (endIdx < edits.length) {
      if (edits[endIdx].type !== "context") {
        endIdx++;
        continue;
      }
      let nextChange = endIdx;
      while (nextChange < edits.length && edits[nextChange].type === "context") {
        nextChange++;
      }
      if (nextChange < edits.length && nextChange - endIdx <= 6) {
        endIdx = nextChange + 1;
      } else {
        endIdx = Math.min(edits.length, endIdx + 3);
        break;
      }
    }

    const hunkLines: DiffHunkLine[] = [];
    let oldStart = -1;
    let newStart = -1;
    let oldCount = 0;
    let newCount = 0;
    let hunkAdded = 0;
    let hunkRemoved = 0;

    for (let k = startIdx; k < endIdx; k++) {
      const e = edits[k];
      if (e.oldLine > 0 && oldStart < 0) oldStart = e.oldLine;
      if (e.newLine > 0 && newStart < 0) newStart = e.newLine;
      if (e.type === "context" || e.type === "del") oldCount++;
      if (e.type === "context" || e.type === "add") newCount++;
      if (e.type === "add") hunkAdded++;
      if (e.type === "del") hunkRemoved++;
      hunkLines.push(e);
    }
    if (oldStart < 0) oldStart = 1;
    if (newStart < 0) newStart = 1;

    hunks.push({
      index: hunkIndex++,
      oldStart,
      oldLines: oldCount,
      newStart,
      newLines: newCount,
      header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      added: hunkAdded,
      removed: hunkRemoved,
      lines: hunkLines,
    });
    idx = endIdx;
  }

  return {
    path: relPath,
    status,
    added: totalAdded,
    removed: totalRemoved,
    hunks,
  };
}

export function enrichCheckpointWithDiffs(cp: Checkpoint): EnrichedCheckpoint {
  const fileDiffs: FileDiffSummary[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const f of cp.files || []) {
    const existsNow = Boolean(f.fullPath && fs.existsSync(f.fullPath));
    let currContent: string | null = null;
    if (existsNow) {
      try {
        currContent = fs.readFileSync(f.fullPath, "utf-8");
      } catch {
        currContent = null;
      }
    }
    if (f.existsBefore === existsNow && (f.originalContent ?? "") === (currContent ?? "")) {
      continue;
    }
    const fd = computeFileDiffWithHunks(f.relativePath, f.existsBefore, f.originalContent, existsNow, currContent);
    totalAdded += fd.added;
    totalRemoved += fd.removed;
    fileDiffs.push(fd);
  }

  return {
    ...cp,
    fileDiffs,
    filesChanged: fileDiffs.length,
    totalAdded,
    totalRemoved,
  };
}

export function applyCheckpointHunks(options: {
  workspaceId: string;
  checkpointId: string;
  path: string;
  acceptedHunkIndices: number[];
}): EnrichedCheckpoint {
  const cp = getCheckpoint(options.workspaceId, options.checkpointId);
  if (!cp) throw new Error(`Checkpoint not found: ${options.checkpointId}`);
  const norm = options.path.replace(/\\/g, "/");
  const matched = cp.files.find((f) => f.relativePath.replace(/\\/g, "/").toLowerCase() === norm.toLowerCase());
  if (!matched) throw new Error(`File not found in checkpoint: ${options.path}`);

  const origContent = matched.originalContent ?? "";
  const currContent = fs.existsSync(matched.fullPath) ? fs.readFileSync(matched.fullPath, "utf-8") : "";
  const oldLines = origContent ? splitLinesNormalized(origContent) : [];
  const diff = computeFileDiffWithHunks(norm, matched.existsBefore, origContent, true, currContent);
  const accepted = new Set(options.acceptedHunkIndices);

  const resultLines: string[] = [];
  let oldCursor = 0;

  for (const h of diff.hunks) {
    let hunkFirstOldIndex = oldLines.length;
    for (const hl of h.lines) {
      if (hl.oldLine > 0) {
        hunkFirstOldIndex = hl.oldLine - 1;
        break;
      }
    }
    while (oldCursor < hunkFirstOldIndex && oldCursor < oldLines.length) {
      resultLines.push(oldLines[oldCursor]);
      oldCursor++;
    }
    const accept = accepted.has(h.index);
    for (const hl of h.lines) {
      if (hl.type === "context") {
        resultLines.push(hl.text);
        oldCursor++;
      } else if (hl.type === "del") {
        if (!accept) resultLines.push(hl.text);
        oldCursor++;
      } else if (hl.type === "add") {
        if (accept) resultLines.push(hl.text);
      }
    }
  }
  while (oldCursor < oldLines.length) {
    resultLines.push(oldLines[oldCursor]);
    oldCursor++;
  }

  fs.mkdirSync(path.dirname(matched.fullPath), { recursive: true });
  fs.writeFileSync(matched.fullPath, resultLines.join("\n"), "utf-8");
  return enrichCheckpointWithDiffs(cp);
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
