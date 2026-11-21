import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

interface DaemonHandle {
  proc: ChildProcess;
  httpPort: number;
  pipeName: string;
  token: string;
  baseUrl: string;
}

async function startDaemon(dataDir: string): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const readyLine = await new Promise<string>((resolve, reject) => {
    let buf = "";
    let err = "";
    const t = setTimeout(() => reject(new Error(`Timeout: ${err}`)), 10000);
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
      reject(new Error(`Exited ${code}: ${err}`));
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

describe("Phase 1c — Reversible threads.json Migration, Window-Close Survival & Cross-Client Reattach", () => {
  test("1. First-run migration backs up legacy threads.json, imports into JSONL sessions, and is idempotent", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1c-mig-"));
    const legacyThreads = [
      {
        id: "chat-legacy-1",
        title: "Old Architecture Chat",
        modelId: "qwen3:1.7b",
        messages: [
          { id: "m1", role: "user", content: "Explain Sanctum harness" },
          { id: "m2", role: "assistant", content: "The harness owns all agent state." },
        ],
      },
      {
        id: "chat-legacy-2",
        title: "Empty Thread",
        modelId: "llama3.2",
        messages: [],
      },
    ];
    fs.writeFileSync(path.join(tempDir, "threads.json"), JSON.stringify(legacyThreads, null, 2), "utf-8");

    const d1 = await startDaemon(tempDir);
    try {
      // 1. Untouched backup exists in backups/threads-*.json
      const backups = fs.readdirSync(path.join(tempDir, "backups")).filter((f) => f.startsWith("threads-"));
      assert.equal(backups.length, 1, "Expected 1 timestamped backup of threads.json");
      const backupContent = JSON.parse(fs.readFileSync(path.join(tempDir, "backups", backups[0]), "utf-8"));
      assert.deepEqual(backupContent, legacyThreads, "Backup must be an exact lossless copy");

      // 2. Sessions are readable via /v1/sessions
      const list = await api(d1, "GET", "/v1/sessions");
      assert.equal(list.status, 200);
      assert.equal(list.json.sessions.length, 2);

      const snap = await api(d1, "GET", "/v1/sessions/chat-legacy-1");
      assert.equal(snap.status, 200);
      assert.equal(snap.json.events.length, 3); // session_started + user_message + assistant_message
      assert.equal(snap.json.events[1].payload.content, "Explain Sanctum harness");
      assert.equal(snap.json.events[2].payload.content, "The harness owns all agent state.");
    } finally {
      d1.proc.kill();
    }

    // 3. Second boot must be idempotent (no duplicate backups, no duplicate sessions)
    await new Promise((r) => setTimeout(r, 200));
    const d2 = await startDaemon(tempDir);
    try {
      const backups2 = fs.readdirSync(path.join(tempDir, "backups")).filter((f) => f.startsWith("threads-"));
      assert.equal(backups2.length, 1, "Second boot must not re-run migration");
      const list2 = await api(d2, "GET", "/v1/sessions");
      assert.equal(list2.json.sessions.length, 2);
    } finally {
      d2.proc.kill();
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  test("2. Phase 1 Gate: run survives UI disconnect (window close), CLI attaches to same live session, and UI reattaches via ?after=<seq>", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1c-gate-"));
    const daemon = await startDaemon(tempDir);

    try {
      // UI client creates session & starts a slow ~2s run
      const created = await api(daemon, "POST", "/v1/sessions", { title: "Survive Close", workspace: tempDir });
      const sid = created.json.sessionId;
      const runResp = await api(daemon, "POST", `/v1/sessions/${sid}/messages`, {
        content: "[MOCK:SLOW]",
        idempotencyKey: "survive-1",
      });
      assert.equal(runResp.status, 202);

      // UI connects to SSE, receives initial events, then DISCONNECTS mid-run (simulating window close!)
      const uiCtrl = new AbortController();
      let lastSeenSeq = 0;
      try {
        const res = await fetch(`${daemon.baseUrl}/v1/sessions/${sid}/events?after=0`, {
          headers: { Authorization: `Bearer ${daemon.token}` },
          signal: uiCtrl.signal,
        });
        const rdr = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let deltaCount = 0;
        while (true) {
          const { done, value } = await rdr.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.seq > lastSeenSeq) lastSeenSeq = ev.seq;
            if (ev.type === "message_delta") {
              deltaCount++;
              if (deltaCount >= 3) {
                uiCtrl.abort(); // Simulate closing the UI window mid-run!
                break;
              }
            }
          }
        }
      } catch (e: any) {
        if (!uiCtrl.signal.aborted) throw e;
      }

      // While UI is "closed", CLI attaches to the SAME live session and waits for completion!
      const cliAttach = spawnSync(
        HOST_EXE,
        ["attach", sid, "--after", "0", "--data-dir", tempDir, "--json"],
        { encoding: "utf-8", timeout: 10000 }
      );
      assert.equal(cliAttach.status, 0, `CLI attach failed: ${cliAttach.stderr}`);
      const cliEvents = cliAttach.stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      assert.ok(
        cliEvents.some((e) => e.type === "run_finished" && e.payload.stopReason === "completed"),
        "CLI attach must observe completed run after UI disconnected"
      );

      // UI "reopens" and catches up from lastSeenSeq via ?after=<lastSeenSeq>
      const reopenCtrl = new AbortController();
      const caughtUp: any[] = [];
      try {
        const res2 = await fetch(`${daemon.baseUrl}/v1/sessions/${sid}/events?after=${lastSeenSeq}`, {
          headers: { Authorization: `Bearer ${daemon.token}` },
          signal: reopenCtrl.signal,
        });
        const rdr = res2.body!.getReader();
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
            const ev = JSON.parse(line.slice(5).trim());
            caughtUp.push(ev);
            if (ev.type === "run_finished") {
              reopenCtrl.abort();
              break;
            }
          }
        }
      } catch (e: any) {
        if (!reopenCtrl.signal.aborted) throw e;
      }

      assert.ok(caughtUp.every((e) => e.seq > lastSeenSeq), "Catch-up must only return seq > lastSeenSeq");
      assert.ok(caughtUp.some((e) => e.type === "assistant_message" && e.payload.content.includes("tok39")));
      assert.ok(caughtUp.some((e) => e.type === "run_finished" && e.payload.stopReason === "completed"));
    } finally {
      daemon.proc.kill();
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });
});
