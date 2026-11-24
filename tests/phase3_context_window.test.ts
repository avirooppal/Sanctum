import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 3.1: Explicit num_ctx & pre-truncation auto-compaction", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3-1-"));
  const procs: ChildProcess[] = [];
  const servers: http.Server[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    for (const s of servers) { try { s.close(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("OllamaProvider explicitly sends options.num_ctx and long-history session auto-compacts before truncation", async () => {
    const capturedRequests: any[] = [];
    const mockOllama = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString("utf-8")));
      req.on("end", () => {
        if (req.url === "/api/show" && req.method === "POST") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            capabilities: ["tools", "thinking"],
            model_info: { "qwen3.context_length": 16384 },
          }));
          return;
        }
        if (req.url === "/api/chat" && req.method === "POST") {
          const parsed = JSON.parse(body);
          capturedRequests.push(parsed);
          res.writeHead(200, { "Content-Type": "application/x-ndjson" });
          res.write(JSON.stringify({ message: { role: "assistant", content: "OK reply" }, done: false }) + "\n");
          res.write(JSON.stringify({ message: { role: "assistant", content: "" }, done: true, prompt_eval_count: 100, eval_count: 10 }) + "\n");
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
      proc.on("exit", (code) => reject(new Error(`Exited early ${code}`)));
    });

    const baseUrl = `http://127.0.0.1:${info.httpPort}`;
    const headers = { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" };

    // 1. Default session: num_ctx must be explicitly set (not undefined)
    const s1 = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Default Ctx", model: "qwen3:1.7b" }),
      })
    ).json();
    await fetch(`${baseUrl}/v1/sessions/${s1.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Hello", idempotencyKey: "ctx-1" }),
    });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${baseUrl}/v1/sessions/${s1.sessionId}`, { headers })).json();
      if (cur.events.some((e: any) => e.type === "run_finished")) break;
    }
    assert.ok(capturedRequests.length >= 1);
    assert.ok(
      typeof capturedRequests[0].options?.num_ctx === "number" && capturedRequests[0].options.num_ctx >= 4096,
      `Expected explicit options.num_ctx >= 4096, got ${JSON.stringify(capturedRequests[0].options)}`
    );

    // 2. Long-history session with tight numCtx=2048 triggers context_warning + auto-compaction BEFORE truncation
    const s2 = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Long History", model: "qwen3:1.7b", numCtx: 2048 }),
      })
    ).json();

    const bigBlock = "Paragraph of detailed engineering context. ".repeat(80); // ~3280 chars (~860 tokens)
    for (let turn = 1; turn <= 3; turn++) {
      await fetch(`${baseUrl}/v1/sessions/${s2.sessionId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: `Turn ${turn}: ${bigBlock}`, idempotencyKey: `long-${turn}` }),
      });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const cur = await (await fetch(`${baseUrl}/v1/sessions/${s2.sessionId}`, { headers })).json();
        if (cur.events.filter((e: any) => e.type === "run_finished").length >= turn) break;
      }
    }

    const s2Data = await (await fetch(`${baseUrl}/v1/sessions/${s2.sessionId}`, { headers })).json();
    assert.ok(
      s2Data.events.some((e: any) => e.type === "context_warning" && e.payload?.autoCompacted === true),
      "Long-history session must emit context_warning with autoCompacted=true before truncation"
    );
    assert.ok(
      s2Data.events.some((e: any) => e.type === "compaction"),
      "Long-history session must trigger compaction event before truncation"
    );

    const ctxInfo = await (await fetch(`${baseUrl}/v1/sessions/${s2.sessionId}/context`, { headers })).json();
    assert.equal(ctxInfo.numCtx, 2048);
    assert.equal(ctxInfo.modelMaxContext, 16384);
    assert.equal(typeof ctxInfo.estimatedTokens, "number");
  });
});
