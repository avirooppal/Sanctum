import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string, mockScript?: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string; pipeName: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  const args = ["--harness", "--data-dir", dataDir, "--provider", "mock"];
  if (mockScript) args.push("--mock-script", mockScript);
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, args, { stdio: ["ignore", "pipe", "pipe"] });
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
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exit ${code}: ${stderr}`)); });
  });
}

describe("Phase 2.4: Trusted-channel audit, route-enumeration & approval replay protection", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p2-4-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("every mutating route in HarnessServer.cs has a declared approval class and all high-risk routes reject HTTP bearer", async () => {
    const daemon = await startDaemon(path.join(tmpRoot, "appdata-1"));
    procs.push(daemon.proc);
    const headers = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };

    // 1. Fetch declared mutating routes from host
    const routesRes = await fetch(`${daemon.baseUrl}/v1/routes`, { headers });
    assert.equal(routesRes.status, 200);
    const { mutatingRoutes } = await routesRes.json();
    assert.ok(Array.isArray(mutatingRoutes) && mutatingRoutes.length >= 25);

    const declaredPaths = new Set(mutatingRoutes.map((r: any) => `${r.method} ${r.route}`));
    for (const r of mutatingRoutes) {
      assert.ok(r.approvalClass && r.approvalClass.length > 0, `Route ${r.method} ${r.route} missing approvalClass`);
    }

    // 2. Static scan of HarnessServer.cs: every literal `method == "POST" && path == "/v1/..."` must be declared
    const serverSrc = fs.readFileSync(path.join(ROOT, "tools", "native", "harness", "HarnessServer.cs"), "utf-8");
    const literalRouteRx = /method\s*==\s*"(POST|PUT|DELETE)"\s*&&\s*path\s*==\s*"(\/v1\/[^"]+)"/g;
    const undeclared: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = literalRouteRx.exec(serverSrc)) !== null) {
      const key = `${match[1]} ${match[2]}`;
      if (!declaredPaths.has(key)) {
        undeclared.push(key);
      }
    }
    assert.deepEqual(undeclared, [], `Undeclared mutating routes found in HarnessServer.cs: ${undeclared.join(", ")}`);

    // 3. Verify high-risk mutating routes reject HTTP bearer (403 trusted_channel_required)
    const sess = await (
      await fetch(`${daemon.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Audit", model: "mock" }),
      })
    ).json();

    // Enable offline first so disabling it is high-risk
    await fetch(`${daemon.baseUrl}/v1/network/offline`, {
      method: "POST",
      headers,
      body: JSON.stringify({ offline: true }),
    });

    const highRiskChecks: Array<{ label: string; path: string; body: any }> = [
      { label: "persistent rules", path: "/v1/rules", body: { tool: "run_command", effect: "allow", pattern: "*" } },
      { label: "full_auto", path: `/v1/sessions/${sess.sessionId}/autonomy`, body: { autonomy: "full_auto" } },
      { label: "MCP registration", path: "/v1/mcp/servers", body: { id: "m1", command: "node", args: [] } },
      { label: "hooks approve", path: "/v1/extensions/hooks/approve", body: { workspace: tmpRoot } },
      { label: "schedule create", path: "/v1/schedules", body: { name: "j1", prompt: "hi", cron: "0 * * * *" } },
      { label: "workspace trust", path: "/v1/workspace/trust", body: { workspace: tmpRoot, contentHash: "abc" } },
      { label: "enable network feature", path: "/v1/network/features", body: { feature: "web_tools", enabled: true } },
      { label: "disable offline mode", path: "/v1/network/offline", body: { offline: false } },
    ];

    for (const chk of highRiskChecks) {
      const r = await fetch(`${daemon.baseUrl}${chk.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(chk.body),
      });
      assert.equal(r.status, 403, `High-risk route '${chk.label}' (${chk.path}) MUST return 403 over HTTP bearer, got ${r.status}`);
    }
  });

  test("host-generated approval cards bind callId + argsSha256 and cannot be replayed or swapped", async () => {
    const wsDir = path.join(tmpRoot, "ws-replay");
    fs.mkdirSync(wsDir, { recursive: true });
    const scriptPath = path.join(tmpRoot, "mock-replay.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Creating file"],
            toolCalls: [{ id: "tc_bind", name: "create_file", arguments: { path: "hello.txt", content: "v1" } }],
          },
          { contentDeltas: ["Done"] },
        ],
      }),
      "utf-8"
    );

    const daemon = await startDaemon(path.join(tmpRoot, "appdata-2"), scriptPath);
    procs.push(daemon.proc);
    const headers = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };

    const sess = await (
      await fetch(`${daemon.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Replay", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock" }),
      })
    ).json();

    await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "create hello.txt", idempotencyKey: "rep-1" }),
    });

    let pending: any = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      pending = cur.events.find((e: any) => e.type === "approval_requested");
      if (pending) break;
    }
    assert.ok(pending, "approval_requested must be emitted");
    assert.ok(pending.payload.cardText && pending.payload.cardText.includes("hello.txt"), "host cardText must include real call args");
    assert.ok(pending.payload.argsSha256 && pending.payload.argsSha256.length === 64);

    // 1. Mismatched argsSha256 must fail (403 or 409)
    const wrongHash = await fetch(`${daemon.baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ approved: true, callId: pending.payload.callId, argsSha256: "0000000000000000000000000000000000000000000000000000000000000000" }),
    });
    assert.ok(wrongHash.status === 403 || wrongHash.status === 409, `Mismatched argsSha256 must be rejected with 403/409, got ${wrongHash.status}`);

    // 2. Valid approval succeeds once (200)
    const okRes = await fetch(`${daemon.baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ approved: true, callId: pending.payload.callId, argsSha256: pending.payload.argsSha256 }),
    });
    assert.equal(okRes.status, 200);

    // 3. Replaying the exact same approvalId must fail (404 or 409)
    const replayRes = await fetch(`${daemon.baseUrl}/v1/approvals/${pending.payload.approvalId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ approved: true, callId: pending.payload.callId, argsSha256: pending.payload.argsSha256 }),
    });
    assert.ok(replayRes.status === 404 || replayRes.status === 409, `Replay must fail with 404/409, got ${replayRes.status}`);
  });
});
