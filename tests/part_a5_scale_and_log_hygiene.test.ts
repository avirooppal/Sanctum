import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
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
        resolve({ proc, baseUrl: `http://127.0.0.1:${info.httpPort}`, token: info.token });
      }
    });
    proc.stderr!.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Daemon exited (${code}): ${stderr}`)); });
  });
}

describe("Part A5: 20-workspace / 1000-session scale benchmark & log-ID hygiene", () => {
  test("Switches across 20 workspaces / 1000 sessions in < 150ms and keeps workspace paths out of audit logs", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-a5-scale-"));
    const dataDir = path.join(tmpBase, "appdata");
    const sessionsDir = path.join(dataDir, "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });

    const { proc, baseUrl, token } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      // 1. Create 20 workspaces
      const wsIds: string[] = [];
      const wsPaths: string[] = [];
      for (let i = 0; i < 20; i++) {
        const p = path.join(tmpBase, `secret_proj_folder_${i}`);
        fs.mkdirSync(p, { recursive: true });
        wsPaths.push(p);
        const r = await fetch(`${baseUrl}/v1/workspaces`, {
          method: "POST",
          headers: hdr,
          body: JSON.stringify({ name: `WS-${i}`, rootPath: p }),
        });
        assert.equal(r.status, 201);
        const created = await r.json() as { id: string };
        wsIds.push(created.id);
      }

      // 2. Create 1,000 real hash-chained sessions (50 per workspace) via POST /v1/sessions
      for (let i = 0; i < 20; i++) {
        const batch: Promise<Response>[] = [];
        for (let j = 0; j < 50; j++) {
          batch.push(
            fetch(`${baseUrl}/v1/sessions`, {
              method: "POST",
              headers: hdr,
              body: JSON.stringify({
                title: `Scale Session ${i}-${j}`,
                workspaceId: wsIds[i],
                model: "mock",
              }),
            })
          );
          if (batch.length >= 25) {
            const resps = await Promise.all(batch.splice(0, batch.length));
            for (const r of resps) assert.equal(r.status, 201);
          }
        }
        if (batch.length > 0) {
          const resps = await Promise.all(batch);
          for (const r of resps) assert.equal(r.status, 201);
        }
      }

      // Warm the summary cache once (simulates running desktop app)
      const warmRes = await fetch(`${baseUrl}/v1/sessions?workspaceId=${wsIds[0]}`, { headers: hdr });
      const warmData = await warmRes.json() as { sessions: any[] };
      assert.equal(warmData.sessions.length, 50);

      // 3. Measure 10 workspace switches (sessions list + ui-state fetch)
      const latenciesMs: number[] = [];
      for (let k = 0; k < 10; k++) {
        const targetId = wsIds[(k * 2) % wsIds.length];
        const t0 = performance.now();
        const [sRes, uRes] = await Promise.all([
          fetch(`${baseUrl}/v1/sessions?workspaceId=${targetId}`, { headers: hdr }),
          fetch(`${baseUrl}/v1/workspaces/${targetId}/ui-state`, { headers: hdr }),
        ]);
        const sData = await sRes.json() as { sessions: any[] };
        await uRes.json();
        const elapsed = performance.now() - t0;
        latenciesMs.push(Math.round(elapsed * 100) / 100);
        assert.equal(sData.sessions.length, 50);
      }

      const sorted = [...latenciesMs].sort((a, b) => a - b);
      const medianMs = sorted[Math.floor(sorted.length / 2)];
      const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      console.log(JSON.stringify({ scaleBench: { workspaces: 20, sessions: 1000, medianSwitchMs: medianMs, p95SwitchMs: p95Ms, samplesMs: latenciesMs } }));
      assert.ok(medianMs < 150, `Median workspace switch (${medianMs}ms) exceeded 150ms budget`);
      assert.ok(p95Ms < 150, `p95 workspace switch (${p95Ms}ms) exceeded 150ms budget`);

      // 4. Log-ID hygiene: audit.jsonl must not contain raw workspace folder paths
      const auditFile = path.join(dataDir, "audit.jsonl");
      if (fs.existsSync(auditFile)) {
        const auditText = fs.readFileSync(auditFile, "utf-8");
        assert.ok(!auditText.includes("secret_proj_folder_"), "Raw workspace path leaked into audit.jsonl");
      }
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
