import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string; pipeName: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`Daemon timeout: ${stderr}`));
    }, 10000);
    proc.stdout!.on("data", (d: Buffer) => {
      buf += d.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        const info = JSON.parse(buf.slice(0, nl).trim());
        resolve({ proc, baseUrl: `http://127.0.0.1:${info.httpPort}`, token: info.token, pipeName: info.pipeName });
      }
    });
    proc.stderr!.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Daemon exited (${code}): ${stderr}`)); });
  });
}

function sendPipe(pipeName: string, method: string, reqPath: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const c = net.connect(`\\\\.\\pipe\\${pipeName}`, () => {
      c.write(JSON.stringify({ method, path: reqPath, body }) + "\n");
    });
    let buf = "";
    c.on("data", (ch) => {
      buf += ch.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        c.end();
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    });
    c.on("error", reject);
  });
}

describe("Part A1: Workspace registry, root validation, crash recovery & reversible migration", () => {
  test("Root validation rejects drive roots, profile root, system dirs, Sanctum dataDir, overlaps & junctions; warns on cloud-sync", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a1-val-"));
    const dataDir = path.join(tmpBase, "appdata");
    const wsParent = path.join(tmpBase, "projects");
    const wsA = path.join(wsParent, "alpha");
    const wsAChild = path.join(wsA, "sub");
    const wsJunction = path.join(tmpBase, "alpha_junction");
    const wsCloud = path.join(tmpBase, "OneDrive", "myrepo");
    fs.mkdirSync(wsAChild, { recursive: true });
    fs.mkdirSync(wsCloud, { recursive: true });

    // Create a real Windows directory junction pointing to wsA
    execFileSync("cmd.exe", ["/c", "mklink", "/J", wsJunction, wsA], { stdio: "ignore" });

    const { proc, baseUrl, token } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      // Reject drive root, user profile root, C:\Windows, and Sanctum dataDir
      for (const [badPath, expectedCode] of [
        ["C:\\", "drive_root_blocked"],
        [os.homedir(), "user_profile_root_blocked"],
        ["C:\\Windows", "system_path_blocked"],
        [dataDir, "sanctum_data_dir_blocked"],
      ] as const) {
        const r = await fetch(`${baseUrl}/v1/workspaces/validate-root`, {
          method: "POST",
          headers: hdr,
          body: JSON.stringify({ rootPath: badPath }),
        });
        assert.equal(r.status, 400, `Expected 400 for ${badPath}`);
        const b = await r.json() as { ok: boolean; code: string };
        assert.equal(b.ok, false);
        assert.equal(b.code, expectedCode);
      }

      // Create workspace Alpha
      const createRes = await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({ name: "Alpha", rootPath: wsA, color: "#10b981", icon: "code" }),
      });
      assert.equal(createRes.status, 201);
      const alpha = await createRes.json() as { id: string; rootStatus: string };
      assert.match(alpha.id, /^ws_[0-9a-f]{32}$/);
      assert.equal(alpha.rootStatus, "ok");

      // Overlap checks: equal, nested child, parent, and junction to Alpha -> all 409 with existingWorkspaceId
      for (const overlapPath of [wsA, wsAChild, wsParent, wsJunction]) {
        const r = await fetch(`${baseUrl}/v1/workspaces/validate-root`, {
          method: "POST",
          headers: hdr,
          body: JSON.stringify({ rootPath: overlapPath }),
        });
        assert.equal(r.status, 409, `Expected 409 overlap for ${overlapPath}`);
        const b = await r.json() as { code: string; existingWorkspaceId: string };
        assert.equal(b.code, "workspace_root_overlap");
        assert.equal(b.existingWorkspaceId, alpha.id);
      }

      // Cloud-synced folder succeeds with non-blocking warning
      const cloudRes = await fetch(`${baseUrl}/v1/workspaces/validate-root`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({ rootPath: wsCloud }),
      });
      assert.equal(cloudRes.status, 200);
      const cloudBody = await cloudRes.json() as { ok: boolean; warnings: string[] };
      assert.equal(cloudBody.ok, true);
      assert.ok(cloudBody.warnings.some((w) => w.toLowerCase().includes("cloud-synced")));
    } finally {
      try { proc.kill(); } catch {}
      try { execFileSync("cmd.exe", ["/c", "rmdir", wsJunction], { stdio: "ignore" }); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  test("Missing root, UI state, crash recovery from .bak, and trusted-channel delete (user folder untouched)", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a1-crud-"));
    const dataDir = path.join(tmpBase, "appdata");
    const wsFolder = path.join(tmpBase, "beta");
    const wsMoved = path.join(tmpBase, "beta_moved");
    fs.mkdirSync(wsFolder, { recursive: true });
    fs.writeFileSync(path.join(wsFolder, "keep.txt"), "user data", "utf-8");

    let daemon = await startDaemon(dataDir);
    let hdr = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };
    let betaId = "";
    try {
      const c = await fetch(`${daemon.baseUrl}/v1/workspaces`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({
          name: "Beta",
          rootPath: wsFolder,
          settingsOverrides: { defaultModel: "qwen3:4b", autonomyCeiling: "auto_reads", a2uiMode: "off" },
        }),
      });
      assert.equal(c.status, 201);
      betaId = ((await c.json()) as { id: string }).id;

      // Save & load UI state
      const uiSave = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}/ui-state`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({ activeSessionId: "s_123", viewerTabs: ["README.md"] }),
      });
      assert.equal(uiSave.status, 200);
      const uiGet = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}/ui-state`, { headers: hdr });
      assert.equal(((await uiGet.json()) as { activeSessionId: string }).activeSessionId, "s_123");

      // Move root folder -> rootStatus becomes "missing", nothing crashes
      fs.renameSync(wsFolder, wsMoved);
      const missRes = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}`, { headers: hdr });
      assert.equal(((await missRes.json()) as { rootStatus: string }).rootStatus, "missing");

      // Relocate restores "ok"
      const relocRes = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}/relocate`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({ rootPath: wsMoved }),
      });
      assert.equal(relocRes.status, 200);
      assert.equal(((await relocRes.json()) as { rootStatus: string }).rootStatus, "ok");

      // Delete over HTTP bearer -> 403 trusted_channel_required
      const httpDel = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}/delete`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({ confirmName: "Beta" }),
      });
      assert.equal(httpDel.status, 403);

      // Corrupt workspaces.json -> restart -> recovers from workspaces.json.bak
      daemon.proc.kill();
      await new Promise((r) => setTimeout(r, 300));
      fs.writeFileSync(path.join(dataDir, "workspaces.json"), "{CORRUPT_TRUNCATED", "utf-8");

      daemon = await startDaemon(dataDir);
      hdr = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };
      const recovered = await fetch(`${daemon.baseUrl}/v1/workspaces/${betaId}`, { headers: hdr });
      assert.equal(recovered.status, 200);
      assert.equal(((await recovered.json()) as { name: string }).name, "Beta");

      // Delete via trusted channel with wrong name -> 400
      const wrongDel = await sendPipe(daemon.pipeName, "POST", `/v1/workspaces/${betaId}/delete`, { confirmName: "Wrong" });
      assert.equal(wrongDel.status, 400);

      // Delete via trusted channel with exact name -> 200, Sanctum dir deleted, user folder untouched!
      const okDel = await sendPipe(daemon.pipeName, "POST", `/v1/workspaces/${betaId}/delete`, { confirmName: "Beta" });
      assert.equal(okDel.status, 200);
      assert.equal(fs.existsSync(path.join(dataDir, "workspaces", betaId)), false);
      assert.equal(fs.readFileSync(path.join(wsMoved, "keep.txt"), "utf-8"), "user data");
    } finally {
      try { daemon.proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  test("Reversible migration creates Default (from tool_workspace.txt) or Scratch (chat-only) and rolls back cleanly", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a1-mig-"));
    const dataDir = path.join(tmpBase, "appdata");
    const legacyRoot = path.join(tmpBase, "my_legacy_repo");
    fs.mkdirSync(path.join(dataDir, "sessions"), { recursive: true });
    fs.mkdirSync(legacyRoot, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "tool_workspace.txt"), legacyRoot, "utf-8");
    fs.writeFileSync(path.join(dataDir, "sessions", "s_legacy.jsonl"), '{"v":1,"seq":1,"type":"session_created"}\n', "utf-8");
    fs.writeFileSync(path.join(dataDir, "memory.json"), JSON.stringify({ enabled: true, facts: [{ id: "m1", content: "remember me" }] }), "utf-8");

    // Forward migration
    const daemon = await startDaemon(dataDir);
    try {
      const res = await fetch(`${daemon.baseUrl}/v1/workspaces`, {
        headers: { Authorization: `Bearer ${daemon.token}` },
      });
      const list = await res.json() as { workspaces: Array<{ id: string; name: string; rootPath: string }> };
      assert.equal(list.workspaces.length, 1);
      assert.equal(list.workspaces[0].name, "Default");
      assert.equal(list.workspaces[0].rootPath.toLowerCase(), legacyRoot.toLowerCase());

      // Legacy session & memory migrated into workspace dir + backup exists
      const wsDir = path.join(dataDir, "workspaces", list.workspaces[0].id);
      assert.ok(fs.existsSync(path.join(wsDir, "sessions", "s_legacy.jsonl")));
      assert.ok(fs.existsSync(path.join(wsDir, "memory.json")));
      assert.ok(fs.existsSync(path.join(dataDir, "migration_state.json")));
    } finally {
      try { daemon.proc.kill(); } catch {}
    }

    await new Promise((r) => setTimeout(r, 300));

    // Rollback migration
    const rbOut = execFileSync(HOST_EXE, ["--rollback-workspace-migration", "--data-dir", dataDir], { encoding: "utf-8" });
    const rb = JSON.parse(rbOut.trim()) as { ok: boolean };
    assert.equal(rb.ok, true);
    assert.equal(fs.existsSync(path.join(dataDir, "workspaces.json")), false);
    assert.equal(fs.existsSync(path.join(dataDir, "workspaces")), false);
    assert.ok(fs.existsSync(path.join(dataDir, "sessions", "s_legacy.jsonl")));
    assert.equal(fs.readFileSync(path.join(dataDir, "tool_workspace.txt"), "utf-8"), legacyRoot);

    // Chat-only Scratch migration when no tool_workspace.txt exists
    const scratchDataDir = path.join(tmpBase, "scratch_appdata");
    const scratchDaemon = await startDaemon(scratchDataDir);
    try {
      const res = await fetch(`${scratchDaemon.baseUrl}/v1/workspaces`, {
        headers: { Authorization: `Bearer ${scratchDaemon.token}` },
      });
      const list = await res.json() as { workspaces: Array<{ name: string; rootPath: string | null; rootStatus: string }> };
      assert.equal(list.workspaces.length, 1);
      assert.equal(list.workspaces[0].name, "Scratch");
      assert.equal(list.workspaces[0].rootPath, null);
      assert.equal(list.workspaces[0].rootStatus, "chat_only");
    } finally {
      try { scratchDaemon.proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
