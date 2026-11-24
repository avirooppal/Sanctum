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
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error("Daemon timeout")); }, 10000);
    proc.stdout!.on("data", (d: Buffer) => {
      buf += d.toString("utf-8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        const info = JSON.parse(buf.slice(0, nl).trim());
        resolve({ proc, baseUrl: `http://127.0.0.1:${info.httpPort}`, token: info.token });
      }
    });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Daemon exited (${code})`)); });
  });
}

describe("Part B5: Feed Pane agent-blindness, screenshot exclusion & docs verification", () => {
  test("No harness tool, A2UI component, or browser-agent pack can access or control the Feed Pane", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-b5-priv-"));
    const { proc, baseUrl, token } = await startDaemon(tmpDir);
    try {
      const toolsRes = await fetch(`${baseUrl}/v1/tools`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(toolsRes.status, 200);
      const data = await toolsRes.json() as { tools: Array<{ name: string; description: string }> };
      const feedTools = data.tools.filter((t) => /\bfeed\b/i.test(t.name) || /feed-profile/i.test(t.description));
      assert.equal(feedTools.length, 0, `Agent must have ZERO feed tools, found: ${JSON.stringify(feedTools)}`);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Static check across all agent tool implementations & browser-agent sidecar
    for (const rel of [
      "tools/native/harness/BuiltinTools.cs",
      "tools/native/harness/AgentOrchestration.cs",
      "tools/native/harness/A2uiService.cs",
      "tools/native/harness/WebTools.cs",
      "packs/browser-agent/sidecar.py",
    ]) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      assert.doesNotMatch(src, /FeedPaneController|feed-profile/i, `${rel} must never touch FeedPaneController or feed-profile`);
    }

    // THREATS.md, PROTOCOL.md, and manual checklist cover Feed Pane
    const threats = fs.readFileSync(path.join(ROOT, "THREATS.md"), "utf-8");
    const proto = fs.readFileSync(path.join(ROOT, "PROTOCOL.md"), "utf-8");
    const manual = fs.readFileSync(path.join(ROOT, "docs/FEED_MANUAL_CHECKLIST.md"), "utf-8");
    assert.match(threats, /Malicious Feed Content/);
    assert.match(proto, /user_input_requested/);
    assert.match(proto, /\/v1\/feed\/enable/);
    assert.match(manual, /Sign out and clear feed data/);
  });
});
