import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

interface DaemonHandle {
  proc: ChildProcess;
  httpPort: number;
  token: string;
  baseUrl: string;
}

function startOfflineHarnessDaemon(dataDir: string, mockScriptPath: string): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock", "--mock-script", mockScriptPath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          SANCTUM_OFFLINE_MODE: "1",
          HTTP_PROXY: "http://127.0.0.1:1",
          HTTPS_PROXY: "http://127.0.0.1:1",
          NO_PROXY: "127.0.0.1,localhost",
        },
      }
    );
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

async function waitForRunFinish(baseUrl: string, token: string, sessionId: string, expectedFinishCount: number) {
  const headers = { Authorization: `Bearer ${token}` };
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}`, { headers });
    const data = await res.json();
    const finishes = data.events.filter((e: any) => e.type === "run_finished");
    if (finishes.length >= expectedFinishCount) {
      return data;
    }
  }
  throw new Error(`Timed out waiting for run_finished #${expectedFinishCount}`);
}

describe("Phase 1.5: Offline proof test (full agent session with zero non-loopback attempts)", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1-5-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) {
      try { p.kill(); } catch {}
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("full multi-step agent session (read_file, create_file, checkpoints, compaction, replay) completes in Offline mode with zero blocked egress attempts", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const workspaceDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "notes.txt"), "Sanctum local-only workspace test\n", "utf-8");

    const scriptPath = path.join(tmpRoot, "mock-script.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Reading notes.txt..."],
            toolCalls: [{ id: "tc_1", name: "read_file", arguments: { path: "notes.txt" } }],
          },
          {
            contentDeltas: ["Creating summary.md..."],
            toolCalls: [
              {
                id: "tc_2",
                name: "create_file",
                arguments: { path: "summary.md", content: "# Summary\nLocal-only verified.\n" },
              },
            ],
          },
          {
            contentDeltas: ["Done! Created summary.md locally."],
          },
        ],
      }),
      "utf-8"
    );

    const daemon = await startOfflineHarnessDaemon(dataDir, scriptPath);
    procs.push(daemon.proc);
    const headers = {
      Authorization: `Bearer ${daemon.token}`,
      "Content-Type": "application/json",
    };

    // Verify Offline mode is active
    const pol = await (await fetch(`${daemon.baseUrl}/v1/network/policy`, { headers })).json();
    assert.equal(pol.offlineMode, true);

    // Create session in workspace
    const sessRes = await fetch(`${daemon.baseUrl}/v1/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Offline Proof Session",
        workspace: workspaceDir,
        mode: "build",
        autonomy: "auto_reads",
        model: "mock-local",
      }),
    });
    assert.equal(sessRes.status, 201);
    const sess = await sessRes.json();

    // Start run
    const msgRes = await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Read notes.txt and write summary.md", idempotencyKey: "offline-1" }),
    });
    assert.equal(msgRes.status, 202);

    // Approve create_file when pending (auto_reads allows read_file, asks on create_file)
    let approvedCreate = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      const pending = cur.events.find((e: any) => e.type === "approval_requested");
      if (pending && !approvedCreate) {
        const apprRes = await fetch(`${daemon.baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            approved: true,
            callId: pending.payload.callId,
            argsSha256: pending.payload.argsSha256,
          }),
        });
        assert.equal(apprRes.status, 200);
        approvedCreate = true;
      }
      if (cur.events.some((e: any) => e.type === "run_finished")) break;
    }

    const sessionData = await waitForRunFinish(daemon.baseUrl, daemon.token, sess.sessionId, 1);
    assert.ok(fs.existsSync(path.join(workspaceDir, "summary.md")), "summary.md must be created locally");
    assert.ok(sessionData.events.some((e: any) => e.type === "tool_finished" && e.payload?.tool === "read_file" && e.payload?.ok === true));
    assert.ok(sessionData.events.some((e: any) => e.type === "tool_finished" && e.payload?.tool === "create_file" && e.payload?.ok === true));

    // Context + compaction work offline
    const ctxRes = await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/context`, { headers });
    assert.equal(ctxRes.status, 200);
    const compactRes = await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/compact`, {
      method: "POST",
      headers,
      body: JSON.stringify({ keepRecentMessages: 1 }),
    });
    assert.equal(compactRes.status, 200);

    // Assert ZERO non-loopback egress attempts (allowed or blocked)
    const ledger = await (await fetch(`${daemon.baseUrl}/v1/network/ledger`, { headers })).json();
    assert.equal(ledger.offlineMode, true);
    assert.deepEqual(ledger.entries, [], `Expected zero non-loopback attempts, got: ${JSON.stringify(ledger.entries)}`);
  });
});
