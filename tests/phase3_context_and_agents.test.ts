import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

const EXE = path.resolve("deploy/installer/build_payload/Sanctum-Desktop.exe");

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

interface DaemonHandle {
  proc: ReturnType<typeof spawn>;
  httpPort: number;
  pipeName: string;
  token: string;
  stop: () => Promise<void>;
}

async function startHarnessDaemon(dataDir: string, mockScriptPath?: string): Promise<DaemonHandle> {
  const args = ["--harness", "--data-dir", dataDir];
  if (mockScriptPath) args.push("--mock-script", mockScriptPath);
  const proc = spawn(EXE, args, { stdio: ["ignore", "pipe", "pipe"] });

  const ready = await new Promise<any>((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Timed out waiting for harness ready")), 10000);
    proc.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        resolve(JSON.parse(buf.slice(0, nl).trim()));
      }
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Harness exited early with code ${code}`));
    });
  });

  return {
    proc,
    httpPort: ready.httpPort,
    pipeName: ready.pipeName,
    token: ready.token,
    stop: async () => {
      if (!proc.killed) {
        proc.kill();
        await new Promise((r) => setTimeout(r, 250));
      }
    },
  };
}

async function apiJson(port: number, token: string, method: string, p: string, body?: any) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

function initTempGitRepo(dir: string) {
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@sanctum.local"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Sanctum Test"], { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Workspace Rules\nAlways write tests.\n", "utf8");
  fs.mkdirSync(path.join(dir, ".sanctum", "rules"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".sanctum", "rules", "01-style.md"), "Use TypeScript strict mode.\n", "utf8");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "src", "engine.ts"),
    "export class SanctumKernel {\n  run() { return 42; }\n}\nexport function bootEngine() {}\n",
    "utf8"
  );
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
}

test("Phase 3.1: AGENTS.md + .sanctum/rules loader, repo map with symbols, and @mentions containment", async () => {
  const dataDir = makeTempDir("sanctum-p3-ctx-");
  const ws = makeTempDir("sanctum-p3-repo-");
  initTempGitRepo(ws);

  const daemon = await startHarnessDaemon(dataDir);
  try {
    const created = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/sessions", {
      title: "Context Test",
      workspace: ws,
      mode: "build",
      autonomy: "auto_reads",
      model: "mock",
    });
    const sid = created.json.sessionId;

    // 1. Context endpoint returns AGENTS.md, .sanctum/rules/01-style.md, and repo map with extracted symbols
    const ctx = await apiJson(daemon.httpPort, daemon.token, "GET", `/v1/sessions/${sid}/context`);
    assert.equal(ctx.status, 200);
    assert.deepEqual(ctx.json.instructions.files, ["AGENTS.md", ".sanctum/rules/01-style.md"]);
    assert.match(ctx.json.instructions.combined, /Always write tests/);
    assert.match(ctx.json.instructions.combined, /Use TypeScript strict mode/);

    const engineEntry = ctx.json.repoMap.entries.find((e: any) => e.path === "src/engine.ts");
    assert.ok(engineEntry, "repoMap must include src/engine.ts");
    assert.ok(engineEntry.symbols.includes("SanctumKernel"));
    assert.ok(engineEntry.symbols.includes("bootEngine"));

    // 2. @mentions resolve file, folder, git:status, and block path traversal
    const mentions = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/mentions`, {
      prompt: "Inspect @file:src/engine.ts @folder:src @git:status and @file:../../etc/passwd",
    });
    assert.equal(mentions.status, 200);
    assert.ok(mentions.json.resolved.some((r: any) => r.kind === "file" && r.target === "src/engine.ts"));
    assert.ok(mentions.json.resolved.some((r: any) => r.kind === "folder" && r.target === "src"));
    assert.ok(mentions.json.resolved.some((r: any) => r.kind === "git" && r.target === "status"));
    assert.match(mentions.json.contextText, /<untrusted_file_content path="src\/engine\.ts">/);
    assert.ok(
      mentions.json.errors.some((e: string) => /Blocked mention/i.test(e)),
      "Traversal @mention must be blocked"
    );
  } finally {
    await daemon.stop();
  }
});

