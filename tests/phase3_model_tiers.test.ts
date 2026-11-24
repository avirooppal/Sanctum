import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 3.3: Model-adaptive capability tiers & session override", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3-3-"));
  const procs: ChildProcess[] = [];
  const servers: http.Server[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    for (const s of servers) { try { s.close(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("weak model gets minimal tier (<=6 tools, no subagents), strong model gets full tier, and session override works", async () => {
    const capturedToolsByModel: Record<string, string[]> = {};
    const mockOllama = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString("utf-8")));
      req.on("end", () => {
        if (req.url === "/api/show" && req.method === "POST") {
          const { name } = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          if (name === "tiny:0.5b") {
            res.end(JSON.stringify({ capabilities: [], model_info: { "tiny.context_length": 4096 } }));
          } else {
            res.end(JSON.stringify({ capabilities: ["tools", "thinking"], model_info: { "strong.context_length": 32768 } }));
          }
          return;
        }
        if (req.url === "/api/chat" && req.method === "POST") {
          const parsed = JSON.parse(body);
          capturedToolsByModel[parsed.model] = (parsed.tools || []).map((t: any) => t.function.name);
          res.writeHead(200, { "Content-Type": "application/x-ndjson" });
          res.write(JSON.stringify({ message: { role: "assistant", content: "OK" }, done: true }) + "\n");
          res.end();
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });
    servers.push(mockOllama);
    await new Promise<void>((r) => mockOllama.listen(0, "127.0.0.1", () => r()));
    const port = (mockOllama.address() as { port: number }).port;

    const dataDir = path.join(tmpRoot, "appdata");
    fs.mkdirSync(dataDir, { recursive: true });
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "ollama", "--ollama-endpoint", `http://127.0.0.1:${port}`],
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

    // 1. Check capabilities + resolved tier for weak vs strong model
    const tinyCaps = await (await fetch(`${baseUrl}/v1/capabilities/tiny:0.5b`, { headers })).json();
    assert.equal(tinyCaps.tierProfile.tier, "minimal");
    assert.equal(tinyCaps.tierProfile.allowSubagents, false);
    assert.equal(tinyCaps.tierProfile.maxSteps, 6);

    const strongCaps = await (await fetch(`${baseUrl}/v1/capabilities/strong:14b`, { headers })).json();
    assert.equal(strongCaps.tierProfile.tier, "full");
    assert.equal(strongCaps.tierProfile.allowSubagents, true);
    assert.equal(strongCaps.tierProfile.maxSteps, 24);

    // 2. Run a turn on tiny:0.5b -> verify exposed tools <= 6 and excludes spawn_subagent
    const s1 = await (await fetch(`${baseUrl}/v1/sessions`, {
      method: "POST", headers, body: JSON.stringify({ title: "Tiny", model: "tiny:0.5b" })
    })).json();
    await fetch(`${baseUrl}/v1/sessions/${s1.sessionId}/messages`, {
      method: "POST", headers, body: JSON.stringify({ content: "hi", idempotencyKey: "t1" })
    });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${baseUrl}/v1/sessions/${s1.sessionId}`, { headers })).json();
      if (cur.events.some((e: any) => e.type === "run_finished")) break;
    }
    assert.ok(capturedToolsByModel["tiny:0.5b"].length <= 6);
    assert.equal(capturedToolsByModel["tiny:0.5b"].includes("spawn_subagent"), false);

    // 3. Override session tier to full -> verify override returns full
    const ovRes = await fetch(`${baseUrl}/v1/sessions/${s1.sessionId}/tier`, {
      method: "POST", headers, body: JSON.stringify({ tier: "full" })
    });
    assert.equal(ovRes.status, 200);
    const ov = await ovRes.json();
    assert.equal(ov.tier, "full");
    assert.equal(ov.overridden, true);
  });
});
