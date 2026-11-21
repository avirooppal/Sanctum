import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseModelToolCalls } from "../core/ai/tools/parse_calls.ts";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");
const CORPUS_PATH = path.join(ROOT, "tests", "fixtures", "tool_call_parser_corpus.json");

interface DaemonHandle {
  proc: ChildProcess;
  httpPort: number;
  pipeName: string;
  token: string;
  baseUrl: string;
}

async function startDaemon(dataDir: string, extraArgs: string[] = []): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, ...extraArgs], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const readyLine = await new Promise<string>((resolve, reject) => {
    let buf = "";
    let err = "";
    const t = setTimeout(() => reject(new Error(`Timeout starting daemon: ${err}`)), 10000);
    proc.stdout!.on("data", (c: Buffer) => {
      buf += c.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(t);
        resolve(buf.slice(0, nl).trim());
      }
    });
    proc.stderr!.on("data", (c: Buffer) => (err += c.toString("utf-8")));
    proc.on("exit", (code) => {
      clearTimeout(t);
      reject(new Error(`Daemon exited (${code}): ${err}`));
    });
  });
  const info = JSON.parse(readyLine);
  return {
    proc,
    httpPort: info.httpPort,
    pipeName: info.pipeName,
    token: info.token,
    baseUrl: `http://127.0.0.1:${info.httpPort}`,
  };
}

