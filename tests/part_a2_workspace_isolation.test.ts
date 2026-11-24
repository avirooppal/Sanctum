import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
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
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`Daemon timeout: ${stderr}`));
    }, 10000);
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
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Daemon exited (${code}): ${stderr}`)); });
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
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    });
    c.on("error", reject);
  });
}

async function waitForRunFinished(baseUrl: string, token: string, sessionId: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${baseUrl}/v1/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const data = await r.json() as { events: Array<{ type: string; payload: any }> };
      if (data.events.some((e) => e.type === "run_finished")) return data.events;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error("Timed out waiting for run_finished");
}

describe("Part A2: Host-layer workspace isolation, ownership enforcement & prompt-injection defense", () => {
  test("Isolates sessions, memory tiers, vault, rules, MCP servers, and schedules per workspace", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a2-iso-"));
    const dataDir = path.join(tmpBase, "appdata");
    const rootA = path.join(tmpBase, "ws_a");
    const rootB = path.join(tmpBase, "ws_b");
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });

    const { proc, baseUrl, token, pipeName } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const wsA = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "WorkA", rootPath: rootA }),
      })).json()) as { id: string };
      const wsB = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "WorkB", rootPath: rootB }),
      })).json()) as { id: string };

      // 1. Sessions isolation + ownership enforcement + fork inheritance
      const sA = (await (await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "SessA", workspaceId: wsA.id, model: "mock" }),
      })).json()) as { sessionId: string; workspaceId: string };
      const sB = (await (await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "SessB", workspaceId: wsB.id, model: "mock" }),
      })).json()) as { sessionId: string; workspaceId: string };
      assert.equal(sA.workspaceId, wsA.id);
      assert.equal(sB.workspaceId, wsB.id);

      const listA = (await (await fetch(`${baseUrl}/v1/sessions?workspaceId=${wsA.id}`, { headers: hdr })).json()) as { sessions: Array<{ sessionId: string }> };
      assert.deepEqual(listA.sessions.map((s) => s.sessionId), [sA.sessionId]);

      const listAll = (await (await fetch(`${baseUrl}/v1/sessions?allWorkspaces=true`, { headers: hdr })).json()) as { sessions: Array<{ sessionId: string }> };
      assert.equal(listAll.sessions.length, 2);

      // Cross-workspace session access -> 403 workspace_mismatch
      const crossGet = await fetch(`${baseUrl}/v1/sessions/${sA.sessionId}?workspaceId=${wsB.id}`, { headers: hdr });
      assert.equal(crossGet.status, 403);
      const crossPost = await fetch(`${baseUrl}/v1/sessions/${sA.sessionId}/messages`, {
        method: "POST",
        headers: { ...hdr, "X-Sanctum-Workspace": wsB.id },
        body: JSON.stringify({ content: "hi" }),
      });
      assert.equal(crossPost.status, 403);

      // Fork stays in Workspace A
      const forkRes = await fetch(`${baseUrl}/v1/sessions/${sA.sessionId}/fork`, {
        method: "POST", headers: hdr, body: JSON.stringify({ forkAfterSeq: 1, title: "ForkA" }),
      });
      assert.equal(forkRes.status, 201);
      assert.equal(((await forkRes.json()) as { workspaceId: string }).workspaceId, wsA.id);

      // 2. Memory tiers: workspace A, workspace B, and explicit global
      await fetch(`${baseUrl}/v1/memory`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "SECRET_FACT_A", workspaceId: wsA.id }),
      });
      await fetch(`${baseUrl}/v1/memory`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "SECRET_FACT_B", workspaceId: wsB.id }),
      });
      await fetch(`${baseUrl}/v1/memory`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "GLOBAL_SHARED_FACT", scope: "global" }),
      });

      const memA = (await (await fetch(`${baseUrl}/v1/memory?workspaceId=${wsA.id}`, { headers: hdr })).json()) as { facts: Array<{ content: string }> };
      assert.deepEqual(memA.facts.map((f) => f.content), ["SECRET_FACT_A"]);

      const memAWithGlobal = (await (await fetch(`${baseUrl}/v1/memory?workspaceId=${wsA.id}&includeGlobal=true`, { headers: hdr })).json()) as { facts: Array<{ content: string }> };
      const contentsA = memAWithGlobal.facts.map((f) => f.content);
      assert.ok(contentsA.includes("SECRET_FACT_A"));
      assert.ok(contentsA.includes("GLOBAL_SHARED_FACT"));
      assert.ok(!contentsA.includes("SECRET_FACT_B"));

      // 3. Vault isolation
      await fetch(`${baseUrl}/v1/workspaces/${wsB.id}/vault/documents`, {
        method: "POST", headers: hdr,
        body: JSON.stringify({ title: "secret_b.md", collection: "Confidential", content: "TOP_SECRET_WORKSPACE_B_PAYLOAD" }),
      });
      const searchVaultA = (await (await fetch(`${baseUrl}/v1/workspaces/${wsA.id}/vault/search`, {
        method: "POST", headers: hdr, body: JSON.stringify({ query: "TOP_SECRET_WORKSPACE_B" }),
      })).json()) as { results: any[] };
      assert.equal(searchVaultA.results.length, 0);

      const searchVaultB = (await (await fetch(`${baseUrl}/v1/workspaces/${wsB.id}/vault/search`, {
        method: "POST", headers: hdr, body: JSON.stringify({ query: "TOP_SECRET_WORKSPACE_B" }),
      })).json()) as { results: any[] };
      assert.equal(searchVaultB.results.length, 1);

      // 4. Rules, MCP servers, and Schedules isolation (created via trusted pipe)
      const ruleA = await sendPipe(pipeName, "POST", "/v1/rules", { workspaceId: wsA.id, effect: "allow", tool: "read_file" });
      assert.equal(ruleA.status, 201);
      const rulesB = (await (await fetch(`${baseUrl}/v1/rules?workspaceId=${wsB.id}`, { headers: hdr })).json()) as { rules: any[] };
      assert.equal(rulesB.rules.length, 0);

      const mcpA = await sendPipe(pipeName, "POST", "/v1/mcp/servers", { id: "srv_a", workspaceId: wsA.id, command: "node", args: ["-v"] });
      assert.equal(mcpA.status, 201);
      const mcpB = (await (await fetch(`${baseUrl}/v1/mcp/servers?workspaceId=${wsB.id}`, { headers: hdr })).json()) as { servers: any[] };
      assert.equal(mcpB.servers.length, 0);

      const jobA = await sendPipe(pipeName, "POST", "/v1/schedules", { name: "JobA", workspaceId: wsA.id, prompt: "hi", model: "mock" });
      assert.equal(jobA.status, 201);
      const jobsB = (await (await fetch(`${baseUrl}/v1/schedules?workspaceId=${wsB.id}`, { headers: hdr })).json()) as { jobs: any[] };
      assert.equal(jobsB.jobs.length, 0);

      // Scheduled job fails closed when its workspace root is missing
      fs.rmSync(rootA, { recursive: true, force: true });
      const runMissing = await fetch(`${baseUrl}/v1/schedules/${jobA.body.id}/run`, { method: "POST", headers: hdr });
      assert.equal(runMissing.status, 409);
      assert.equal(((await runMissing.json()) as { code: string }).code, "workspace_root_missing");
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  test("Prompt injection in Workspace A cannot read/recall/search Workspace B or escape via A2UI FileCard; missing root refuses tools", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a2-inj-"));
    const dataDir = path.join(tmpBase, "appdata");
    const rootA = path.join(tmpBase, "ws_a");
    const rootB = path.join(tmpBase, "ws_b");
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });
    fs.writeFileSync(path.join(rootB, "secret.txt"), "B_ONLY_SECRET_FILE", "utf-8");

    const scriptPath = path.join(tmpBase, "mock_injection.json");
    fs.writeFileSync(scriptPath, JSON.stringify({
      turns: [
        {
          content: "Attempting cross-workspace access...",
          toolCalls: [
            { id: "c1", name: "memory_recall", arguments: { query: "B_ONLY" } },
            { id: "c2", name: "vault_search", arguments: { query: "B_ONLY" } },
            { id: "c3", name: "read_file", arguments: { path: "../ws_b/secret.txt" } },
            {
              id: "c4",
              name: "render_ui",
              arguments: {
                surfaceId: "surf_inj",
                root: "fc1",
                components: [
                  { id: "fc1", type: "FileCard", props: { path: "../ws_b/secret.txt", title: "Stolen" } },
                ],
              },
            },
          ],
        },
        { content: "Done.", toolCalls: [] },
      ],
    }), "utf-8");

    const { proc, baseUrl, token } = await startDaemon(dataDir, scriptPath);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const wsA = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "InjectA", rootPath: rootA }),
      })).json()) as { id: string };
      const wsB = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "VictimB", rootPath: rootB }),
      })).json()) as { id: string };

      // Seed Workspace B with secret memory & vault doc
      await fetch(`${baseUrl}/v1/memory`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "B_ONLY_MEMORY_SECRET", workspaceId: wsB.id }),
      });
      await fetch(`${baseUrl}/v1/workspaces/${wsB.id}/vault/documents`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "b.md", content: "B_ONLY_VAULT_SECRET" }),
      });

      const sA = (await (await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "InjSess", workspaceId: wsA.id, model: "mock", autonomy: "auto_reads" }),
      })).json()) as { sessionId: string };

      await fetch(`${baseUrl}/v1/sessions/${sA.sessionId}/messages`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "Run injected tool calls" }),
      });

      const events = await waitForRunFinished(baseUrl, token, sA.sessionId);
      const toolFinishes = events.filter((e) => e.type === "tool_finished");
      const allOutputs = JSON.stringify(toolFinishes);

      // Zero Workspace B secrets leaked via memory_recall, vault_search, or read_file
      assert.ok(!allOutputs.includes("B_ONLY_MEMORY_SECRET"), "Workspace B memory leaked!");
      assert.ok(!allOutputs.includes("B_ONLY_VAULT_SECRET"), "Workspace B vault leaked!");
      assert.ok(!allOutputs.includes("B_ONLY_SECRET_FILE"), "Workspace B file leaked!");

      // read_file escape rejected
      const readEvt = toolFinishes.find((e) => e.payload.tool === "read_file");
      assert.equal(readEvt?.payload.ok, false);

      // A2UI FileCard escaping into Workspace B marked pathValid: false
      const a2uiEvt = events.find((e) => e.type === "a2ui_surface");
      assert.ok(a2uiEvt);
      const fc = a2uiEvt.payload.surface.components.find((c: any) => c.id === "fc1");
      assert.equal(fc.props.pathValid, false);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
