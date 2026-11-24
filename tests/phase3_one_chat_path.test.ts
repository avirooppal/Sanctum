import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { streamHarnessChat } from "../src/lib/harnessClient.ts";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 3.2: One chat path (UI, CLI, and HTTP API produce identical harness event logs)", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3-2-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("legacy workspace_chat.ts and fake buildFallbackSteps are deleted and chatSlice routes via streamHarnessChat", () => {
    assert.equal(fs.existsSync(path.join(ROOT, "core", "ai", "tools", "workspace_chat.ts")), false);
    const agentSrc = fs.readFileSync(path.join(ROOT, "src", "store", "slices", "agentSlice.ts"), "utf-8");
    assert.equal(agentSrc.includes("buildFallbackSteps"), false);
    assert.equal(agentSrc.includes("workspace_chat"), false);

    const chatSrc = fs.readFileSync(path.join(ROOT, "src", "store", "slices", "chatSlice.ts"), "utf-8");
    assert.equal(chatSrc.includes("streamWorkspaceChat"), false);
    assert.ok(chatSrc.includes("streamHarnessChat"));
  });

  test("contract test: identical scripted session via UI client, CLI, and HTTP API yields matching event sequences", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, "hello.txt"), "one-chat-path-verified\n", "utf-8");

    const scriptPath = path.join(tmpRoot, "mock-contract.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Reading hello.txt"],
            toolCalls: [{ id: "tc_1", name: "read_file", arguments: { path: "hello.txt" } }],
          },
          { contentDeltas: ["Verified: one-chat-path-verified"] },
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

    // 1. UI client path (streamHarnessChat)
    let uiHarnessId = "";
    let uiFinalText = "";
    for await (const chunk of streamHarnessChat("mock-model", [{ role: "user", content: "Read hello.txt" }], {
      uiSessionId: "ui-contract-1",
      workspace: wsDir,
      baseUrl,
      token: info.token,
      onSessionId: (sid) => { uiHarnessId = sid; },
    })) {
      uiFinalText = chunk.text;
    }
    assert.ok(uiHarnessId, "UI path must create a harness session");
    assert.ok(uiFinalText.includes("one-chat-path-verified"));

    // 2. Direct HTTP API path
    const apiSess = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "API Contract", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock-model" }),
      })
    ).json();
    await fetch(`${baseUrl}/v1/sessions/${apiSess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Read hello.txt", idempotencyKey: "api-1" }),
    });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${baseUrl}/v1/sessions/${apiSess.sessionId}`, { headers })).json();
      if (cur.events.some((e: any) => e.type === "run_finished")) break;
    }

    // 3. CLI path (Sanctum-Desktop.exe run)
    const cliRes = spawnSync(
      HOST_EXE,
      ["run", "Read hello.txt", "--workspace", wsDir, "--model", "mock-model", "--data-dir", dataDir, "--json"],
      { encoding: "utf-8", timeout: 15000 }
    );
    assert.equal(cliRes.status, 0, `CLI run failed: ${cliRes.stderr}`);

    // Fetch all sessions and compare core event-type sequences
    const allSess = await (await fetch(`${baseUrl}/v1/sessions`, { headers })).json();
    const cliSess = allSess.sessions.find((s: any) => s.sessionId !== uiHarnessId && s.sessionId !== apiSess.sessionId);
    assert.ok(cliSess, "CLI path must create a harness session");

    const extractCoreTypes = async (sid: string) => {
      const d = await (await fetch(`${baseUrl}/v1/sessions/${sid}`, { headers })).json();
      return d.events
        .map((e: any) => e.type)
        .filter((t: string) => !["context_usage", "message_checkpoint"].includes(t));
    };

    const uiTypes = await extractCoreTypes(uiHarnessId);
    const apiTypes = await extractCoreTypes(apiSess.sessionId);
    const cliTypes = await extractCoreTypes(cliSess.sessionId);

    assert.deepEqual(uiTypes, apiTypes, "UI path and HTTP API path must emit identical event logs");
    assert.deepEqual(cliTypes, apiTypes, "CLI path and HTTP API path must emit identical event logs");
    assert.ok(uiTypes.includes("tool_call_requested"));
    assert.ok(uiTypes.includes("tool_finished"));
    assert.ok(uiTypes.includes("run_finished"));
  });
});
