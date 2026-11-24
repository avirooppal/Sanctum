import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string; pipeName: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
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
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exited (${code}): ${stderr}`)); });
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
      if (nl >= 0) { c.end(); resolve(JSON.parse(buf.slice(0, nl))); }
    });
    c.on("error", reject);
  });
}

describe("Part B2: FeedPane host controller, isolation policy, consent, Offline mode & host-only ledger", () => {
  test("FeedPaneController enforces strict WebView2 isolation, zero bridge, deny-all permissions & screenshot exclusion", () => {
    const src = fs.readFileSync(path.join(ROOT, "tools/native/FeedPaneController.cs"), "utf-8");
    assert.match(src, /IsWebMessageEnabled\s*=\s*false/);
    assert.match(src, /AreDevToolsEnabled\s*=\s*false/);
    assert.match(src, /AreDefaultScriptDialogsEnabled\s*=\s*false/);
    assert.match(src, /IsGeneralAutofillEnabled\s*=\s*false/);
    assert.match(src, /IsPasswordAutosaveEnabled\s*=\s*false/);
    assert.match(src, /IsReputationCheckingRequired\s*=\s*false/);
    assert.match(src, /IsInPrivateModeEnabled\s*=\s*true/);
    assert.match(src, /CoreWebView2PermissionState\.Deny/);
    assert.match(src, /DownloadStarting[\s\S]*?e\.Cancel\s*=\s*true/);
    assert.match(src, /ProcessFailed/);
    assert.match(src, /TrySuspendAsync/);
    assert.match(src, /TemporarilyHideForScreenshot/);
    assert.doesNotMatch(src, /AddHostObjectToScript|AddScriptToExecuteOnDocumentCreated|X-Sanctum-Auth|SetVirtualHostNameToFolderMapping/);
  });

  test("Consent + trusted channel gating, SSRF/loopback/private IP blocks, host-only ledger, Offline block & profile clear", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-b2-feed-"));
    const dataDir = path.join(tmpBase, "appdata");
    const { proc, baseUrl, token, pipeName } = await startDaemon(dataDir);
    const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      // 1. Off by default
      const st0 = (await (await fetch(`${baseUrl}/v1/feed/status`, { headers: hdr })).json()) as any;
      assert.equal(st0.enabled, false);
      assert.equal(st0.activePresetId, "instagram");

      // 2. Enable without consent -> 400; over HTTP bearer -> 403; via trusted pipe with consent -> 200
      const noConsent = await fetch(`${baseUrl}/v1/feed/enable`, {
        method: "POST", headers: hdr, body: JSON.stringify({ consentAccepted: false }),
      });
      assert.equal(noConsent.status, 400);

      const httpEnable = await fetch(`${baseUrl}/v1/feed/enable`, {
        method: "POST", headers: hdr, body: JSON.stringify({ consentAccepted: true }),
      });
      assert.equal(httpEnable.status, 403);

      const pipeEnable = await sendPipe(pipeName, "POST", "/v1/feed/enable", { consentAccepted: true });
      assert.equal(pipeEnable.status, 200);
      assert.equal(pipeEnable.body.enabled, true);

      // 3. Policy blocks loopback, Ollama, metadata, LAN, file://, javascript:, and non-allowlisted domains
      const blockedUrls = [
        "http://127.0.0.1:11434/api/tags",
        "http://localhost:8080/v1/sessions",
        "https://127.0.0.1:11434/api/tags",
        "https://169.254.169.254/latest/meta-data/",
        "https://192.168.1.1/admin",
        "https://10.0.0.5/internal",
        "file:///C:/Windows/win.ini",
        "javascript:alert(1)",
        "https://evil.example.com/exfil?secret=123",
      ];
      for (const u of blockedUrls) {
        const r = await fetch(`${baseUrl}/v1/feed/policy/check`, {
          method: "POST", headers: hdr, body: JSON.stringify({ url: u, skipDnsLookup: true }),
        });
        const d = await r.json() as { allowed: boolean; code: string };
        assert.equal(d.allowed, false, `Expected feed policy to block ${u}, got ${JSON.stringify(d)}`);
      }

      // 4. Allows Instagram preset hosts and records host-only ledger summary (ZERO URLs/paths!)
      const okCheck = await fetch(`${baseUrl}/v1/feed/policy/check`, {
        method: "POST",
        headers: hdr,
        body: JSON.stringify({
          url: "https://www.instagram.com/direct/inbox/?secret_token=abc",
          skipDnsLookup: true,
          recordSummary: true,
          approxBytes: 1024,
        }),
      });
      const okData = await okCheck.json() as { allowed: boolean; host: string };
      assert.equal(okData.allowed, true);
      assert.equal(okData.host, "www.instagram.com");

      const ledgerRes = await fetch(`${baseUrl}/v1/network/ledger`, { headers: hdr });
      const ledger = await ledgerRes.json() as { entries: Array<{ feature: string; host: string; url: string }> };
      const feedEntries = ledger.entries.filter((e) => e.feature === "FeedPane");
      assert.ok(feedEntries.length >= 1);
      assert.equal(feedEntries[0].host, "www.instagram.com");
      assert.equal(feedEntries[0].url, "", "Feed ledger entry must contain NO URL/path/query!");

      // 5. Custom preset/domain requires trusted channel
      const httpCustom = await fetch(`${baseUrl}/v1/feed/presets/custom`, {
        method: "POST", headers: hdr, body: JSON.stringify({ name: "MyBlog", startUrl: "https://example.org/" }),
      });
      assert.equal(httpCustom.status, 403);

      const pipeCustom = await sendPipe(pipeName, "POST", "/v1/feed/presets/custom", {
        name: "MyBlog", startUrl: "https://example.org/",
      });
      assert.equal(pipeCustom.status, 201);

      // 6. Global Offline mode blocks feed immediately
      const offRes = await fetch(`${baseUrl}/v1/network/offline`, {
        method: "POST", headers: hdr, body: JSON.stringify({ offline: true }),
      });
      assert.equal(offRes.status, 200);
      const stOff = (await (await fetch(`${baseUrl}/v1/feed/status`, { headers: hdr })).json()) as any;
      assert.equal(stOff.offlineBlocked, true);
      assert.equal(stOff.effectiveEnabled, false);

      // 7. Profile clear + erase-all remove feed-profile
      const profileDir = path.join(dataDir, "feed-profile");
      fs.mkdirSync(profileDir, { recursive: true });
      fs.writeFileSync(path.join(profileDir, "Cookies"), "fake-cookie", "utf-8");
      const clr = await fetch(`${baseUrl}/v1/feed/profile/clear`, { method: "POST", headers: hdr });
      assert.equal(clr.status, 200);
      assert.equal(fs.existsSync(profileDir), false);

      // Recreate and verify erase-all also deletes feed-profile
      fs.mkdirSync(profileDir, { recursive: true });
      const eraseRes = await fetch(`${baseUrl}/v1/erase-all`, {
        method: "POST", headers: hdr, body: JSON.stringify({ confirm: "ERASE_ALL_DATA" }),
      });
      assert.equal(eraseRes.status, 200);
      assert.equal(fs.existsSync(profileDir), false);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
