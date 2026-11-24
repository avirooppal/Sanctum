import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 1.3: Host-level EgressHttpFactory & static network scan", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p1-3-"));

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("static scan: zero direct HttpClient/WebRequest/WebClient/Process-with-URL outside EgressHttpFactory.cs", () => {
    const nativeDir = path.join(ROOT, "tools", "native");
    const violations: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".cs")) continue;
        const rel = path.relative(ROOT, full).replace(/\\/g, "/");
        if (rel === "tools/native/harness/EgressHttpFactory.cs") continue;

        const lines = fs.readFileSync(full, "utf-8").split(/\r?\n/);
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("///") || trimmed.startsWith("*")) return;

          if (/\bWebRequest\.Create\b/.test(line)) {
            violations.push(`${rel}:${idx + 1}: direct WebRequest.Create outside EgressHttpFactory`);
          }
          if (/\bnew\s+HttpClient\b/.test(line) || /\bnew\s+WebClient\b/.test(line)) {
            violations.push(`${rel}:${idx + 1}: direct HttpClient/WebClient outside EgressHttpFactory`);
          }
          if (/Process\.Start\([^)]*https?:\/\//i.test(line)) {
            violations.push(`${rel}:${idx + 1}: Process.Start with URL`);
          }
        });
      }
    };

    walk(nativeDir);
    assert.deepEqual(violations, [], `Direct network calls found outside EgressHttpFactory:\n${violations.join("\n")}`);
  });

  test("allowlist policy: loopback always allowed; unknown hosts, disabled features, and Offline mode blocked & logged", () => {
    const dataDir = path.join(tmpRoot, "appdata");
    fs.mkdirSync(dataDir, { recursive: true });

    const evalEgress = (url: string, feature: string, envExtra: Record<string, string> = {}) => {
      const res = spawnSync(
        HOST_EXE,
        ["--eval-egress", url, feature, "--data-dir", dataDir],
        { encoding: "utf-8", env: { ...process.env, ...envExtra }, timeout: 8000 }
      );
      const out = (res.stdout || "").trim();
      return { status: res.status, json: out ? JSON.parse(out) : null };
    };

    // 1. Loopback always allowed even in Offline mode
    const lb = evalEgress("http://127.0.0.1:11434/api/chat", "Loopback", { SANCTUM_OFFLINE_MODE: "1" });
    assert.equal(lb.status, 0);
    assert.equal(lb.json.allowed, true);

    // 2. Non-loopback on Loopback feature is blocked
    const nonLb = evalEgress("https://api.openai.com/v1/chat/completions", "Loopback");
    assert.notEqual(nonLb.status, 0);
    assert.equal(nonLb.json.allowed, false);

    // 3. ModelDownload allows huggingface.co, blocks arbitrary host
    const hfOk = evalEgress("https://huggingface.co/api/models/test?token=secret123", "ModelDownload");
    assert.equal(hfOk.status, 0);
    assert.equal(hfOk.json.allowed, true);
    assert.equal(hfOk.json.url.includes("secret123"), false, "query string must be redacted");

    const evilDl = evalEgress("https://evil.example.com/payload.bin", "ModelDownload");
    assert.notEqual(evilDl.status, 0);
    assert.equal(evilDl.json.allowed, false);

    // 4. BrowserAgent & WebFetch are off by default
    const brBlocked = evalEgress("https://example.com/", "BrowserAgent");
    assert.notEqual(brBlocked.status, 0);
    assert.equal(brBlocked.json.allowed, false);

    const wfBlocked = evalEgress("https://example.com/", "WebFetch");
    assert.notEqual(wfBlocked.status, 0);
    assert.equal(wfBlocked.json.allowed, false);

    // 5. Offline mode blocks even Hugging Face and ManualUpdate
    const hfOffline = evalEgress("https://huggingface.co/api/models/test", "ModelDownload", { SANCTUM_OFFLINE_MODE: "1" });
    assert.notEqual(hfOffline.status, 0);
    assert.equal(hfOffline.json.allowed, false);

    const updOffline = evalEgress("https://api.github.com/repos/avirooppal/Sanctum/releases", "ManualUpdate", { SANCTUM_OFFLINE_MODE: "1" });
    assert.notEqual(updOffline.status, 0);
    assert.equal(updOffline.json.allowed, false);

    // 6. Egress ledger recorded blocked + allowed non-loopback entries without query strings
    const ledgerPath = path.join(dataDir, "egress_ledger.jsonl");
    assert.ok(fs.existsSync(ledgerPath), "egress_ledger.jsonl must be written");
    const ledgerRaw = fs.readFileSync(ledgerPath, "utf-8");
    assert.equal(ledgerRaw.includes("secret123"), false, "query string must never appear in ledger");
    assert.equal(ledgerRaw.includes("127.0.0.1"), false, "loopback traffic must not clutter non-loopback egress ledger");
    const entries = ledgerRaw.trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.ok(entries.length >= 6);
    assert.ok(entries.some((e) => e.host === "evil.example.com" && e.status === "blocked"));
    assert.ok(entries.some((e) => e.host === "huggingface.co" && e.status === "allowed"));
  });
});
