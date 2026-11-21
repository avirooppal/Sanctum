import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

interface DaemonHandle {
  proc: ChildProcess;
  pid: number;
  httpPort: number;
  pipeName: string;
  token: string;
  dataDir: string;
  baseUrl: string;
}

async function startHarnessDaemon(dataDir: string): Promise<DaemonHandle> {
  fs.mkdirSync(dataDir, { recursive: true });
  const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const readyLine = await new Promise<string>((resolve, reject) => {
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Daemon startup timeout. stderr=${stderr}`)), 10000);
    proc.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        resolve(buf.slice(0, nl).trim());
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

  const info = JSON.parse(readyLine);
  return {
    proc,
    pid: info.pid,
    httpPort: info.httpPort,
    pipeName: info.pipeName,
    token: info.token,
    dataDir,
    baseUrl: `http://127.0.0.1:${info.httpPort}`,
  };
}

async function api(
  daemon: DaemonHandle,
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${daemon.token}`,
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders || {}),
  };
  const res = await fetch(`${daemon.baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function collectSseUntil(
  daemon: DaemonHandle,
  sessionId: string,
  afterSeq: number,
  predicate: (evt: any, all: any[]) => boolean,
  timeoutMs = 10000
): Promise<{ events: any[]; firstEventMs: number }> {
  const t0 = performance.now();
  let firstEventMs = -1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: any[] = [];

  try {
    const res = await fetch(`${daemon.baseUrl}/v1/sessions/${sessionId}/events?after=${afterSeq}`, {
      headers: { Authorization: `Bearer ${daemon.token}` },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        const evt = JSON.parse(payload);
        if (firstEventMs < 0) firstEventMs = performance.now() - t0;
        events.push(evt);
        if (predicate(evt, events)) {
          controller.abort();
          return { events, firstEventMs };
        }
      }
    }
  } catch (err: any) {
    if (!controller.signal.aborted) throw err;
  } finally {
    clearTimeout(timer);
  }
  return { events, firstEventMs };
}

describe("Phase 1a — Headless Agent Harness Core Skeleton", () => {
  let daemon: DaemonHandle;
  let tempDir: string;

  before(async () => {
    assert.ok(fs.existsSync(HOST_EXE), `Compiled host missing at ${HOST_EXE}. Run tools/compile_desktop_host.py first.`);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1a-"));
    daemon = await startHarnessDaemon(tempDir);
  });

  after(() => {
    try { daemon?.proc.kill(); } catch {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test("1. Handshake (/v1/hello), auth (401), foreign Origin defense (403), and high-risk full_auto rejection over HTTP (403)", async () => {
    const hello = await api(daemon, "GET", "/v1/hello");
    assert.equal(hello.status, 200);
    assert.equal(hello.json.protocolVersion, 1);
    assert.ok(hello.json.capabilities.includes("sse"));
    assert.ok(hello.json.transports.includes("pipe"));

    // Missing Bearer token -> 401
    const unauth = await fetch(`${daemon.baseUrl}/v1/hello`);
    assert.equal(unauth.status, 401);

    // Foreign Origin -> 403 (DNS rebinding / CSRF defense)
    const badOrigin = await api(daemon, "GET", "/v1/hello", undefined, { Origin: "https://evil.example" });
    assert.equal(badOrigin.status, 403);

    // Switching autonomy to full_auto over HTTP bearer must fail closed with 403
    const s = await api(daemon, "POST", "/v1/sessions", { title: "Trust Test" });
    assert.equal(s.status, 201);
    const fullAuto = await api(daemon, "POST", `/v1/sessions/${s.json.sessionId}/autonomy`, { autonomy: "full_auto" });
    assert.equal(fullAuto.status, 403);
    assert.equal(fullAuto.json.code, "trusted_channel_required");
  });

  test("2. Golden-transcript ([MOCK:TOOL]), secrets redaction, and performance budgets", async () => {
    const tCreate0 = performance.now();
    const created = await api(daemon, "POST", "/v1/sessions", { title: "Golden Tool Run", workspace: tempDir });
    const createMs = performance.now() - tCreate0;
    assert.equal(created.status, 201);
    assert.ok(createMs < 100, `Session create budget exceeded: ${createMs.toFixed(1)}ms >= 100ms`);

    const sid = created.json.sessionId;
    const ssePromise = collectSseUntil(daemon, sid, 0, (e) => e.type === "run_finished");
    const sent = await api(daemon, "POST", `/v1/sessions/${sid}/messages`, {
      content: "[MOCK:TOOL] my secret is sk-1234567890abcdefghijklmnop",
      idempotencyKey: "golden-1",
    });
    assert.equal(sent.status, 202);

    const { events, firstEventMs } = await ssePromise;
    assert.ok(firstEventMs >= 0 && firstEventMs < 50, `First SSE event budget exceeded: ${firstEventMs.toFixed(1)}ms`);

    const types = events.map((e) => e.type);
    for (const expected of [
      "session_started",
      "user_message",
      "run_started",
      "reasoning_delta",
      "tool_call_requested",
      "tool_started",
      "tool_finished",
      "message_delta",
      "assistant_message",
      "run_finished",
    ]) {
      assert.ok(types.includes(expected), `Missing event type ${expected} in ${JSON.stringify(types)}`);
    }

    const finished = events.find((e) => e.type === "run_finished");
    assert.equal(finished.payload.stopReason, "completed");

    // Verify secret redaction in JSONL log on disk
    const logPath = path.join(tempDir, "sessions", `${sid}.jsonl`);
    const rawLog = fs.readFileSync(logPath, "utf-8");
    assert.ok(!rawLog.includes("sk-1234567890abcdefghijklmnop"), "Raw API secret leaked to session log!");
    assert.ok(rawLog.includes("[REDACTED_SECRET]"), "Expected [REDACTED_SECRET] marker in log");
  });

  test("3. Budgets (max_steps), loop detection, cancellation (interrupt), and large-output blob offloading", async () => {
    // Loop detection
    const sLoop = await api(daemon, "POST", "/v1/sessions", { title: "Loop" });
    const pLoop = collectSseUntil(daemon, sLoop.json.sessionId, 0, (e) => e.type === "run_finished");
    await api(daemon, "POST", `/v1/sessions/${sLoop.json.sessionId}/messages`, { content: "[MOCK:LOOP]" });
    const rLoop = await pLoop;
    assert.equal(rLoop.events.find((e) => e.type === "run_finished").payload.stopReason, "loop_detected");

    // Max steps budget
    const sSteps = await api(daemon, "POST", "/v1/sessions", { title: "MaxSteps" });
    const pSteps = collectSseUntil(daemon, sSteps.json.sessionId, 0, (e) => e.type === "run_finished");
    await api(daemon, "POST", `/v1/sessions/${sSteps.json.sessionId}/messages`, {
      content: "[MOCK:MAX_STEPS]",
      budgets: { maxSteps: 2 },
    });
    const rSteps = await pSteps;
    assert.equal(rSteps.events.find((e) => e.type === "run_finished").payload.stopReason, "max_steps");

    // Real cancellation via /interrupt
    const sCancel = await api(daemon, "POST", "/v1/sessions", { title: "Cancel" });
    const pCancel = collectSseUntil(daemon, sCancel.json.sessionId, 0, (e) => e.type === "run_finished");
    await api(daemon, "POST", `/v1/sessions/${sCancel.json.sessionId}/messages`, { content: "[MOCK:SLOW]" });
    await new Promise((r) => setTimeout(r, 150));
    const intr = await api(daemon, "POST", `/v1/sessions/${sCancel.json.sessionId}/interrupt`, { idempotencyKey: "intr-1" });
    assert.equal(intr.status, 200);
    assert.equal(intr.json.interrupted, true);
    const rCancel = await pCancel;
    assert.equal(rCancel.events.find((e) => e.type === "run_finished").payload.stopReason, "interrupted");

    // Large tool output -> blob offload
    const sBlob = await api(daemon, "POST", "/v1/sessions", { title: "Blob" });
    const pBlob = collectSseUntil(daemon, sBlob.json.sessionId, 0, (e) => e.type === "run_finished");
    await api(daemon, "POST", `/v1/sessions/${sBlob.json.sessionId}/messages`, { content: "[MOCK:BIG_BLOB]" });
    const rBlob = await pBlob;
    const toolFin = rBlob.events.find((e) => e.type === "tool_finished");
    const blobRef = toolFin.payload.output.blobRef;
    assert.ok(typeof blobRef === "string" && blobRef.length === 64, "Expected 64-hex blobRef");
    const blobResp = await api(daemon, "GET", `/v1/blobs/${blobRef}`);
    assert.equal(blobResp.status, 200);
    assert.equal(blobResp.json.content.length, 24576);
  });

  test("4. Two concurrent clients, single-writer 409 Conflict, idempotency deduplication, and reference-based fork", async () => {
    const s = await api(daemon, "POST", "/v1/sessions", { title: "MultiClient" });
    const sid = s.json.sessionId;

    const c1 = collectSseUntil(daemon, sid, 0, (e) => e.type === "run_finished");
    const c2 = collectSseUntil(daemon, sid, 0, (e) => e.type === "run_finished");

    const r1 = await api(daemon, "POST", `/v1/sessions/${sid}/messages`, {
      content: "[MOCK:SLOW]",
      idempotencyKey: "idem-key-1",
    });
    assert.equal(r1.status, 202);

    // Same idempotency key returns identical runId without 409
    const r1Dup = await api(daemon, "POST", `/v1/sessions/${sid}/messages`, {
      content: "[MOCK:SLOW]",
      idempotencyKey: "idem-key-1",
    });
    assert.equal(r1Dup.status, 202);
    assert.equal(r1Dup.json.runId, r1.json.runId);

    // Different message while active -> 409 Conflict (single writer)
    const rConflict = await api(daemon, "POST", `/v1/sessions/${sid}/messages`, {
      content: "second concurrent write",
      idempotencyKey: "idem-key-2",
    });
    assert.equal(rConflict.status, 409);
    assert.equal(rConflict.json.code, "run_in_progress");

    await api(daemon, "POST", `/v1/sessions/${sid}/interrupt`, {});
    const [res1, res2] = await Promise.all([c1, c2]);
    assert.equal(
      res1.events.find((e) => e.type === "run_finished").seq,
      res2.events.find((e) => e.type === "run_finished").seq
    );

    // Reference-based fork at seq 2
    const forked = await api(daemon, "POST", `/v1/sessions/${sid}/fork`, { forkAfterSeq: 2, title: "Forked Child" });
    assert.equal(forked.status, 201);
    assert.equal(forked.json.parentSessionId, sid);
    assert.equal(forked.json.forkAfterSeq, 2);
    const childLog = fs.readFileSync(path.join(tempDir, "sessions", `${forked.json.sessionId}.jsonl`), "utf-8").trim().split("\n");
    assert.equal(childLog.length, 1, "Reference-based fork must not copy parent lines into child file");
    const childSnap = await api(daemon, "GET", `/v1/sessions/${forked.json.sessionId}`);
    assert.equal(childSnap.status, 200);
    assert.ok(childSnap.json.events.length >= 3, "Child replay must include parent prefix + child session_started");
  });

  test("5. Protocol decoder fuzzing never crashes daemon", async () => {
    const malformedPayloads = [
      "{not-json",
      "{\"content\":",
      "[1,2,3]",
      "null",
      "{\"content\":\"\\uD800\"}",
      "{\"nested\":" + "{\"a\":".repeat(64) + "1" + "}".repeat(64) + "}",
    ];
    for (const payload of malformedPayloads) {
      const r = await api(daemon, "POST", "/v1/sessions", payload);
      assert.ok(r.status >= 400 && r.status < 500 || r.status === 201, `Unexpected status ${r.status}`);
    }
    const stillAlive = await api(daemon, "GET", "/v1/hello");
    assert.equal(stillAlive.status, 200);
  });

  test("6. CLI end-to-end over Named Pipe (run --json, sessions, resume) + mid-run kill crash recovery", async () => {
    const rtCheck = fs.readFileSync(path.join(tempDir, "runtime.json"), "utf-8");
    const cliRun = spawnSync(
      HOST_EXE,
      ["run", "[MOCK:TOOL]", "--data-dir", tempDir, "--mode", "plan", "--json"],
      { encoding: "utf-8", timeout: 10000 }
    );
    assert.equal(cliRun.status, 0, `CLI run failed (daemonExit=${daemon.proc.exitCode}, rt=${rtCheck}): ${cliRun.stderr}`);
    const cliEvents = cliRun.stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    assert.ok(cliEvents.some((e) => e.type === "run_finished" && e.payload.stopReason === "completed"));
    const cliSessionId = cliEvents[0].sessionId;

    // CLI sessions list
    const cliSessions = spawnSync(HOST_EXE, ["sessions", "--data-dir", tempDir, "--json"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    assert.equal(cliSessions.status, 0);
    assert.ok(JSON.parse(cliSessions.stdout).sessions.some((s: any) => s.sessionId === cliSessionId));

    // Mid-run hard kill + torn trailing JSONL line -> crash recovery test
    const crashDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1a-crash-"));
    try {
      const d1 = await startHarnessDaemon(crashDir);
      const s = await api(d1, "POST", "/v1/sessions", { title: "Crash Victim" });
      const sid = s.json.sessionId;
      await api(d1, "POST", `/v1/sessions/${sid}/messages`, { content: "[MOCK:SLOW]" });
      await new Promise((r) => setTimeout(r, 150));
      d1.proc.kill("SIGKILL");
      await new Promise((r) => setTimeout(r, 250));

      // Inject a torn/corrupt partial line at end of session log
      const logFile = path.join(crashDir, "sessions", `${sid}.jsonl`);
      fs.appendFileSync(logFile, "{\"v\":1,\"seq\":999,\"corrupt_partial", "utf-8");

      // Restart daemon on same dataDir -> must quarantine corrupt line & mark unclosed run interrupted
      const d2 = await startHarnessDaemon(crashDir);
      try {
        const snap = await api(d2, "GET", `/v1/sessions/${sid}`);
        assert.equal(snap.status, 200);
        const lastEvt = snap.json.events[snap.json.events.length - 1];
        assert.equal(lastEvt.type, "run_finished");
        assert.equal(lastEvt.payload.stopReason, "interrupted");
        assert.equal(lastEvt.payload.recoveredAfterCrash, true);

        const backups = fs.readdirSync(path.join(crashDir, "sessions")).filter((f) => f.includes(".corrupt."));
        assert.ok(backups.length >= 1, "Expected corrupt trailing line backup file");
      } finally {
        d2.proc.kill();
      }
    } finally {
      try { fs.rmSync(crashDir, { recursive: true, force: true }); } catch {}
    }
  });
});
