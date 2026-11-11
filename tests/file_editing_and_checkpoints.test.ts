import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  computeStructuredDiff,
  applyAcceptedHunks,
  generateUnifiedDiff,
  type DiffHunk,
} from "../core/infra/diff/diff_engine.ts";
import {
  createCheckpoint,
  listCheckpoints,
  rewindCheckpoint,
} from "../core/infra/checkpoints/checkpoint_manager.ts";
import { executePostEditHook } from "../core/infra/hooks/post_edit_hook.ts";

test("File Editing UX, Diff Engine & Checkpoint Test Suite", async (t) => {
  const tmpRoot = path.join(os.tmpdir(), "sanctum-diff-test-" + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });

  t.after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  await t.test("1. Diff Engine: Computes structured hunks with line numbers", () => {
    const oldText = "line 1\nline 2\nline 3\nline 4\nline 5";
    const newText = "line 1\nline 2 modified\nline 3\nline 4\nline 5 added";

    const diff = computeStructuredDiff("test.txt", oldText, newText);

    assert.equal(diff.filePath, "test.txt");
    assert.ok(diff.hunks.length >= 1);
    assert.equal(diff.totalAdditions, 2);
    assert.equal(diff.totalDeletions, 2);

    const unified = generateUnifiedDiff(diff);
    assert.ok(unified.includes("--- a/test.txt"));
    assert.ok(unified.includes("+++ b/test.txt"));
    assert.ok(unified.includes("+line 2 modified"));
  });

  await t.test("2. Diff Engine: Identical files yield zero hunks", () => {
    const text = "constant alpha\nconstant beta";
    const diff = computeStructuredDiff("same.txt", text, text);
    assert.equal(diff.hunks.length, 0);
    assert.equal(diff.totalAdditions, 0);
    assert.equal(diff.totalDeletions, 0);
  });

  await t.test("3. Diff Engine: Per-hunk selective acceptance", () => {
    const oldText = "A\nB\nC\nD\nE\nF\nG\nH\nI\nJ";
    // Change A->A_NEW, and change J->J_NEW
    const newText = "A_NEW\nB\nC\nD\nE\nF\nG\nH\nI\nJ_NEW";

    const diff = computeStructuredDiff("multihunk.txt", oldText, newText, 1);
    assert.equal(diff.hunks.length, 2);

    // Accept first hunk, reject second hunk
    const modifiedHunks: DiffHunk[] = [
      { ...diff.hunks[0], status: "accepted" },
      { ...diff.hunks[1], status: "rejected" },
    ];

    const result = applyAcceptedHunks(oldText, modifiedHunks);
    const resultLines = result.split("\n");

    // First hunk accepted -> A_NEW
    assert.equal(resultLines[0], "A_NEW");
    // Second hunk rejected -> kept original J
    assert.equal(resultLines[resultLines.length - 1], "J");
  });

  await t.test("4. Checkpoints: Creates snapshot and rewinds file modifications", () => {
    const fileA = path.join(tmpRoot, "fileA.txt");
    fs.writeFileSync(fileA, "original version of fileA", "utf-8");

    const wsId = "test-ws-" + Date.now();
    const cp = createCheckpoint({
      workspaceId: wsId,
      workspaceRoot: tmpRoot,
      affectedFilePaths: [fileA],
      summary: "Before editing fileA",
      conversationSnapshot: [{ role: "user", content: "edit fileA" }],
    });

    assert.ok(cp.id.startsWith("cp-"));
    assert.equal(cp.files.length, 1);
    assert.equal(cp.files[0].originalContent, "original version of fileA");

    // Simulate aggressive edit
    fs.writeFileSync(fileA, "CORRUPTED CONTENT AFTER TURN", "utf-8");

    // Rewind files
    const rewindRes = rewindCheckpoint({
      workspaceId: wsId,
      checkpointId: cp.id,
      mode: "files",
    });

    assert.equal(rewindRes.restoredFiles.length, 1);
    const restoredContent = fs.readFileSync(fileA, "utf-8");
    assert.equal(restoredContent, "original version of fileA");
  });

  await t.test("5. Checkpoints: Rewinding deletes files created during the turn", () => {
    const fileNew = path.join(tmpRoot, "created_in_turn.txt");
    const wsId = "test-ws-new-" + Date.now();

    // Checkpoint records that fileNew does NOT exist before turn
    const cp = createCheckpoint({
      workspaceId: wsId,
      workspaceRoot: tmpRoot,
      affectedFilePaths: [fileNew],
      summary: "Before creating fileNew",
    });

    assert.equal(cp.files[0].existsBefore, false);

    // File is created during turn
    fs.writeFileSync(fileNew, "newly spawned content", "utf-8");
    assert.ok(fs.existsSync(fileNew));

    // Rewind deletes it
    const rewindRes = rewindCheckpoint({
      workspaceId: wsId,
      checkpointId: cp.id,
      mode: "files",
    });

    assert.equal(rewindRes.deletedFiles.length, 1);
    assert.equal(fs.existsSync(fileNew), false);
  });

  await t.test("6. Post-Edit Hook: Executes linter command and captures diagnostics", async () => {
    const hookRes = await executePostEditHook({
      workspaceRoot: tmpRoot,
      filePath: "src/index.ts",
      hookCommand: "powershell -Command \"Write-Error 'Syntax error in %FILE% on line 42'\"",
      enabled: true,
    });

    assert.equal(hookRes.executed, true);
    assert.equal(hookRes.success, false);
    assert.ok(hookRes.diagnostics && hookRes.diagnostics.includes("Syntax error in \"src/index.ts\""));
  });
});
