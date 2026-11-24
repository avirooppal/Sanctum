import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 4.1: Shadow-git checkpoints & full rewind (shell mutations, secrets, node_modules, large binaries)", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p4-1-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("shadow-git rewinds shell rewrite + delete + create while preserving node_modules, large binaries, and excluding .env secrets", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(path.join(wsDir, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(wsDir, "app.ts"), "export const v = 1;\n", "utf-8");
    fs.writeFileSync(path.join(wsDir, "keep.txt"), "precious content\n", "utf-8");
    fs.writeFileSync(path.join(wsDir, "node_modules", "pkg", "index.js"), "module.exports = 1;\n", "utf-8");
    fs.writeFileSync(path.join(wsDir, ".env"), "SECRET_TOKEN=do_not_snapshot\n", "utf-8");
    fs.writeFileSync(path.join(wsDir, "big.bin"), Buffer.alloc(6 * 1024 * 1024, 0x42)); // 6 MB > 5 MB cap

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

    const baseUrl = `http://127.0.0.1:${info.httpPort}`;
    const headers = { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" };

    const sess = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Shadow Git", workspace: wsDir, model: "mock" }),
      })
    ).json();

    // 1. Create shadow-git checkpoint
    const cp = await (
      await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/checkpoints`, {
        method: "POST",
        headers,
        body: JSON.stringify({ label: "pre-shell" }),
      })
    ).json();
    assert.ok(cp.checkpointId);
    assert.ok(cp.shadowCommit && cp.shadowCommit.length >= 40, "shadowCommit SHA must be recorded");
    assert.equal(fs.existsSync(path.join(wsDir, ".git")), false, "Shadow git MUST stay outside user workspace");

    // Verify .env was NOT committed to shadow-git
    const lsTree = spawnSync("git", ["--git-dir", cp.shadowGitDir, "ls-tree", "-r", "--name-only", cp.shadowCommit], {
      encoding: "utf-8",
    });
    assert.equal(lsTree.stdout.includes(".env"), false, ".env secret must be excluded from shadow-git");
    assert.equal(lsTree.stdout.includes("big.bin"), false, "6 MB binary must be excluded from shadow-git");
    assert.equal(lsTree.stdout.includes("node_modules"), false, "node_modules must be excluded from shadow-git");

    // 2. Mutate workspace via shell command: rewrite app.ts, delete keep.txt, create junk.tmp
    const shellRes = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Set-Content app.ts 'CORRUPTED'; Remove-Item keep.txt; Set-Content junk.tmp 'junk'"],
      { cwd: wsDir, encoding: "utf-8" }
    );
    assert.equal(shellRes.status, 0);
    assert.equal(fs.existsSync(path.join(wsDir, "keep.txt")), false);
    assert.equal(fs.existsSync(path.join(wsDir, "junk.tmp")), true);

    // 3. Rewind via harness -> everything restored!
    const rw = await (
      await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/rewind`, {
        method: "POST",
        headers,
        body: JSON.stringify({ checkpointId: cp.checkpointId }),
      })
    ).json();
    assert.equal(rw.files?.engine || rw.engine, "shadow_git");
    assert.equal(fs.readFileSync(path.join(wsDir, "app.ts"), "utf-8").trim(), "export const v = 1;");
    assert.equal(fs.readFileSync(path.join(wsDir, "keep.txt"), "utf-8").trim(), "precious content");
    assert.equal(fs.existsSync(path.join(wsDir, "junk.tmp")), false, "junk.tmp must be cleaned on rewind");
    assert.equal(fs.existsSync(path.join(wsDir, "node_modules", "pkg", "index.js")), true, "node_modules must remain intact");
    assert.equal(fs.existsSync(path.join(wsDir, "big.bin")), true, "big.bin must remain intact");
    assert.equal(fs.existsSync(path.join(wsDir, ".env")), true, ".env must remain intact");
  });
});