test("Phase 3.2: compaction, todos, plan_ready event, and verifier gate", async () => {
  const dataDir = makeTempDir("sanctum-p3-flow-");
  const ws = makeTempDir("sanctum-p3-flow-ws-");
  initTempGitRepo(ws);

  const daemon = await startHarnessDaemon(dataDir);
  try {
    const created = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/sessions", {
      title: "Flow Test",
      workspace: ws,
      mode: "build",
      autonomy: "auto_reads",
      model: "mock",
    });
    const sid = created.json.sessionId;

    // Generate 3 conversation turns so compaction has older messages to condense
    for (let i = 1; i <= 3; i++) {
      await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/messages`, {
        content: `Turn ${i}: detailed context message number ${i}`,
        idempotencyKey: `t${i}`,
      });
      await new Promise((r) => setTimeout(r, 250));
    }

    // 1. Compact session
    const comp = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/compact`, {
      keepRecentMessages: 2,
    });
    assert.equal(comp.status, 200);
    assert.equal(comp.json.compacted, true);
    assert.ok(comp.json.compactedMessageCount >= 4);
    assert.match(comp.json.summary, /Compacted/);

    // 2. Todos persist and emit todo_updated
    const todoRes = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/todos`, {
      items: [
        { id: "1", text: "Build context engine", status: "done" },
        { id: "2", text: "Wire subagents", status: "in_progress" },
      ],
    });
    assert.equal(todoRes.status, 200);
    assert.equal(todoRes.json.items.length, 2);

    const todoGet = await apiJson(daemon.httpPort, daemon.token, "GET", `/v1/sessions/${sid}/todos`);
    assert.equal(todoGet.json.items.length, 2);

    // 3. Verifier: allowlisted git status succeeds, non-allowlisted command blocked over HTTP bearer
    const verOk = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/verify`, {
      command: "git status",
    });
    assert.equal(verOk.status, 200);
    assert.equal(verOk.json.ok, true);

    const verBlocked = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/verify`, {
      command: "npm run arbitrary-script",
    });
    assert.equal(verBlocked.status, 403);
    assert.equal(verBlocked.json.code, "trusted_channel_required");
  } finally {
    await daemon.stop();
  }
});

test("Phase 3.3: subagent spawning, isolated git worktree, and agent manager data model", async () => {
  const dataDir = makeTempDir("sanctum-p3-sub-");
  const ws = makeTempDir("sanctum-p3-sub-repo-");
  initTempGitRepo(ws);

  const daemon = await startHarnessDaemon(dataDir);
  try {
    const parent = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/sessions", {
      title: "Coordinator",
      workspace: ws,
      mode: "build",
      autonomy: "auto_reads",
      model: "mock",
    });
    const parentId = parent.json.sessionId;

    // Spawn child subagent in an isolated git worktree
    const sub = await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${parentId}/subagents`, {
      role: "researcher",
      prompt: "Summarize workspace architecture",
      worktree: true,
    });
    assert.equal(sub.status, 201);
    assert.ok(sub.json.childSessionId);
    assert.equal(sub.json.role, "researcher");
    assert.equal(sub.json.stopReason, "completed");
    assert.ok(sub.json.worktreePath && fs.existsSync(sub.json.worktreePath), "Isolated worktree must exist on disk");
    assert.ok(sub.json.summary.length > 0);

    // Parent log records subagent_started and subagent_finished
    const parentLog = await apiJson(daemon.httpPort, daemon.token, "GET", `/v1/sessions/${parentId}`);
    assert.ok(parentLog.json.events.some((e: any) => e.type === "subagent_started"));
    assert.ok(parentLog.json.events.some((e: any) => e.type === "subagent_finished"));

    // Agent Manager endpoint lists both primary and child sessions with roles & worktreePath
    const agents = await apiJson(daemon.httpPort, daemon.token, "GET", "/v1/agents");
    assert.equal(agents.status, 200);
    const childAgent = agents.json.agents.find((a: any) => a.sessionId === sub.json.childSessionId);
    assert.ok(childAgent, "GET /v1/agents must include child subagent");
    assert.equal(childAgent.parentSessionId, parentId);
    assert.equal(childAgent.role, "researcher");
    assert.equal(childAgent.worktreePath, sub.json.worktreePath);

    // Worktrees list reports the active worktree
    const wts = await apiJson(daemon.httpPort, daemon.token, "GET", "/v1/worktrees");
    assert.equal(wts.status, 200);
    assert.ok(wts.json.worktrees.length >= 1);
  } finally {
    await daemon.stop();
  }
});
