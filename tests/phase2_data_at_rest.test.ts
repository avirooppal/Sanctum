import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string; pipeName: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, "--provider", "mock"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    let stderr = "";
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error(`Timeout: ${stderr}`)); }, 10000);
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
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exit ${code}: ${stderr}`)); });
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
        const p = JSON.parse(buf.slice(0, nl));
        resolve({ status: p.status, body: p.body });
      }
    });
    c.on("error", reject);
  });
}

describe("Phase 2.5: Data at rest (DPAPI, PBKDF2 portable archive, erase-all coverage & perf)", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p2-5-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("DPAPI & PBKDF2+AES-256-HMAC roundtrip and measured performance cost", () => {
    const res = spawnSync(HOST_EXE, ["--bench-crypto"], { encoding: "utf-8", timeout: 15000 });
    assert.equal(res.status, 0, `bench-crypto failed: ${res.stderr}`);
    const bench = JSON.parse(res.stdout.trim());
    assert.equal(bench.dpapiOk, true);
    assert.equal(bench.pbkdf2Ok, true);
    assert.ok(bench.dpapiRoundtripMs >= 0);
    assert.ok(bench.pbkdf2AesHmacRoundtripMs >= 0);
  });

  test("DPAPI encrypts memory.json on disk, passphrase export/import works, and erase-all wipes every data store", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const daemon = await startDaemon(dataDir);
    procs.push(daemon.proc);
    const headers = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };

    // 1. Enable DPAPI encryption via trusted pipe (HTTP bearer must be 403)
    const encDenied = await fetch(`${daemon.baseUrl}/v1/security/encryption`, {
      method: "POST",
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(encDenied.status, 403);

    const encOk = await sendPipe(daemon.pipeName, "POST", "/v1/security/encryption", { enabled: true });
    assert.equal(encOk.status, 200);
    assert.equal(encOk.body.enabled, true);

    // 2. Save memory -> on disk must be DPAPI-encrypted (not plaintext)
    const saveRes = await fetch(`${daemon.baseUrl}/v1/memory`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Top secret local preference 98765" }),
    });
    assert.equal(saveRes.status, 201);
    const memDisk = fs.readFileSync(path.join(dataDir, "memory.json"), "utf-8");
    assert.ok(memDisk.startsWith("SANCTUM_DPAPI_V1:"), "memory.json must be DPAPI encrypted on disk");
    assert.equal(memDisk.includes("98765"), false, "plaintext must not appear on disk when DPAPI is enabled");

    // Reading back via API decrypts cleanly
    const memRead = await (await fetch(`${daemon.baseUrl}/v1/memory`, { headers })).json();
    assert.equal(memRead.count, 1);
    assert.equal(memRead.facts[0].content, "Top secret local preference 98765");

    // 3. Create session & export encrypted portable archive with passphrase
    const sess = await (
      await fetch(`${daemon.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Encrypted Export", model: "mock" }),
      })
    ).json();
    assert.ok(sess.sessionId);

    const exp = await sendPipe(daemon.pipeName, "GET", "/v1/export", { passphrase: "my-strong-passphrase" });
    assert.equal(exp.status, 200);
    assert.equal(exp.body.encrypted, true);
    assert.ok(String(exp.body.archive).startsWith("SANCTUM_PBKDF2_V1:"));

    // Wrong passphrase on import fails
    const badImp = await fetch(`${daemon.baseUrl}/v1/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ archive: exp.body.archive, passphrase: "wrong-passphrase" }),
    });
    assert.notEqual(badImp.status, 200);

    // 4. Seed all extra data stores (checkpoints, shadow-git, vault, ledger, webview2, browser-profile) and run erase-all
    for (const d of ["checkpoints", "shadow-git", "vault", "webview2", "browser-profile"]) {
      const p = path.join(dataDir, d);
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, "dummy.dat"), "data", "utf-8");
    }
    fs.writeFileSync(path.join(dataDir, "egress_ledger.jsonl"), "{}\n", "utf-8");

    const eraseRes = await sendPipe(daemon.pipeName, "POST", "/v1/erase-all", {});
    assert.equal(eraseRes.status, 200);
    assert.equal(eraseRes.body.erased, true);

    for (const d of ["checkpoints", "shadow-git", "vault", "webview2", "browser-profile"]) {
      assert.equal(fs.existsSync(path.join(dataDir, d)), false, `${d} must be wiped by erase-all`);
    }
    assert.equal(fs.existsSync(path.join(dataDir, "memory.json")), false);
    assert.equal(fs.existsSync(path.join(dataDir, "egress_ledger.jsonl")), false);

    // Re-import from passphrase-encrypted archive succeeds
    const goodImp = await fetch(`${daemon.baseUrl}/v1/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ archive: exp.body.archive, passphrase: "my-strong-passphrase" }),
    });
    assert.equal(goodImp.status, 200);
  });
});
