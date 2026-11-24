import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, spawnSync, type ChildProcess } from "node:child_process";
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

describe("Part A3: Attention inbox, workspace-labeled approvals, transfer, export/import & CLI", () => {
  test("Approval cards carry workspace name/root, attention inbox tracks live counts, and switching does not interrupt active run", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a3-attn-"));
    const dataDir = path.join(tmpBase, "appdata");
    const rootA = path.join(tmpBase, "ws_a");
    const rootB = path.join(tmpBase, "ws_b");
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });

    const scriptPath = path.join(tmpBase, "mock_approval.json");
    fs.writeFileSync(scriptPath, JSON.stringify({
      turns: [
        {
          content: "Creating file in Workspace B...",
          toolCalls: [{ id: "call_b1", name: "create_file", arguments: { path: "hello.txt", content: "hi" } }],
        },
        { content: "Created hello.txt.", toolCalls: [] },
      ],
    }), "utf-8");

    const { proc, baseUrl, token } = await startDaemon(dataDir, scriptPath);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const wsA = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "WorkspaceA", rootPath: rootA }),
      })).json()) as { id: string };
      const wsB = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "WorkspaceB", rootPath: rootB }),
      })).json()) as { id: string };

      const sB = (await (await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "RunInB", workspaceId: wsB.id, model: "mock", autonomy: "ask_all" }),
      })).json()) as { sessionId: string };

      await fetch(`${baseUrl}/v1/sessions/${sB.sessionId}/messages`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "create hello.txt" }),
      });

      // Poll GET /v1/attention until approval appears
      let inbox: any = null;
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) {
        const r = await fetch(`${baseUrl}/v1/attention`, { headers: hdr });
        const d = await r.json();
        if (d.totalAttention > 0) { inbox = d; break; }
        await new Promise((res) => setTimeout(res, 100));
      }
      assert.ok(inbox, "Expected pending approval in global attention inbox");
      assert.equal(inbox.totalAttention, 1);
      assert.equal(inbox.byWorkspace[wsB.id].attentionCount, 1);
      assert.equal(inbox.byWorkspace[wsB.id].runningCount, 1);

      const item = inbox.items[0];
      assert.equal(item.workspaceId, wsB.id);
      assert.equal(item.workspaceName, "WorkspaceB");
      assert.equal(item.workspaceRoot.toLowerCase(), rootB.toLowerCase());
      assert.ok(item.cardText.includes("[Workspace: WorkspaceB ("));

      // Simulate switching client view to Workspace A while Workspace B's run is waiting
      const switchRes = await fetch(`${baseUrl}/v1/sessions?workspaceId=${wsA.id}`, { headers: hdr });
      assert.equal(switchRes.status, 200);

      // Workspace B's run is still alive; approve it and verify completion
      const approveRes = await fetch(`${baseUrl}/v1/approvals/${item.approvalId}`, {
        method: "POST", headers: hdr, body: JSON.stringify({ approved: true, scope: "once", callId: item.callId }),
      });
      assert.equal(approveRes.status, 200);

      // Wait for hello.txt to be written in Workspace B (not A)
      const doneDeadline = Date.now() + 5000;
      while (Date.now() < doneDeadline && !fs.existsSync(path.join(rootB, "hello.txt"))) {
        await new Promise((res) => setTimeout(res, 100));
      }
      assert.equal(fs.readFileSync(path.join(rootB, "hello.txt"), "utf-8"), "hi");
      assert.equal(fs.existsSync(path.join(rootA, "hello.txt")), false);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  test("Trusted-channel cross-workspace transfer, Sanctum-only export/import, and CLI workspaces + run --workspace", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a3-cli-"));
    const dataDir = path.join(tmpBase, "appdata");
    const rootA = path.join(tmpBase, "proj_a");
    const rootB = path.join(tmpBase, "proj_b");
    const rootUnreg = path.join(tmpBase, "unregistered_proj");
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });
    fs.mkdirSync(rootUnreg, { recursive: true });
    fs.writeFileSync(path.join(rootA, "private_project_code.txt"), "USER_SOURCE_NEVER_EXPORTED", "utf-8");

    const { proc, baseUrl, token, pipeName } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const wsA = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "ProjA", rootPath: rootA }),
      })).json()) as { id: string };
      const wsB = (await (await fetch(`${baseUrl}/v1/workspaces`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "ProjB", rootPath: rootB }),
      })).json()) as { id: string };

      const memA = (await (await fetch(`${baseUrl}/v1/memory`, {
        method: "POST", headers: hdr, body: JSON.stringify({ content: "SHAREABLE_FACT", workspaceId: wsA.id }),
      })).json()) as { id: string };
      const docA = (await (await fetch(`${baseUrl}/v1/workspaces/${wsA.id}/vault/documents`, {
        method: "POST", headers: hdr, body: JSON.stringify({ title: "guide.md", content: "SHAREABLE_VAULT_DOC" }),
      })).json()) as { id: string };

      // 1. Transfer over HTTP bearer -> 403 trusted_channel_required
      const httpTransfer = await fetch(`${baseUrl}/v1/workspaces/transfer`, {
        method: "POST", headers: hdr,
        body: JSON.stringify({ kind: "memory", sourceWorkspaceId: wsA.id, targetWorkspaceId: wsB.id, itemId: memA.id }),
      });
      assert.equal(httpTransfer.status, 403);

      // Transfer over trusted pipe -> 200
      const pipeMem = await sendPipe(pipeName, "POST", "/v1/workspaces/transfer", {
        kind: "memory", sourceWorkspaceId: wsA.id, targetWorkspaceId: wsB.id, itemId: memA.id,
      });
      assert.equal(pipeMem.status, 200);
      const pipeVault = await sendPipe(pipeName, "POST", "/v1/workspaces/transfer", {
        kind: "vault", sourceWorkspaceId: wsA.id, targetWorkspaceId: wsB.id, itemId: docA.id,
      });
      assert.equal(pipeVault.status, 200);

      const memB = (await (await fetch(`${baseUrl}/v1/memory?workspaceId=${wsB.id}`, { headers: hdr })).json()) as { facts: Array<{ content: string }> };
      assert.ok(memB.facts.some((f) => f.content === "SHAREABLE_FACT"));

      // 2. Export contains ONLY Sanctum data (never user's project files)
      const expRes = await fetch(`${baseUrl}/v1/workspaces/${wsA.id}/export`, { headers: hdr });
      assert.equal(expRes.status, 200);
      const bundle = await expRes.json() as any;
      assert.equal(bundle.sanctumDataOnly, true);
      assert.ok(!JSON.stringify(bundle).includes("USER_SOURCE_NEVER_EXPORTED"));

      const exportFile = path.join(tmpBase, "proja_export.json");
      fs.writeFileSync(exportFile, JSON.stringify(bundle), "utf-8");

      // 3. CLI: workspaces list, create, rename, import, remove
      const listOut = JSON.parse(execFileSync(HOST_EXE, ["workspaces", "list", "--data-dir", dataDir], { encoding: "utf-8" }).trim());
      assert.ok(listOut.workspaces.length >= 2);

      const impOut = JSON.parse(execFileSync(HOST_EXE, ["workspaces", "import", "--in", exportFile, "--name", "ImportedProj", "--data-dir", dataDir], { encoding: "utf-8" }).trim());
      assert.equal(impOut.name, "ImportedProj");
      assert.equal(impOut.importedMemoryCount, 1);
      assert.equal(impOut.importedVaultCount, 1);

      const renOut = JSON.parse(execFileSync(HOST_EXE, ["workspaces", "rename", impOut.id, "--name", "RenamedProj", "--data-dir", dataDir], { encoding: "utf-8" }).trim());
      assert.equal(renOut.name, "RenamedProj");

      const rmOut = JSON.parse(execFileSync(HOST_EXE, ["workspaces", "remove", impOut.id, "--confirm", "RenamedProj", "--data-dir", dataDir], { encoding: "utf-8" }).trim());
      assert.equal(rmOut.ok, true);

      // 4. CLI: run --workspace <unknown-path> fails closed unless --create is passed
      const failRun = spawnSync(HOST_EXE, ["run", "hello", "--workspace", rootUnreg, "--data-dir", dataDir, "--json"], { encoding: "utf-8" });
      assert.notEqual(failRun.status, 0, "Expected unknown workspace path to fail closed without --create");

      const okRun = spawnSync(HOST_EXE, ["run", "hello", "--workspace", rootUnreg, "--create", "--data-dir", dataDir, "--json"], { encoding: "utf-8" });
      const rtNow = fs.readFileSync(path.join(dataDir, "runtime.json"), "utf-8");
      assert.equal(okRun.status, 0, `Expected --create to succeed (daemonExit=${proc.exitCode}, baseUrl=${baseUrl}, rt=${rtNow}), stdout=${okRun.stdout}, stderr=${okRun.stderr}`);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
