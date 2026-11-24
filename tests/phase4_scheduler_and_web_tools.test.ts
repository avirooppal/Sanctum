import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

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

describe("Phase 4.5-4.7: Scheduler expiry/reports & isolated opt-in web_fetch/web_search", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p4-567-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("expired scheduled job fails closed, active job writes report artifact, and web_fetch is blocked by default", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(wsDir, { recursive: true });

    const scriptPath = path.join(tmpRoot, "mock-web.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Trying web_fetch"],
            toolCalls: [{ id: "tc_wf", name: "web_fetch", arguments: { url: "https://example.com/" } }],
          },
          { contentDeltas: ["Handled blocked web_fetch"] },
        ],
      }),
      "utf-8"
    );

    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock", "--mock-script", scriptPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
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

    // 1. Expired scheduled job fails closed with 410 job_expired
    const expiredJob = await sendPipe(info.pipeName, "POST", "/v1/schedules", {
      name: "Expired Job",
      prompt: "Say hi",
      workspace: wsDir,
      model: "mock",
      intervalSeconds: 3600,
      expiresAt: "2020-01-01T00:00:00Z",
    });
    assert.equal(expiredJob.status, 201);
    const trigExp = await fetch(`${baseUrl}/v1/schedules/${expiredJob.body.id}/run`, { method: "POST", headers, body: "{}" });
    assert.equal(trigExp.status, 410);
    assert.equal((await trigExp.json()).code, "job_expired");

    // 2. Active scheduled job writes report artifact
    const activeJob = await sendPipe(info.pipeName, "POST", "/v1/schedules", {
      name: "Active Job",
      prompt: "Check status",
      workspace: wsDir,
      model: "mock",
      intervalSeconds: 3600,
      expiresAt: "2099-01-01T00:00:00Z",
    });
    assert.equal(activeJob.status, 201);
    const trigOk = await fetch(`${baseUrl}/v1/schedules/${activeJob.body.id}/run`, { method: "POST", headers, body: "{}" });
    assert.equal(trigOk.status, 202);
    const trigBody = await trigOk.json();
    assert.ok(trigBody.reportPath && fs.existsSync(trigBody.reportPath), "Scheduled run must produce report artifact");

    // 3. web_fetch is blocked by default when approved (EgressHttpFactory blocks disabled WebFetch & logs to ledger)
    const sess = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Web Fetch Test", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock" }),
      })
    ).json();
    await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Fetch example.com", idempotencyKey: "wf-1" }),
    });
    let approved = false;
    let wfOk: boolean | null = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      const pending = cur.events.find((e: any) => e.type === "approval_requested");
      if (pending && !approved) {
        await fetch(`${baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ approved: true, callId: pending.payload.callId, argsSha256: pending.payload.argsSha256 }),
        });
        approved = true;
      }
      const fin = cur.events.find((e: any) => e.type === "tool_finished" && e.payload?.tool === "web_fetch");
      if (fin) {
        wfOk = fin.payload.ok;
        break;
      }
    }
    assert.equal(wfOk, false, "web_fetch must fail closed by default when WebFetch feature is disabled");

    const ledger = await (await fetch(`${baseUrl}/v1/network/ledger`, { headers })).json();
    assert.ok(ledger.entries.some((e: any) => e.host === "example.com" && e.status === "blocked"), "Blocked web_fetch must appear in egress ledger");
  });
});
