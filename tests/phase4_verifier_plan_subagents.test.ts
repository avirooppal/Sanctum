import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 4.2-4.4: Real project verifier, editable Plan mode artifact & orphan worktree cleanup", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p4-234-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("discovers real package.json/pyproject verification commands, saves editable PLAN.md, and cleans orphan worktrees on startup", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "project");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(
      path.join(wsDir, "package.json"),
      JSON.stringify({ name: "demo", scripts: { test: "node --test", typecheck: "tsc --noEmit", lint: "eslint ." } }),
      "utf-8"
    );

    // Seed an orphan worktree directory before daemon starts
    const orphanWt = path.join(dataDir, "worktrees", "wt_orphan_crash");
    fs.mkdirSync(orphanWt, { recursive: true });
    fs.writeFileSync(path.join(orphanWt, "stale.txt"), "stale", "utf-8");

    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, "--provider", "mock"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    procs.push(proc);

    const info: any = await new Promise((resolve, reject) => {
      let buf = "";
      proc.stdout!.on("data", (d: Buffer) => {
        buf += d.toString("utf-8");
        const nl = buf.indexOf("\n");
        if (nl >= 0) resolve(JSON.parse(buf.slice(0, nl).trim()));
      });
      proc.on("exit", (code) => reject(new Error(`Exit ${code}`)));
    });

    // 1. Orphan worktree cleaned up automatically on startup
    assert.equal(fs.existsSync(orphanWt), false, "Orphan worktree must be cleaned on startup");

    const baseUrl = `http://127.0.0.1:${info.httpPort}`;
    const headers = { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" };

    const sess = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Verify & Plan", workspace: wsDir, mode: "plan", model: "mock" }),
      })
    ).json();

    // 2. Discover real verification commands from package.json
    const verRes = await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    assert.equal(verRes.status, 200);
    const ver = await verRes.json();
    assert.equal(ver.discoveredCount, 3);
    assert.ok(ver.commands.some((c: any) => c.command === "npm run test"));
    assert.ok(ver.commands.some((c: any) => c.command === "npm run typecheck"));
    assert.equal(ver.maxRepairAttempts, 3);

    // 3. Editable Plan mode artifact persisted & verified
    const planRes = await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/plan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "# Plan\n- [x] Inspect project\n- [ ] Add feature\n" }),
    });
    assert.equal(planRes.status, 200);
    const plan = await planRes.json();
    assert.equal(plan.saved, true);
    assert.equal(plan.verification.totalChecklistItems, 2);
    assert.equal(plan.verification.completedItems, 1);
    assert.equal(plan.verification.status, "partial");
    assert.ok(fs.existsSync(path.join(wsDir, "PLAN.md")));
  });
});
