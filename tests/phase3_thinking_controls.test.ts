import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 3.5: Thinking/effort parameter maps to Ollama only when model supports thinking", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3-5-"));
  const procs: ChildProcess[] = [];
  const servers: http.Server[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    for (const s of servers) { try { s.close(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("sends think parameter for thinking-capable model and omits it for non-thinking model", async () => {
    const captured: Record<string, any> = {};
    const mockOllama = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString("utf-8")));
      req.on("end", () => {
        if (req.url === "/api/show" && req.method === "POST") {
          const { name } = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              capabilities: name.includes("qwen3") ? ["tools", "thinking"] : ["tools"],
              model_info: { "ctx.context_length": 16384 },
            })
          );
          return;
        }
        if (req.url === "/api/chat" && req.method === "POST") {
          const parsed = JSON.parse(body);
          captured[parsed.model] = parsed;
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

    const runOne = async (model: string, think: boolean) => {
      const s = await (
        await fetch(`${baseUrl}/v1/sessions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ title: model, model, think }),
        })
      ).json();
      await fetch(`${baseUrl}/v1/sessions/${s.sessionId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "hello", idempotencyKey: `th-${model}` }),
      });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const cur = await (await fetch(`${baseUrl}/v1/sessions/${s.sessionId}`, { headers })).json();
        if (cur.events.some((e: any) => e.type === "run_finished")) break;
      }
    };

    await runOne("qwen3:8b", true);
    await runOne("llama3.2:3b", true);

    assert.equal(captured["qwen3:8b"].think, true, "Thinking-capable model must receive think=true");
    assert.equal("think" in captured["llama3.2:3b"], false, "Non-thinking model must NOT receive think parameter");
  });
});
