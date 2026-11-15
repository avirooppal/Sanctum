import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";

const ROOT = process.cwd();
const HOST_EXE = path.resolve("deploy/installer/build_payload/Sanctum-Desktop.exe");

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function startHeadlessHost(seedTokens: string[] = []): Promise<{
  proc: ChildProcess;
  port: number;
  baseUrl: string;
  token: string;
  dataDir: string;
  workspaceDir: string;
  stop: () => Promise<void>;
}> {
  const port = await getFreePort();
  const token = "test-token-" + Math.random().toString(36).slice(2, 12);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-phase3-test-"));
  const workspaceDir = path.join(dataDir, "workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });

  const args = ["--headless", "--port", String(port), "--data-dir", dataDir, "--auth-token", token];
  for (const st of seedTokens) {
    args.push("--seed-approval-token", st);
  }

  const proc = spawn(HOST_EXE, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Sanctum-Desktop.exe exited early with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const stop = async () => {
    try {
      proc.kill();
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  };

  return { proc, port, baseUrl, token, dataDir, workspaceDir, stop };
}

test("PHASE3-01: C# Host /api/fs/export-zip packages deliverables, saves to workspace, and blocks traversal/out-of-scope paths", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost();
  t.after(() => host.stop());

  const headers = {
    "X-Sanctum-Auth": host.token,
    "Content-Type": "application/json",
  };
  fs.mkdirSync(path.join(host.workspaceDir, "reports"), { recursive: true });
  fs.writeFileSync(path.join(host.workspaceDir, "PLAN.md"), "# Plan\n1. Build viewer\n2. Verify security\n", "utf-8");
  fs.writeFileSync(path.join(host.workspaceDir, "reports", "summary.json"), JSON.stringify({ passed: true }), "utf-8");

  await t.test("1. POST /api/fs/export-zip creates valid ZIP archive (PK header) and saves to workspace", async () => {
    const res = await fetch(`${host.baseUrl}/api/fs/export-zip`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        paths: ["PLAN.md", "reports/summary.json"],
        archiveName: "session-deliverables.zip",
        saveToWorkspace: true,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.fileCount, 2);
    assert.equal(data.savedPath, "session-deliverables.zip");
    assert.ok(data.sizeBytes > 50);
    assert.ok(typeof data.zipBase64 === "string" && data.zipBase64.length > 20);

    const zipBuf = Buffer.from(data.zipBase64, "base64");
    // Verify PK\x03\x04 ZIP magic bytes
    assert.equal(zipBuf[0], 0x50);
    assert.equal(zipBuf[1], 0x4b);
    assert.equal(zipBuf[2], 0x03);
    assert.equal(zipBuf[3], 0x04);
    assert.ok(fs.existsSync(path.join(host.workspaceDir, "session-deliverables.zip")));
  });

  await t.test("2. POST /api/fs/export-zip rejects path traversal and out-of-scope files with 403", async () => {
    for (const badPath of ["..\\threads.json", "C:\\Windows\\System32\\drivers\\etc\\hosts"]) {
      const res = await fetch(`${host.baseUrl}/api/fs/export-zip`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          paths: [badPath],
          archiveName: "bad.zip",
        }),
      });
      assert.equal(res.status, 403, `Expected 403 for ${badPath}, got ${res.status}`);
    }
  });
});

