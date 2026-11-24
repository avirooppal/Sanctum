import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

interface DaemonHandle {
  proc: ChildProcess;
  httpPort: number;
  token: string;
  baseUrl: string;
}

function startHarnessDaemon(dataDir: string, extraArgs: string[] = []): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, ...extraArgs], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`Daemon startup timeout. stderr=${stderr}`));
    }, 10000);
    proc.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        const info = JSON.parse(buf.slice(0, nl).trim());
        resolve({
          proc,
          httpPort: info.httpPort,
          token: info.token,
          baseUrl: `http://127.0.0.1:${info.httpPort}`,
        });
      }
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Daemon exited early (${code}). stderr=${stderr}`));
    });
  });
}

describe("Phase 1.1: Cloud provider removal & local-only providers", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1-1-"));
  let daemon: DaemonHandle | null = null;

  before(async () => {
    assert.ok(fs.existsSync(HOST_EXE), `Compiled host missing at ${HOST_EXE}`);
    daemon = await startHarnessDaemon(path.join(tmpRoot, "data-mock"), ["--provider", "mock"]);
  });

  after(() => {
    if (daemon) {
      try { daemon.proc.kill(); } catch {}
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("cloud provider source files and env-var key reads are removed", () => {
    const deletedFiles = [
      "tools/native/harness/CloudProviders.cs",
      "src/components/jan/sections/CloudProvidersCard.tsx",
      "tests/cloud_providers_harness.test.ts",
      "core/ai/cloud/adapters.ts",
      "core/ai/cloud/credentials.ts",
      "core/ai/cloud/egress_broker.ts",
    ];
    for (const rel of deletedFiles) {
      assert.equal(fs.existsSync(path.join(ROOT, rel)), false, `${rel} must be deleted`);
    }

    const forbiddenPatterns = [
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "OPENROUTER_API_KEY",
      "cloud_provider_config",
      "CloudProviderStore",
      "isCloudModelId",
    ];
    const scanDirs = ["tools/native", "src", "core", "contracts"];
    const violations: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "__pycache__") continue;
          walk(full);
        } else if (/\.(cs|ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, "utf-8");
          for (const pat of forbiddenPatterns) {
            if (content.includes(pat)) {
              violations.push(`${path.relative(ROOT, full)} contains ${pat}`);
            }
          }
        }
      }
    };
    for (const d of scanDirs) walk(path.join(ROOT, d));
    assert.deepEqual(violations, [], `Found leftover cloud provider symbols:\n${violations.join("\n")}`);
  });

  test("/v1/hello advertises local_only and /v1/providers returns 404", async () => {
    const headers = { Authorization: `Bearer ${daemon!.token}` };
    const helloRes = await fetch(`${daemon!.baseUrl}/v1/hello`, { headers });
    assert.equal(helloRes.status, 200);
    const hello = await helloRes.json();
    assert.ok(Array.isArray(hello.capabilities));
    assert.ok(hello.capabilities.includes("local_only"));
    assert.equal(hello.capabilities.includes("cloud_providers"), false);

    const provGet = await fetch(`${daemon!.baseUrl}/v1/providers`, { headers });
    assert.equal(provGet.status, 404);

    const provPost = await fetch(`${daemon!.baseUrl}/v1/providers/openai`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-test-1234567890" }),
    });
    assert.equal(provPost.status, 404);
  });

  test("CLI rejects cloud --provider and non-loopback openai-local --base-url", () => {
    const cloudRes = spawnSync(
      HOST_EXE,
      ["--harness", "--data-dir", path.join(tmpRoot, "data-cloud"), "--provider", "anthropic"],
      { encoding: "utf-8", timeout: 8000 }
    );
    assert.notEqual(cloudRes.status, 0, "Cloud provider must be rejected");
    assert.match(cloudRes.stderr + cloudRes.stdout, /Unsupported provider|local-only/i);

    const remoteRes = spawnSync(
      HOST_EXE,
      [
        "--harness",
        "--data-dir",
        path.join(tmpRoot, "data-remote-oai"),
        "--provider",
        "openai-local",
        "--base-url",
        "https://api.openai.com/v1",
      ],
      { encoding: "utf-8", timeout: 8000 }
    );
    assert.notEqual(remoteRes.status, 0, "Non-loopback openai-local baseUrl must be rejected");
  });

  test("LocalOpenAiCompatibleProvider streams from loopback llama.cpp/LM Studio server", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/v1/chat/completions" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Hello from " } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "local llama.cpp!" } }] })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address() as { port: number };
    const localOai = await startHarnessDaemon(path.join(tmpRoot, "data-local-oai"), [
      "--provider",
      "openai-local",
      "--base-url",
      `http://127.0.0.1:${addr.port}/v1`,
    ]);

    try {
      const headers = {
        Authorization: `Bearer ${localOai.token}`,
        "Content-Type": "application/json",
      };
      const createRes = await fetch(`${localOai.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Local OAI", model: "local-gguf" }),
      });
      assert.equal(createRes.status, 201);
      const sess = await createRes.json();

      const msgRes = await fetch(`${localOai.baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Say hello", idempotencyKey: "oai-1" }),
      });
      assert.equal(msgRes.status, 202);

      // Poll until run finishes
      let reply = "";
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const getRes = await fetch(`${localOai.baseUrl}/v1/sessions/${sess.sessionId}`, { headers });
        const data = await getRes.json();
        const finished = data.events.find((e: any) => e.type === "run_finished");
        if (finished) {
          const msg = data.events.find((e: any) => e.type === "assistant_message");
          reply = msg?.payload?.content || "";
          break;
        }
      }
      assert.equal(reply, "Hello from local llama.cpp!");
    } finally {
      try { localOai.proc.kill(); } catch {}
      server.close();
    }
  });
});