async function api(daemon: DaemonHandle, method: string, urlPath: string, body?: unknown) {
  const res = await fetch(`${daemon.baseUrl}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${daemon.token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : {} };
}

function sendPipe(pipeName: string, method: string, urlPath: string, body: Record<string, unknown> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(`\\\\.\\pipe\\${pipeName}`, () => {
      sock.write(JSON.stringify({ method, path: urlPath, body }) + "\n");
    });
    let buf = "";
    sock.on("data", (c: Buffer) => {
      buf += c.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        sock.end();
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    });
    sock.on("error", reject);
  });
}

async function waitForSseEvent(
  daemon: DaemonHandle,
  sessionId: string,
  predicate: (evt: any) => boolean,
  timeoutMs = 10000
): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: any[] = [];
  try {
    const res = await fetch(`${daemon.baseUrl}/v1/sessions/${sessionId}/events?after=0`, {
      headers: { Authorization: `Bearer ${daemon.token}` },
      signal: controller.signal,
    });
    const rdr = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await rdr.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const evt = JSON.parse(line.slice(5).trim());
        events.push(evt);
        if (predicate(evt)) {
          controller.abort();
          return events;
        }
      }
    }
  } catch (e: any) {
    if (!controller.signal.aborted) throw e;
  } finally {
    clearTimeout(timer);
  }
  return events;
}

describe("Phase 1b — Ollama Provider, Shared Parser Corpus, Deny-by-Default Permissions & Builtin Tools", () => {
  test("1. C# ToolCallParser matches TypeScript oracle 1-to-1 across shared JSON fixture corpus", () => {
    const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf-8"));
    const csOut = spawnSync(HOST_EXE, ["--parse-fixture", CORPUS_PATH], { encoding: "utf-8", timeout: 10000 });
    assert.equal(csOut.status, 0, `C# parser fixture failed: ${csOut.stderr}`);
    const csResults = JSON.parse(csOut.stdout);
    assert.equal(csResults.length, corpus.length);

    for (let i = 0; i < corpus.length; i++) {
      const c = corpus[i];
      const tsCalls = parseModelToolCalls(c.input, c.turnId).map((x) => ({
        id: x.id,
        name: x.name,
        arguments: x.arguments,
      }));
      const csCalls = csResults[i].calls.map((x: any) => ({
        id: x.id,
        name: x.name,
        arguments: x.arguments,
      }));
      assert.deepEqual(csCalls, tsCalls, `Mismatch on fixture '${c.id}'`);
    }
  });

  test("2. OllamaProvider queries live capabilities from /api/show and streams thinking + tool calls + content from /api/chat", async () => {
    let chatTurns = 0;
    const mockOllama = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c.toString("utf-8")));
      req.on("end", () => {
        if (req.url === "/api/show") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              capabilities: ["completion", "tools", "thinking", "vision"],
              model_info: { "qwen3.context_length": 40960 },
            })
          );
          return;
        }
        if (req.url === "/api/chat") {
          chatTurns++;
          res.writeHead(200, { "Content-Type": "application/x-ndjson" });
          if (chatTurns === 1) {
            res.write(JSON.stringify({ message: { thinking: "Calculating 6*7." }, done: false }) + "\n");
            res.write(
              JSON.stringify({
                message: {
                  content: "",
                  tool_calls: [{ id: "ol_1", function: { name: "calculator", arguments: { expression: "6 * 7" } } }],
                },
                done: true,
                prompt_eval_count: 25,
                eval_count: 12,
              }) + "\n"
            );
            res.end();
            return;
          }
          res.write(JSON.stringify({ message: { content: "The answer is 42." }, done: true, prompt_eval_count: 40, eval_count: 6 }) + "\n");
          res.end();
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => mockOllama.listen(0, "127.0.0.1", resolve));
    const ollamaPort = (mockOllama.address() as net.AddressInfo).port;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1b-ollama-"));
    const daemon = await startDaemon(tempDir, ["--provider", "ollama", "--ollama-endpoint", `http://127.0.0.1:${ollamaPort}`]);

    try {
      // Live capabilities from /api/show
      const cap = await api(daemon, "GET", "/v1/capabilities/qwen3%3A1.7b");
      assert.equal(cap.status, 200);
      assert.equal(cap.json.provider, "ollama");
      assert.equal(cap.json.capabilities.tools, true);
      assert.equal(cap.json.capabilities.thinking, true);
      assert.equal(cap.json.capabilities.vision, true);
      assert.equal(cap.json.capabilities.contextLength, 40960);

      // End-to-end tool loop via OllamaProvider -> BuiltinTools.calculator
      const s = await api(daemon, "POST", "/v1/sessions", { title: "Ollama Calc", workspace: tempDir, model: "qwen3:1.7b" });
      const sid = s.json.sessionId;
      const donePromise = waitForSseEvent(daemon, sid, (e) => e.type === "run_finished");
      await api(daemon, "POST", `/v1/sessions/${sid}/messages`, { content: "What is 6*7?" });
      const events = await donePromise;

      const toolFin = events.find((e) => e.type === "tool_finished" && e.payload.tool === "calculator");
      assert.ok(toolFin && toolFin.payload.ok === true);
      assert.match(toolFin.payload.output.inline, /"result":42/);
      const finalMsg = events.filter((e) => e.type === "assistant_message").pop();
      assert.equal(finalMsg.payload.content, "The answer is 42.");
    } finally {
      daemon.proc.kill();
      mockOllama.close();
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  test("3. Deny-by-default permissions, Plan Mode guard, high-risk trust model (page blocked, pipe allowed, replay rejected), and builtin tools", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1b-tools-"));
    const wsDir = path.join(tempDir, "ws");
    fs.mkdirSync(wsDir, { recursive: true });

    const scriptPath = path.join(tempDir, "script.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            toolCalls: [
              // 1. Unknown tool -> denied by default
              { id: "c_unk", name: "nonexistent_danger_tool", arguments: {} },
              // 2. Plan mode blocks non-PLAN.md write
              { id: "c_plan_blk", name: "create_file", arguments: { path: "app.js", content: "console.log(1)" } },
              // 3. Low-risk workspace file write -> asks approval (allowed over HTTP bearer)
              { id: "c_plan_ok", name: "create_file", arguments: { path: "PLAN.md", content: "# Plan\n1. Ship" } },
              // 4. Read back PLAN.md -> auto-allowed read, wrapped in <untrusted_file_content>
              { id: "c_read", name: "read_file", arguments: { path: "PLAN.md" } },
              // 5. High-risk non-allowlisted shell command -> asks high-risk approval (HTTP bearer MUST get 403; Named Pipe MUST succeed)
              { id: "c_exec", name: "run_command", arguments: { command: "Write-Output 'approved-via-pipe'" } },
            ],
          },
          { contentDeltas: ["All checks complete."] },
        ],
      })
    );

    const daemon = await startDaemon(tempDir, ["--mock-script", scriptPath]);
    try {
      const s = await api(daemon, "POST", "/v1/sessions", {
        title: "Security & Tools",
        workspace: wsDir,
        mode: "plan",
        autonomy: "auto_reads",
      });
      const sid = s.json.sessionId;

      // Start SSE watcher that resolves approvals as they arrive
      const seenApprovals: any[] = [];
      let httpHighRiskStatus = 0;
      let replayMismatchStatus = 0;
      let replayUsedStatus = 0;
      let pipeHighRiskStatus = 0;

      const controller = new AbortController();
      const sseEvents: any[] = [];
      const sseDone = (async () => {
        const res = await fetch(`${daemon.baseUrl}/v1/sessions/${sid}/events?after=0`, {
          headers: { Authorization: `Bearer ${daemon.token}` },
          signal: controller.signal,
        });
        const rdr = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await rdr.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const evt = JSON.parse(line.slice(5).trim());
            sseEvents.push(evt);
            if (evt.type === "approval_requested") {
              seenApprovals.push(evt.payload);
              const aprId = evt.payload.approvalId;
              const callId = evt.payload.callId;
              if (evt.payload.riskClass === "low") {
                // Low-risk workspace file edit: test wrong callId binding first -> 403, then approve over HTTP bearer -> 200
                const mismatch = await api(daemon, "POST", `/v1/approvals/${aprId}`, {
                  approved: true,
                  scope: "once",
                  callId: "wrong_call_B",
                });
                replayMismatchStatus = mismatch.status;
                const okLow = await api(daemon, "POST", `/v1/approvals/${aprId}`, {
                  approved: true,
                  scope: "once",
                  callId,
                });
                assert.equal(okLow.status, 200);
                // Replaying same approvalId must fail with 409/404
                const replay = await api(daemon, "POST", `/v1/approvals/${aprId}`, {
                  approved: true,
                  scope: "once",
                  callId,
                });
                replayUsedStatus = replay.status;
              } else {
                // High-risk shell command: HTTP bearer MUST be rejected with 403!
                const blockedHttp = await api(daemon, "POST", `/v1/approvals/${aprId}`, {
                  approved: true,
                  scope: "once",
                  callId,
                });
                httpHighRiskStatus = blockedHttp.status;

                // Trusted Named Pipe channel MUST succeed with 200!
                const pipeOk = await sendPipe(daemon.pipeName, "POST", `/v1/approvals/${aprId}`, {
                  approved: true,
                  scope: "once",
                  callId,
                });
                pipeHighRiskStatus = pipeOk.status;
              }
            }
            if (evt.type === "run_finished") {
              controller.abort();
              return;
            }
          }
        }
      })().catch((e: any) => {
        if (!controller.signal.aborted) throw e;
      });

      await api(daemon, "POST", `/v1/sessions/${sid}/messages`, { content: "run security matrix" });
      await sseDone;

      // Assertions
      const unk = sseEvents.find((e) => e.type === "tool_finished" && e.payload.callId === "c_unk");
      assert.equal(unk.payload.denied, true, "Unknown tool must be denied by default");

      const planBlk = sseEvents.find((e) => e.type === "tool_finished" && e.payload.callId === "c_plan_blk");
      assert.equal(planBlk.payload.denied, true, "Plan Mode must block non-PLAN.md write");
      assert.equal(fs.existsSync(path.join(wsDir, "app.js")), false);

      assert.equal(replayMismatchStatus, 403, "Approval for call A must reject mismatched call B");
      assert.ok(replayUsedStatus === 409 || replayUsedStatus === 404, "Consumed approval replay must be rejected");
      assert.equal(httpHighRiskStatus, 403, "HTTP bearer channel MUST NOT approve high-risk exec command");
      assert.equal(pipeHighRiskStatus, 200, "Trusted Named Pipe channel MUST approve high-risk exec command");

      const readEvt = sseEvents.find((e) => e.type === "tool_finished" && e.payload.callId === "c_read");
      assert.equal(readEvt.payload.ok, true);
      assert.match(readEvt.payload.output.inline, /<untrusted_file_content path="PLAN\.md">/);

      const execEvt = sseEvents.find((e) => e.type === "tool_finished" && e.payload.callId === "c_exec");
      assert.equal(execEvt.payload.ok, true);
      assert.match(execEvt.payload.output.inline, /approved-via-pipe/);
    } finally {
      daemon.proc.kill();
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });
});