test("PHASE3-02: C# Host /api/ide/detect, /api/ide/open, /api/updates/check, and /api/audio/models", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost(["tok-ide-1", "tok-ide-2"]);
  t.after(() => host.stop());

  const headers = {
    "X-Sanctum-Auth": host.token,
    "Content-Type": "application/json",
  };

  await t.test("1. GET /api/ide/detect returns detected IDEs and POST /api/ide/open enforces approval & allowlist", async () => {
    const detRes = await fetch(`${host.baseUrl}/api/ide/detect`, { headers });
    assert.equal(detRes.status, 200);
    const det = await detRes.json();
    assert.ok(Array.isArray(det.ides));

    // Without approval token -> 403
    const noAuth = await fetch(`${host.baseUrl}/api/ide/open`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ideId: "code", file: "PLAN.md", line: 2 }),
    });
    assert.equal(noAuth.status, 403);

    // Unknown IDE id with approval token -> 404 (never executes arbitrary binaries)
    const unknownIde = await fetch(`${host.baseUrl}/api/ide/open`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "tok-ide-1" },
      body: JSON.stringify({ ideId: "powershell.exe", file: "PLAN.md" }),
    });
    assert.equal(unknownIde.status, 404);
  });

  await t.test("2. GET /api/updates/check is manual-only and detects newer signed releases", async () => {
    const upToDateRes = await fetch(`${host.baseUrl}/api/updates/check`, { headers });
    assert.equal(upToDateRes.status, 200);
    const upToDate = await upToDateRes.json();
    assert.equal(upToDate.currentVersion, "1.0.0");
    assert.equal(upToDate.updateAvailable, false);
    assert.equal(upToDate.signed, true);

    const newerRes = await fetch(`${host.baseUrl}/api/updates/check`, {
      headers: { ...headers, "X-Sanctum-Test-Latest-Version": "1.1.0" },
    });
    assert.equal(newerRes.status, 200);
    const newer = await newerRes.json();
    assert.equal(newer.updateAvailable, true);
    assert.equal(newer.latestVersion, "1.1.0");
    assert.equal(newer.signed, true);
  });

  await t.test("3. GET/POST /api/audio/models ships both Qwen3-ASR-0.6B and Nemotron 3.5 Transcribe in C# host", async () => {
    const getRes = await fetch(`${host.baseUrl}/api/audio/models`, { headers });
    assert.equal(getRes.status, 200);
    const data = await getRes.json();
    assert.ok(Array.isArray(data.models));
    assert.equal(data.models.length, 2);
    assert.ok(data.models.some((m: any) => m.id === "qwen3-asr-0.6b"));
    assert.ok(data.models.some((m: any) => m.id === "nemotron-3.5-transcribe"));

    const selectRes = await fetch(`${host.baseUrl}/api/audio/models`, {
      method: "POST",
      headers,
      body: JSON.stringify({ modelId: "nemotron-3.5-transcribe" }),
    });
    assert.equal(selectRes.status, 200);
    const selData = await selectRes.json();
    assert.equal(selData.activeModelId, "nemotron-3.5-transcribe");
  });
});

test("PHASE3-03: Supporting Workspace UX Components & CAPABILITIES.md Verification", () => {
  const wsTools = fs.readFileSync(path.join(ROOT, "src", "components", "chat", "WorkspaceTools.tsx"), "utf-8");
  assert.match(wsTools, /Local Models \(Ollama \/ GGUF\)/, "Must group Local vs Cloud models");
  assert.match(wsTools, /thinkingEffort/, "Must include Effort/Thinking level picker");
  assert.match(wsTools, /agentExecutionMode/, "Must include Fast vs Plan toggle");
  assert.match(wsTools, /Approve & Execute/, "Must include Plan approval banner");

  const headerActions = fs.readFileSync(
    path.join(ROOT, "src", "components", "viewer", "WorkspaceHeaderActions.tsx"),
    "utf-8"
  );
  assert.match(headerActions, /Open IDE/, "Must render Open IDE button");
  assert.match(headerActions, /Export as ZIP/, "Must render Deliverables Export as ZIP button");
  assert.match(headerActions, /Quick open file in workspace \(Ctrl\+P\)/, "Must support Ctrl+P quick open");
  assert.match(headerActions, /sanctum:focus-file-tree/, "Must support Ctrl+Shift+E focus file tree");

  const capsDoc = fs.readFileSync(path.join(ROOT, "CAPABILITIES.md"), "utf-8");
  assert.match(capsDoc, /Phase 1 — File\/Artifact Viewer Panel/);
  assert.match(capsDoc, /Phase 2 — Browser Agent \(`browser-use` Optional Pack\)/);
  assert.match(capsDoc, /Phase 3 — Supporting Workspace UX & Local STT Models/);
});
