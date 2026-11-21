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
  pid: number;
  httpPort: number;
  pipeName: string;
  token: string;
  stop: () => Promise<void>;
}

async function startHarnessDaemon(dataDir: string): Promise<DaemonHandle> {
  const proc = spawn(EXE, ["--harness", "--data-dir", dataDir], { stdio: ["ignore", "pipe", "pipe"] });
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
    pid: ready.pid,
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

test("Phase 5.1: reversible migration backup + export / erase-all / import round-trip covering sessions and blobs", async () => {
  const dataDir = makeTempDir("sanctum-p5-mig-");
  const legacyThreads = {
    version: 1,
    threads: [
      {
        id: "legacy-1",
        title: "Imported Thread",
        model: "qwen3:1.7b",
        messages: [
          { role: "user", content: "Hello legacy" },
          { role: "assistant", content: "Hi from legacy" },
        ],
      },
    ],
  };
  const legacyRaw = JSON.stringify(legacyThreads, null, 2);
  fs.writeFileSync(path.join(dataDir, "threads.json"), legacyRaw, "utf8");

  const daemon = await startHarnessDaemon(dataDir);
  try {
    // 1. Reversible migration: backup matches original threads.json byte-for-byte
    const backupsDir = path.join(dataDir, "backups");
    const backups = fs.readdirSync(backupsDir).filter((f) => f.startsWith("threads-") && f.endsWith(".json"));
    assert.ok(backups.length >= 1, "Backup file must be created on migration");
    assert.equal(fs.readFileSync(path.join(backupsDir, backups[0]), "utf8"), legacyRaw);

    // 2. Create a session that generates a large blob (>16 KiB)
    const created = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/sessions", {
      title: "Export Blob Test",
      workspace: dataDir,
      mode: "build",
      autonomy: "auto_reads",
      model: "mock",
    });
    const sid = created.json.sessionId;
    await apiJson(daemon.httpPort, daemon.token, "POST", `/v1/sessions/${sid}/messages`, {
      content: "[MOCK:BIG_BLOB]",
      idempotencyKey: "big1",
    });
    await new Promise((r) => setTimeout(r, 400));

    // 3. Export bundle (sessions + blobs)
    const exp = await apiJson(daemon.httpPort, daemon.token, "GET", "/v1/export");
    assert.equal(exp.status, 200);
    assert.equal(exp.json.format, "sanctum-harness-archive-v1");
    assert.ok(Object.keys(exp.json.sessions).length >= 2);
    const blobKeys = Object.keys(exp.json.blobs);
    assert.ok(blobKeys.length >= 1, "Export must include offloaded blobs");

    // 4. Erase-all without confirmation is rejected (403); with confirmation wipes sessions + blobs
    const badErase = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/erase-all", {});
    assert.equal(badErase.status, 403);

    const erased = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/erase-all", { confirm: "ERASE_ALL_DATA" });
    assert.equal(erased.status, 200);
    assert.equal(erased.json.erased, true);

    const afterErase = await apiJson(daemon.httpPort, daemon.token, "GET", "/v1/sessions");
    assert.equal(afterErase.json.sessions.length, 0, "All sessions must be erased");

    // 5. Import bundle restores sessions and blobs intact
    const imp = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/import", exp.json);
    assert.equal(imp.status, 200);
    assert.ok(imp.json.importedSessions >= 2);
    assert.ok(imp.json.importedBlobs >= 1);

    const blobCheck = await apiJson(daemon.httpPort, daemon.token, "GET", `/v1/blobs/${blobKeys[0]}`);
    assert.equal(blobCheck.status, 200);
    assert.ok(blobCheck.json.content.length >= 16384);
  } finally {
    await daemon.stop();
  }
});

test("Phase 5.2: localStorage no longer persists chatSessions or agentRuns; final performance budgets met", async () => {
  // 1. Static verification of useAppStore.ts partialize
  const storeSrc = fs.readFileSync(path.resolve("src/store/useAppStore.ts"), "utf8");
  const partializeBlock = storeSrc.slice(storeSrc.indexOf("partialize:"), storeSrc.indexOf("onRehydrateStorage:"));
  assert.ok(!partializeBlock.includes("chatSessions:"), "localStorage partialize must not persist chatSessions");
  assert.ok(!partializeBlock.includes("agentRuns:"), "localStorage partialize must not persist agentRuns");

  // 2. Final footprint & latency benchmarks
  const exeBytes = fs.statSync(EXE).size;
  const dataDir = makeTempDir("sanctum-p5-bench-");
  const daemon = await startHarnessDaemon(dataDir);
  try {
    // Warm up CLR HTTP pipeline with /v1/hello handshake before timing steady-state session creation
    await apiJson(daemon.httpPort, daemon.token, "GET", "/v1/hello");

    const t0 = performance.now();
    const created = await apiJson(daemon.httpPort, daemon.token, "POST", "/v1/sessions", {
      title: "Bench",
      workspace: dataDir,
      mode: "build",
      autonomy: "auto_reads",
      model: "mock",
    });
    const sessionCreateMs = performance.now() - t0;
    const sid = created.json.sessionId;

    const t1 = performance.now();
    const sseRes = await fetch(`http://127.0.0.1:${daemon.httpPort}/v1/sessions/${sid}/events?after=0`, {
      headers: { Authorization: `Bearer ${daemon.token}` },
    });
    const reader = sseRes.body!.getReader();
    await reader.read();
    const firstSseMs = performance.now() - t1;
    await reader.cancel();

    let rssMb = 0;
    try {
      const psOut = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `(Get-Process -Id ${daemon.pid}).WorkingSet64`],
        { encoding: "utf8" }
      ).trim();
      rssMb = Number(psOut) / (1024 * 1024);
    } catch {}

    console.log(
      `[PHASE5_BENCH] exeBytes=${exeBytes} idleRssMb=${rssMb.toFixed(1)} sessionCreateMs=${sessionCreateMs.toFixed(1)} firstSseMs=${firstSseMs.toFixed(1)}`
    );
    assert.ok(exeBytes < 1024 * 1024, `Desktop host exe should remain < 1 MB (got ${exeBytes})`);
    assert.ok(rssMb < 80, `Idle RSS budget exceeded: ${rssMb.toFixed(1)} MB`);
    assert.ok(sessionCreateMs < 150, `Session create latency exceeded: ${sessionCreateMs.toFixed(1)} ms`);
    assert.ok(firstSseMs < 100, `First SSE event latency exceeded: ${firstSseMs.toFixed(1)} ms`);
  } finally {
    await daemon.stop();
  }
});
