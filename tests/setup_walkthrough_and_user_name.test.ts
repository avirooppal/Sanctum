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
      reject(new Error(`Daemon startup timeout: ${stderr}`));
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
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Daemon exited early (${code}): ${stderr}`));
    });
  });
}

async function waitForAssistantReply(baseUrl: string, token: string, sessionId: string, timeoutMs = 8000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json() as { events?: Array<{ type: string; payload?: { content?: string } }> };
      const assistant = (data.events || []).filter((e) => e.type === "assistant_message").pop();
      if (assistant?.payload?.content) return assistant.payload.content;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error("Timed out waiting for assistant_message");
}

describe("First-time setup walkthrough & user name profile understanding", () => {
  test("SetupScreen includes feature walkthrough, user name input, and zero stale cloud placeholders", () => {
    const setupSrc = fs.readFileSync(path.join(ROOT, "src", "components", "jan", "SetupScreen.tsx"), "utf-8");
    const chatSrc = fs.readFileSync(path.join(ROOT, "src", "components", "screens", "ChatScreen.tsx"), "utf-8");

    assert.match(setupSrc, /data-testid="setup-feature-walkthrough"/);
    assert.match(setupSrc, /data-testid="setup-user-name-input"/);
    assert.match(setupSrc, /What should Sanctum call you\?/);
    assert.match(setupSrc, /What Sanctum Can Do/);
    assert.match(setupSrc, /100% Local & Private/);
    assert.match(setupSrc, /Coding Agent & Rewind/);
    assert.match(setupSrc, /Document Vault \(RAG\) & OCR/);
    assert.match(setupSrc, /Local Voice Dictation/);
    assert.match(setupSrc, /Memory with Provenance/);
    assert.match(setupSrc, /Adaptive Tiers & Benchmarks/);
    assert.match(setupSrc, /"user\.name": cleanName/);
    assert.match(setupSrc, /\/v1\/memory/);
    assert.doesNotMatch(setupSrc, /gpt-4o|placeholder="sk-\.\.\."/);
    assert.match(chatSrc, /What would you like to explore, \$\{userName\}\?/);
  });

  test("Host injects saved user.name from settings.json into LLM system context", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-username-settings-"));
    fs.writeFileSync(path.join(tmpDir, "settings.json"), JSON.stringify({ "user.name": "Aviroop" }), "utf-8");
    const { proc, baseUrl, token } = await startDaemon(tmpDir);
    try {
      const sessRes = await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "mock", title: "Profile Test" }),
      });
      assert.equal(sessRes.status, 201);
      const sess = await sessRes.json() as { sessionId?: string; id?: string };
      const sid = sess.sessionId || sess.id || "";
      assert.ok(sid);

      const msgRes = await fetch(`${baseUrl}/v1/sessions/${sid}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "[MOCK:WHOAMI]" }),
      });
      assert.ok(msgRes.ok, `Expected 2xx for message post, got ${msgRes.status}`);

      const reply = await waitForAssistantReply(baseUrl, token, sid);
      assert.match(reply, /The user's name is Aviroop\./);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("Host falls back to pinned user profile memory when settings.json has no user.name", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-username-mem-"));
    const { proc, baseUrl, token } = await startDaemon(tmpDir);
    try {
      const memRes = await fetch(`${baseUrl}/v1/memory`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "User's name is Maya.",
          category: "profile",
          provenance: "user",
          pinned: true,
        }),
      });
      assert.equal(memRes.status, 201);

      const sessRes = await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "mock", title: "Memory Profile Test" }),
      });
      assert.equal(sessRes.status, 201);
      const sess = await sessRes.json() as { sessionId?: string; id?: string };
      const sid = sess.sessionId || sess.id || "";
      assert.ok(sid);

      await fetch(`${baseUrl}/v1/sessions/${sid}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "[MOCK:WHOAMI]" }),
      });

      const reply = await waitForAssistantReply(baseUrl, token, sid);
      assert.match(reply, /The user's name is Maya\./);
    } finally {
      try { proc.kill(); } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
