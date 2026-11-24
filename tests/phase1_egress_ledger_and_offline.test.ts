import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

interface DaemonHandle {
  proc: ChildProcess;
  httpPort: number;
  pipeName: string;
  token: string;
  baseUrl: string;
}

function startHarnessDaemon(dataDir: string): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, "--provider", "mock"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`Daemon startup timeout. stderr=${stderr}`));
    }, 10000);
    proc.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        const info = JSON.parse(buf.slice(0, nl).trim());
        resolve({
          proc,
          httpPort: info.httpPort,
          pipeName: info.pipeName,
          token: info.token,
          baseUrl: `http://127.0.0.1:${info.httpPort}`,
        });
      }
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Daemon exited early (${code}). stderr=${stderr}`));
    });
  });
}

function sendPipeCommand(pipeName: string, method: string, reqPath: string, body: Record<string, any> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const client = net.connect(`\\\\.\\pipe\\${pipeName}`, () => {
      client.write(JSON.stringify({ method, path: reqPath, body }) + "\n");
    });
    let buf = "";
    client.on("data", (chunk) => {
      buf += chunk.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        client.end();
        const parsed = JSON.parse(buf.slice(0, nl));
        resolve({ status: parsed.status, body: parsed.body });
      }
    });
    client.on("error", reject);
  });
}

describe("Phase 1.4: Egress ledger API, export, and global Offline mode", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1-4-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) {
      try { p.kill(); } catch {}
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("Offline mode switch enforces trusted-channel gate on disable, persists policy, and ledger redacts/exports cleanly", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const daemon = await startHarnessDaemon(dataDir);
    procs.push(daemon.proc);
    const headers = {
      Authorization: `Bearer ${daemon.token}`,
      "Content-Type": "application/json",
    };

    // 1. Read initial policy
    const polRes = await fetch(`${daemon.baseUrl}/v1/network/policy`, { headers });
    assert.equal(polRes.status, 200);
    const pol = await polRes.json();
    assert.equal(pol.offlineMode, false);
    assert.equal(pol.allowBrowserAgent, false);
    assert.equal(pol.allowWebFetch, false);

    // 2. Enabling Offline mode succeeds immediately over HTTP bearer (fail-closed)
    const onRes = await fetch(`${daemon.baseUrl}/v1/network/offline`, {
      method: "POST",
      headers,
      body: JSON.stringify({ offline: true }),
    });
    assert.equal(onRes.status, 200);
    assert.equal((await onRes.json()).offlineMode, true);

    // 3. Disabling Offline mode over HTTP bearer is denied (403 trusted_channel_required)
    const offDenied = await fetch(`${daemon.baseUrl}/v1/network/offline`, {
      method: "POST",
      headers,
      body: JSON.stringify({ offline: false }),
    });
    assert.equal(offDenied.status, 403);
    assert.equal((await offDenied.json()).code, "trusted_channel_required");

    // 4. Enabling a network feature over HTTP bearer is also denied (403)
    const featDenied = await fetch(`${daemon.baseUrl}/v1/network/features`, {
      method: "POST",
      headers,
      body: JSON.stringify({ feature: "browser_agent", enabled: true }),
    });
    assert.equal(featDenied.status, 403);

    // 5. While Offline mode is ON, non-loopback request is blocked & recorded in ledger with query redacted
    const evalBlocked = spawnSync(
      HOST_EXE,
      ["--eval-egress", "https://huggingface.co/api/models/qwen?access_token=topsecret999", "ModelDownload", "--data-dir", dataDir],
      { encoding: "utf-8", timeout: 8000 }
    );
    assert.notEqual(evalBlocked.status, 0);

    // 6. Disabling Offline mode via trusted Named Pipe succeeds
    const offPipe = await sendPipeCommand(daemon.pipeName, "POST", "/v1/network/offline", { offline: false });
    assert.equal(offPipe.status, 200);
    assert.equal(offPipe.body.offlineMode, false);

    // 7. Read ledger and export JSONL
    const ledgerRes = await fetch(`${daemon.baseUrl}/v1/network/ledger`, { headers });
    assert.equal(ledgerRes.status, 200);
    const ledger = await ledgerRes.json();
    assert.ok(Array.isArray(ledger.entries) && ledger.entries.length >= 1);
    const entry = ledger.entries.find((e: any) => e.host === "huggingface.co" && e.status === "blocked");
    assert.ok(entry, "blocked Hugging Face request must appear in ledger");
    assert.equal(entry.url.includes("topsecret999"), false, "query token must be redacted in ledger");

    const exportRes = await fetch(`${daemon.baseUrl}/v1/network/ledger/export`, { headers });
    assert.equal(exportRes.status, 200);
    const exp = await exportRes.json();
    assert.equal(exp.format, "jsonl");
    assert.ok(exp.content.includes("huggingface.co"));
    assert.equal(exp.content.includes("topsecret999"), false);
  });
});
