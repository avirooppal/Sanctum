import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string, mockScript?: string, extraEnv: Record<string, string> = {}): Promise<{
  proc: ChildProcess;
  baseUrl: string;
  token: string;
  pipeName: string;
  coldStartMs: number;
}> {
  fs.mkdirSync(dataDir, { recursive: true });
  const args = ["--harness", "--data-dir", dataDir, "--provider", "mock"];
  if (mockScript) args.push("--mock-script", mockScript);
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...extraEnv } });
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error(`Timeout: ${stderr}`)); }, 12000);
    proc.stdout!.on("data", (d: Buffer) => {
      buf += d.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        const coldStartMs = Math.round(performance.now() - t0);
        const info = JSON.parse(buf.slice(0, nl).trim());
        resolve({ proc, baseUrl: `http://127.0.0.1:${info.httpPort}`, token: info.token, pipeName: info.pipeName, coldStartMs });
      }
    });
    proc.stderr!.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exit ${code}: ${stderr}`)); });
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
        const p = JSON.parse(buf.slice(0, nl));
        resolve({ status: p.status, body: p.body });
      }
    });
    c.on("error", reject);
  });
}

describe("Phase 6.2 & 6.5: End-to-end host workflow, crash recovery & measured performance budgets", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p6-e2e-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("full E2E journey (chat, approval, rewind, plan, scheduler, Offline, A2UI rich + fallback, crash recovery, erase-all) & perf budgets", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, "app.txt"), "original\n", "utf-8");

    const scriptPath = path.join(tmpRoot, "e2e-script.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Editing app.txt and rendering A2UI"],
            toolCalls: [
              { id: "tc_e", name: "create_file", arguments: { path: "app.txt", content: "modified\n" } },
              {
                id: "tc_ui_ok",
                name: "render_ui",
                arguments: { surfaceId: "s_ok", summaryText: "Status table.", components: [{ id: "t1", type: "Table", props: { columns: ["K", "V"], rows: [["Mode", "Offline"]] } }] },
              },
              {
                id: "tc_ui_bad",
                name: "render_ui",
                arguments: { surfaceId: "s_bad", components: [{ id: "x1", type: "ApprovalCard", props: {} }] },
              },
            ],
          },
          { contentDeltas: ["E2E turn complete."] },
        ],
      }),
      "utf-8"
    );

    const d1 = await startDaemon(dataDir, scriptPath, { SANCTUM_OFFLINE_MODE: "1" });
    procs.push(d1.proc);
    const headers = { Authorization: `Bearer ${d1.token}`, "Content-Type": "application/json" };

    // Measure session create latency
    const tSess0 = performance.now();
    const sess = await (
      await fetch(`${d1.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "E2E Journey", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock" }),
      })
    ).json();
    const sessionCreateMs = Math.round(performance.now() - tSess0);

    // 1. Shadow-git checkpoint before turn
    const cp = await (
      await fetch(`${d1.baseUrl}/v1/sessions/${sess.sessionId}/checkpoints`, {
        method: "POST",
        headers,
        body: JSON.stringify({ label: "pre-e2e" }),
      })
    ).json();
    assert.ok(cp.shadowCommit);

    // 2. Run turn, approve create_file, verify A2UI valid + fallback
    await fetch(`${d1.baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Run E2E", idempotencyKey: "e2e-1" }),
    });
    let approved = false;
    let events: any[] = [];
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${d1.baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      const pending = cur.events.find((e: any) => e.type === "approval_requested");
      if (pending && !approved) {
        await fetch(`${d1.baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ approved: true, callId: pending.payload.callId, argsSha256: pending.payload.argsSha256 }),
        });
        approved = true;
      }
      if (cur.events.some((e: any) => e.type === "run_finished")) {
        events = cur.events;
        break;
      }
    }
    assert.equal(fs.readFileSync(path.join(wsDir, "app.txt"), "utf-8").trim(), "modified");
    assert.ok(events.some((e) => e.type === "a2ui_surface" && e.payload.surfaceId === "s_ok" && e.payload.valid === true));
    assert.ok(events.some((e) => e.type === "a2ui_surface" && e.payload.surfaceId === "s_bad" && e.payload.fallbackToText === true));

    // 3. Rewind restores app.txt
    await fetch(`${d1.baseUrl}/v1/sessions/${sess.sessionId}/rewind`, {
      method: "POST",
      headers,
      body: JSON.stringify({ checkpointId: cp.checkpointId }),
    });
    assert.equal(fs.readFileSync(path.join(wsDir, "app.txt"), "utf-8").trim(), "original");

    // 4. Plan save + Scheduler job
    const planRes = await fetch(`${d1.baseUrl}/v1/sessions/${sess.sessionId}/plan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "# Plan\n- [x] Verified\n" }),
    });
    assert.equal(planRes.status, 200);

    const job = await sendPipe(d1.pipeName, "POST", "/v1/schedules", {
      name: "E2E Job",
      prompt: "Check",
      workspace: wsDir,
      model: "mock",
      intervalSeconds: 3600,
    });
    assert.equal(job.status, 201);

    // 5. Offline mode zero-egress check
    const ledger = await (await fetch(`${d1.baseUrl}/v1/network/ledger`, { headers })).json();
    assert.equal(ledger.offlineMode, true);
    assert.deepEqual(ledger.entries, []);

    // 6. Crash recovery: kill daemon abruptly, restart on same dataDir, verify session recovers intact
    d1.proc.kill();
    await new Promise((r) => setTimeout(r, 300));
    const tRec0 = performance.now();
    const d2 = await startDaemon(dataDir, scriptPath, { SANCTUM_OFFLINE_MODE: "1" });
    const crashRecoveryMs = Math.round(performance.now() - tRec0);
    procs.push(d2.proc);

    const h2 = { Authorization: `Bearer ${d2.token}`, "Content-Type": "application/json" };
    const recovered = await (await fetch(`${d2.baseUrl}/v1/sessions/${sess.sessionId}`, { headers: h2 })).json();
    assert.ok(recovered.events.length >= events.length, "Session log must recover cleanly after abrupt kill");

    // 7. Erase all data
    const erased = await sendPipe(d2.pipeName, "POST", "/v1/erase-all", {});
    assert.equal(erased.status, 200);
    assert.equal(erased.body.erased, true);

    console.error(
      JSON.stringify({
        perfBudgets: {
          coldStartMs: d1.coldStartMs,
          sessionCreateMs,
          crashRecoveryMs,
        },
      })
    );
    assert.ok(d1.coldStartMs < 5000, `Cold start budget exceeded: ${d1.coldStartMs}ms`);
    assert.ok(sessionCreateMs < 1000, `Session create budget exceeded: ${sessionCreateMs}ms`);
  });
});
