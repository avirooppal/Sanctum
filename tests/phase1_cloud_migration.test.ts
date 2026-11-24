import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
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

function startHarnessDaemon(dataDir: string): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, "--provider", "mock"], {
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

describe("Phase 1.2: Cloud-removal migration & secret scrubbing", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1-2-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) {
      try { p.kill(); } catch {}
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("wipes cloud_providers.json, strips cloud model IDs preserving history, scrubs sk-* patterns, and emits one-time notice", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const sessionsDir = path.join(dataDir, "sessions");
    const logsDir = path.join(dataDir, "logs");
    const exportsDir = path.join(dataDir, "exports");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    fs.mkdirSync(exportsDir, { recursive: true });

    // Seed cloud_providers.json
    const cloudProvidersPath = path.join(dataDir, "cloud_providers.json");
    fs.writeFileSync(
      cloudProvidersPath,
      JSON.stringify({
        openai: { apiKey: "sk-proj-secretOpenAIKey99999999", enabled: true },
        anthropic: { apiKey: "sk-ant-api03-secretAnthropicKey8888", enabled: true },
      }),
      "utf-8"
    );

    // Seed threads.json with cloud model + leaked sk- pattern in history
    const threadsPath = path.join(dataDir, "threads.json");
    fs.writeFileSync(
      threadsPath,
      JSON.stringify([
        {
          id: "thread_cloud_1",
          title: "Cloud Thread Preserved",
          modelId: "openai:gpt-4o",
          messages: [
            { role: "user", content: "My old key was sk-live-1234567890abcdef please remember" },
            { role: "assistant", content: "Important answer preserved." },
          ],
        },
      ]),
      "utf-8"
    );

    // Seed existing harness session JSONL with anthropic:* model and sk-* secret
    const sessionPath = path.join(sessionsDir, "s_cloud_hist.jsonl");
    const ev1 = {
      v: 1,
      seq: 1,
      ts: "2026-01-01T00:00:00Z",
      sessionId: "s_cloud_hist",
      type: "session_started",
      payload: {
        title: "Anthropic Session",
        workspace: "",
        mode: "build",
        autonomy: "auto_reads",
        model: "anthropic:claude-sonnet-4-20250514",
      },
      sha256: "deadbeef",
    };
    const ev2 = {
      v: 1,
      seq: 2,
      ts: "2026-01-01T00:00:01Z",
      sessionId: "s_cloud_hist",
      type: "user_message",
      payload: {
        role: "user",
        content: "Use key sk-or-v1-abcdef1234567890 for test",
      },
      sha256: "deadbeef2",
    };
    fs.writeFileSync(sessionPath, JSON.stringify(ev1) + "\n" + JSON.stringify(ev2) + "\n", "utf-8");

    // Seed log and export files with sk- keys
    const logPath = path.join(logsDir, "app.jsonl");
    fs.writeFileSync(logPath, JSON.stringify({ msg: "Header Bearer sk-test-abcdef9876543210" }) + "\n", "utf-8");
    const exportPath = path.join(exportsDir, "old_export.json");
    fs.writeFileSync(exportPath, JSON.stringify({ note: "token sk-ant-abcdef1234567890" }), "utf-8");

    // Start harness daemon (triggers migration on startup)
    const daemon = await startHarnessDaemon(dataDir);
    procs.push(daemon.proc);

    // 1. cloud_providers.json must be deleted
    assert.equal(fs.existsSync(cloudProvidersPath), false, "cloud_providers.json must be deleted");

    // 2. threads.json preserves history, falls back to local model, and has zero sk- patterns
    const migratedThreadsRaw = fs.readFileSync(threadsPath, "utf-8");
    assert.equal(/sk-[A-Za-z0-9_-]{8,}/.test(migratedThreadsRaw), false, "threads.json must not contain sk- patterns");
    const migratedThreads = JSON.parse(migratedThreadsRaw);
    assert.equal(migratedThreads.length, 1);
    assert.equal(migratedThreads[0].modelId.startsWith("openai:"), false, "cloud model ID must be replaced");
    assert.equal(migratedThreads[0].messages.length, 2, "thread history must be preserved");
    assert.equal(migratedThreads[0].messages[1].content, "Important answer preserved.");

    // 3. Session JSONL preserves history, has local model, passes hash-chain verification, zero sk- patterns
    const migratedSessionRaw = fs.readFileSync(sessionPath, "utf-8");
    assert.equal(/sk-[A-Za-z0-9_-]{8,}/.test(migratedSessionRaw), false, "session jsonl must not contain sk- patterns");
    const headers = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };
    const sessRes = await fetch(`${daemon.baseUrl}/v1/sessions/s_cloud_hist`, { headers });
    assert.equal(sessRes.status, 200);
    const sessData = await sessRes.json();
    assert.equal(sessData.session.model.startsWith("anthropic:"), false);
    assert.equal(sessData.events.length, 2, "session events preserved");

    // 4. Logs and exports have zero sk- patterns
    assert.equal(/sk-[A-Za-z0-9_-]{8,}/.test(fs.readFileSync(logPath, "utf-8")), false, "logs must not contain sk- patterns");
    assert.equal(/sk-[A-Za-z0-9_-]{8,}/.test(fs.readFileSync(exportPath, "utf-8")), false, "exports must not contain sk- patterns");

    // 5. One-time notice is present and dismissible
    const noticeRes = await fetch(`${daemon.baseUrl}/v1/migration/notices`, { headers });
    assert.equal(noticeRes.status, 200);
    const noticeBody = await noticeRes.json();
    assert.ok(noticeBody.notices.some((n: any) => n.id === "cloud_providers_removed"), "one-time migration notice must be emitted");

    const dismissRes = await fetch(`${daemon.baseUrl}/v1/migration/notices/dismiss`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "cloud_providers_removed" }),
    });
    assert.equal(dismissRes.status, 200);

    const noticeResAfter = await fetch(`${daemon.baseUrl}/v1/migration/notices`, { headers });
    const noticeBodyAfter = await noticeResAfter.json();
    assert.equal(noticeBodyAfter.notices.length, 0, "dismissed notice must not reappear");
  });
});
