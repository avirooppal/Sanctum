import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

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

async function startHeadlessHost(extraArgs: string[] = []): Promise<{
  proc: ChildProcess;
  baseUrl: string;
  token: string;
  dataDir: string;
  stop: () => Promise<void>;
}> {
  const port = await getFreePort();
  const token = "test-token-" + Math.random().toString(36).slice(2, 12);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-host-test-"));

  const proc = spawn(
    HOST_EXE,
    ["--headless", "--port", String(port), "--data-dir", dataDir, "--auth-token", token, ...extraArgs],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );

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

  return { proc, baseUrl, token, dataDir, stop };
}

test("SEC-01: C# HandleTerminal enforces command rules, cwd ToolPath, and single-use approval tokens", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const seedToken = "appr-seed-" + Math.random().toString(36).slice(2);
  const host = await startHeadlessHost(["--seed-approval-token", seedToken]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  await t.test("1. Hard-denied command (format C:) is rejected even with approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "format C:" }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /blocked|denied|policy/i);
  });

  await t.test("2. Out-of-scope cwd (C:\\Windows\\System32) is rejected", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "echo ok", cwd: "C:\\Windows\\System32" }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("3. Non-allowlisted ask command (node -e ...) is rejected without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "run_command", command: "node -e \"console.log(123)\"" }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /approval/i);
  });

  await t.test("4. Non-allowlisted start_background is rejected without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "start_background", command: "node -e \"console.log(123)\"" }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("5. Allowlisted read-only command (echo) executes without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "run_command", command: "echo sec01_ok" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.stdout, /sec01_ok/);
  });

  await t.test("6. Single-use approval token allows one ask command and fails on replay", async () => {
    const res1 = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "Write-Output 'sec01_approved_once'" }),
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.match(data1.stdout, /sec01_approved_once/);

    const res2 = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "Write-Output 'replay'" }),
    });
    assert.equal(res2.status, 403);
  });
});
