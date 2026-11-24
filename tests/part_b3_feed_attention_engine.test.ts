import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
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
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error(`Timeout: ${stderr}`)); }, 10000);
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
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exited (${code}): ${stderr}`)); });
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
      if (nl >= 0) { c.end(); resolve(JSON.parse(buf.slice(0, nl))); }
    });
    c.on("error", reject);
  });
}

describe("Part B3: Host-side Feed Attention & Pause Engine, multi-workspace queue, rate limits & wellbeing", () => {
  test("State machine, <150ms pause transition, multi-workspace queue, rate limiting, approvals-only mode, audit log & wellbeing", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-b3-attn-"));
    const dataDir = path.join(tmpBase, "appdata");
    const rootA = path.join(tmpBase, "ws_a");
    const rootB = path.join(tmpBase, "ws_b");
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });

    const { proc, baseUrl, token, pipeName } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      // 1. Starts in Off state
      const s0 = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(s0.state, "Off");
      assert.equal(s0.wellbeing.showTimer, false);
      assert.equal(s0.wellbeing.dailyCapMinutes, 0);

      // Enable Feed Pane via trusted pipe -> becomes Active
      const en = await sendPipe(pipeName, "POST", "/v1/feed/enable", { consentAccepted: true });
      assert.equal(en.status, 200);
      const s1 = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(s1.state, "Active");

      // Create two workspaces + sessions
      const wsA = (await (await fetch(`${baseUrl}/v1/workspaces`, { method: "POST", headers: hdr, body: JSON.stringify({ name: "Alpha", rootPath: rootA }) })).json()) as { id: string };
      const wsB = (await (await fetch(`${baseUrl}/v1/workspaces`, { method: "POST", headers: hdr, body: JSON.stringify({ name: "Beta", rootPath: rootB }) })).json()) as { id: string };
      const sessB = (await (await fetch(`${baseUrl}/v1/sessions`, { method: "POST", headers: hdr, body: JSON.stringify({ title: "B", workspaceId: wsB.id, model: "mock" }) })).json()) as { sessionId: string };

      // 2. Measure pause latency (< 150ms) when user_input_requested fires from Workspace B
      const t0 = performance.now();
      const uin = await fetch(`${baseUrl}/v1/sessions/${sessB.sessionId}/user-input-requested`, {
        method: "POST", headers: hdr, body: JSON.stringify({ prompt: "Choose deployment target" }),
      });
      assert.equal(uin.status, 200);
      const uinData = (await uin.json()) as { requestId: string };
      const sPaused = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      const pauseLatencyMs = Math.round((performance.now() - t0) * 100) / 100;
      console.log(JSON.stringify({ feedPauseLatencyMs: pauseLatencyMs }));
      assert.equal(sPaused.state, "PausedAttention");
      assert.ok(pauseLatencyMs < 150, `Pause transition took ${pauseLatencyMs}ms (expected < 150ms)`);
      assert.equal(sPaused.reasons.length, 1);
      assert.equal(sPaused.reasons[0].workspaceName, "Beta");

      // 3. Multi-workspace queue: enqueue a second attention item from Workspace A
      await fetch(`${baseUrl}/v1/feed/attention/trigger`, {
        method: "POST", headers: hdr,
        body: JSON.stringify({ id: "appr_wsA", trigger: "approval_requested", workspaceId: wsA.id, workspaceName: "Alpha", summary: "Approve edit in Alpha" }),
      });
      const sQ2 = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sQ2.reasons.length, 2);

      // Clearing only Alpha keeps pane PausedAttention because Beta is still pending
      await fetch(`${baseUrl}/v1/feed/attention/clear`, {
        method: "POST", headers: hdr, body: JSON.stringify({ id: "appr_wsA" }),
      });
      const sQ1 = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sQ1.state, "PausedAttention");
      assert.equal(sQ1.reasons.length, 1);

      // Clearing Beta empties queue -> auto-resumes to Active
      await fetch(`${baseUrl}/v1/feed/attention/clear`, {
        method: "POST", headers: hdr, body: JSON.stringify({ id: uinData.requestId }),
      });
      const sResumed = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sResumed.state, "Active");

      // 4. Rate limiting: fire 6 rapid non-approval triggers (limit = 4/min) -> coalesces excess into 1
      for (let i = 0; i < 6; i++) {
        await fetch(`${baseUrl}/v1/feed/attention/trigger`, {
          method: "POST", headers: hdr,
          body: JSON.stringify({ id: `spam_${i}`, trigger: "present_file", summary: `File ${i}` }),
        });
      }
      const sSpam = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.ok(sSpam.coalescedCount >= 2, `Expected coalescing after 4/min cap, got coalescedCount=${sSpam.coalescedCount}`);
      await fetch(`${baseUrl}/v1/feed/attention/resume`, { method: "POST", headers: hdr });

      // 5. Approvals-only mode ignores plan_ready / present_file
      await fetch(`${baseUrl}/v1/feed/attention/settings`, {
        method: "POST", headers: hdr, body: JSON.stringify({ approvalsOnlyMode: true }),
      });
      await fetch(`${baseUrl}/v1/feed/attention/trigger`, {
        method: "POST", headers: hdr, body: JSON.stringify({ id: "ignored_plan", trigger: "plan_ready", summary: "Plan" }),
      });
      const sApprOnly = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sApprOnly.state, "Active");

      // 6. Window minimize/tray suspend -> Suspended; unsuspend -> Active
      await fetch(`${baseUrl}/v1/feed/attention/suspend`, {
        method: "POST", headers: hdr, body: JSON.stringify({ suspended: true, reason: "minimized" }),
      });
      const sSusp = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sSusp.state, "Suspended");
      await fetch(`${baseUrl}/v1/feed/attention/suspend`, {
        method: "POST", headers: hdr, body: JSON.stringify({ suspended: false }),
      });

      // 7. Wellbeing: aggregate minutes only, deletable
      await fetch(`${baseUrl}/v1/feed/wellbeing/tick`, {
        method: "POST", headers: hdr, body: JSON.stringify({ deltaMinutes: 5 }),
      });
      const sWb = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sWb.wellbeing.todayActiveMinutes, 5);
      await fetch(`${baseUrl}/v1/feed/wellbeing`, { method: "DELETE", headers: hdr });
      const sWbCleared = (await (await fetch(`${baseUrl}/v1/feed/attention`, { headers: hdr })).json()) as any;
      assert.equal(sWbCleared.wellbeing.todayActiveMinutes, 0);

      // 8. Audit log records feed_paused / feed_resumed with zero URLs
      const auditRes = (await (await fetch(`${baseUrl}/v1/audit?limit=50`, { headers: hdr })).json()) as { entries: any[] };
      assert.ok(auditRes.entries.some((e) => e.action === "feed_paused"));
      assert.ok(auditRes.entries.some((e) => e.action === "feed_resumed"));
      assert.ok(!JSON.stringify(auditRes.entries).includes("https://www.instagram.com"));
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
