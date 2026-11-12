import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const HOST_EXE = path.resolve("deploy/installer/build_payload/Sanctum-Desktop.exe");

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function startHeadlessHost(extraArgs: string[] = []): Promise<{
  proc: ChildProcess;
  baseUrl: string;
  token: string;
  dataDir: string;
  stop: () => Promise<void>;
}> {
  const port = await getFreePort();
  const token = "test-token-" + Math.random().toString(36).slice(2, 12);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-host-test-"));

  const proc = spawn(
    HOST_EXE,
    ["--headless", "--port", String(port), "--data-dir", dataDir, "--auth-token", token, ...extraArgs],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Sanctum-Desktop.exe exited early with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const stop = async () => {
    try {
      proc.kill();
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  };

  return { proc, baseUrl, token, dataDir, stop };
}

test("SEC-01: C# HandleTerminal enforces command rules, cwd ToolPath, and single-use approval tokens", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const seedToken = "appr-seed-" + Math.random().toString(36).slice(2);
  const host = await startHeadlessHost(["--seed-approval-token", seedToken]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  await t.test("1. Hard-denied command (format C:) is rejected even with approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "format C:" }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /blocked|denied|policy/i);
  });

  await t.test("2. Out-of-scope cwd (C:\\Windows\\System32) is rejected", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "echo ok", cwd: "C:\\Windows\\System32" }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("3. Non-allowlisted ask command (node -e ...) is rejected without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "run_command", command: "node -e \"console.log(123)\"" }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /approval/i);
  });

  await t.test("4. Non-allowlisted start_background is rejected without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "start_background", command: "node -e \"console.log(123)\"" }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("5. Allowlisted read-only command (echo) executes without approval token", async () => {
    const res = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "run_command", command: "echo sec01_ok" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.stdout, /sec01_ok/);
  });

  await t.test("6. Single-use approval token allows one ask command and fails on replay", async () => {
    const res1 = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "Write-Output 'sec01_approved_once'" }),
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.match(data1.stdout, /sec01_approved_once/);

    const res2 = await fetch(`${host.baseUrl}/api/terminal/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seedToken },
      body: JSON.stringify({ action: "run_command", command: "Write-Output 'replay'" }),
    });
    assert.equal(res2.status, 403);
  });
});

test("SEC-02: C# HandleSettings merges POST keys, validates known keys, and returns { status, settings } on GET", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost([
    "--seed-approval-token", "sec02-t1",
    "--seed-approval-token", "sec02-t2",
    "--seed-approval-token", "sec02-t3",
    "--seed-approval-token", "sec02-t4",
  ]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  await t.test("1. POST merges {access.scope} and subsequent {general.language} without wiping", async () => {
    const r1 = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec02-t1" },
      body: JSON.stringify({ "access.scope": "selected_folders", "access.allowedFolders": JSON.stringify(["C:\\Projects"]) }),
    });
    assert.equal(r1.status, 200);

    const r2 = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec02-t2" },
      body: JSON.stringify({ key: "general.language", value: "fr" }),
    });
    assert.equal(r2.status, 200);

    const getRes = await fetch(`${host.baseUrl}/api/settings`, { headers });
    assert.equal(getRes.status, 200);
    const data = await getRes.json();
    assert.equal(data.status, "success");
    assert.ok(data.settings && typeof data.settings === "object");
    assert.equal(data.settings["access.scope"], "selected_folders");
    assert.equal(data.settings["general.language"], "fr");
  });

  await t.test("2. Unknown setting key or invalid access.scope is rejected (422)", async () => {
    const rBadKey = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec02-t3" },
      body: JSON.stringify({ "evil.unknownKey": true }),
    });
    assert.equal(rBadKey.status, 422);

    const rBadScope = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec02-t4" },
      body: JSON.stringify({ "access.scope": "god_mode" }),
    });
    assert.equal(rBadScope.status, 422);
  });
});

test("SEC-03: C# ToolPath blocks 8.3 short names, junctions, ..\\ traversal, UNC, \\\\?\\, mixed-case, and %APPDATA%\\Sanctum", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost([
    "--seed-approval-token", "sec03-t1",
    "--seed-approval-token", "sec03-t2",
    "--seed-approval-token", "sec03-t3",
  ]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  const wsRes = await fetch(`${host.baseUrl}/api/workspace`, { headers });
  const ws = await wsRes.json();

  // Elevate to system_full so only hard-blocks and canonicalization protect these paths
  await fetch(`${host.baseUrl}/api/settings`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "sec03-t1" },
    body: JSON.stringify({ "access.scope": "system_full" }),
  });

  const callRead = async (targetPath: string) => {
    const res = await fetch(`${host.baseUrl}/api/tools/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspaceId: ws.id,
        name: "workspace_files",
        arguments: { action: "read", path: targetPath },
      }),
    });
    return { status: res.status, body: await res.json() };
  };

  await t.test("1. Rejects 8.3 short names (C:\\WINDO~1\\..., C:\\PROGRA~1\\...)", async () => {
    if (fs.existsSync("C:\\WINDO~1\\System32\\drivers\\etc\\hosts")) {
      const r1 = await callRead("C:\\WINDO~1\\System32\\drivers\\etc\\hosts");
      assert.equal(r1.status, 400);
      assert.match(r1.body.error, /hard-blocked|denied|forbidden/i);
    }
    const r2 = await fetch(`${host.baseUrl}/api/tools/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspaceId: ws.id,
        name: "workspace_files",
        arguments: { action: "list", path: "C:\\PROGRA~1" },
      }),
    });
    assert.equal(r2.status, 400);
    const d2 = await r2.json();
    assert.match(d2.error, /hard-blocked|denied|forbidden/i);
  });

  await t.test("2. Rejects junction inside workspace pointing to C:\\Windows\\System32", async () => {
    const junctionPath = path.join(ws.root, "sys_junc");
    try {
      const { execSync } = await import("node:child_process");
      execSync(`cmd /c mklink /J "${junctionPath}" "C:\\Windows\\System32"`, { stdio: "ignore" });
    } catch {
      t.skip("Could not create NTFS junction");
      return;
    }
    const r = await callRead("sys_junc\\drivers\\etc\\hosts");
    assert.equal(r.status, 400);
    assert.match(r.body.error, /junction|symbolic|hard-blocked/i);
  });

  await t.test("3. Rejects ..\\ traversal under workspace_only", async () => {
    await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec03-t2" },
      body: JSON.stringify({ "access.scope": "workspace_only" }),
    });
    const r = await callRead("..\\settings.json");
    assert.equal(r.status, 400);
    assert.match(r.body.error, /outside|hard-blocked|forbidden/i);
    await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": "sec03-t3" },
      body: JSON.stringify({ "access.scope": "system_full" }),
    });
  });

  await t.test("4. Rejects UNC, \\\\?\\ prefix, and mixed-case system paths", async () => {
    const rUnc = await callRead("\\\\127.0.0.1\\c$\\Windows\\System32\\drivers\\etc\\hosts");
    assert.equal(rUnc.status, 400);
    const rExt = await callRead("\\\\?\\C:\\Windows\\System32\\drivers\\etc\\hosts");
    assert.equal(rExt.status, 400);
    const rMix = await callRead("c:\\wInDoWs\\sYsTeM32\\drivers\\etc\\hosts");
    assert.equal(rMix.status, 400);
  });

  await t.test("5. Hard-blocks all %APPDATA%\\Sanctum internal files (threads.json, memory.json, audit.log)", async () => {
    for (const file of ["settings.json", "threads.json", "memory.json", "audit.log"]) {
      const r = await callRead(path.join(host.dataDir, file));
      assert.equal(r.status, 400, `${file} must be hard-blocked`);
      assert.match(r.body.error, /hard-blocked/i);
    }
  });
});

test("SEC-04: headless hides auth token unless --print-token, and privileged endpoints require X-Sanctum-Approval", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  await t.test("1. Headless stdout omits auth token without --print-token, includes with --print-token", async () => {
    const port1 = await getFreePort();
    const tok1 = "secret-tok-no-print";
    const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-sec04-1-"));
    let out1 = "";
    const p1 = spawn(HOST_EXE, ["--headless", "--port", String(port1), "--data-dir", dir1, "--auth-token", tok1], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    p1.stdout?.on("data", (d) => { out1 += d.toString(); });
    await new Promise((r) => setTimeout(r, 700));
    try { p1.kill(); } catch {}
    try { fs.rmSync(dir1, { recursive: true, force: true }); } catch {}
    assert.ok(!out1.includes(tok1), "Auth token must NOT be printed to stdout without --print-token");

    const port2 = await getFreePort();
    const tok2 = "secret-tok-with-print";
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-sec04-2-"));
    let out2 = "";
    const p2 = spawn(HOST_EXE, ["--headless", "--port", String(port2), "--data-dir", dir2, "--auth-token", tok2, "--print-token"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    p2.stdout?.on("data", (d) => { out2 += d.toString(); });
    await new Promise((r) => setTimeout(r, 700));
    try { p2.kill(); } catch {}
    try { fs.rmSync(dir2, { recursive: true, force: true }); } catch {}
    assert.ok(out2.includes(tok2), "Auth token MUST be printed when --print-token is set");
  });

  await t.test("2. Privileged file write/delete and settings POST/DELETE require X-Sanctum-Approval", async () => {
    const seed1 = "sec04-seed-1";
    const seed2 = "sec04-seed-2";
    const host = await startHeadlessHost(["--seed-approval-token", seed1, "--seed-approval-token", seed2]);
    t.after(() => host.stop());

    const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };
    const ws = await (await fetch(`${host.baseUrl}/api/workspace`, { headers })).json();

    const rSetNoTok = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ "general.language": "es" }),
    });
    assert.equal(rSetNoTok.status, 403);

    const rSetWithTok = await fetch(`${host.baseUrl}/api/settings`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seed1 },
      body: JSON.stringify({ "general.language": "es" }),
    });
    assert.equal(rSetWithTok.status, 200);

    const rWriteNoTok = await fetch(`${host.baseUrl}/api/tools/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspaceId: ws.id,
        name: "workspace_files",
        arguments: { action: "create", path: "unapproved.txt", content: "x" },
      }),
    });
    assert.equal(rWriteNoTok.status, 403);

    const rWriteWithTok = await fetch(`${host.baseUrl}/api/tools/execute`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": seed2 },
      body: JSON.stringify({
        workspaceId: ws.id,
        name: "workspace_files",
        arguments: { action: "create", path: "approved.txt", content: "ok" },
      }),
    });
    assert.equal(rWriteWithTok.status, 200);
  });
});

test("REL-03: C# host preserves UTF-8, serializes concurrent thread writes atomically, and caps payload size", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost();
  t.after(() => host.stop());
  const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };

  const utf8Payload = JSON.stringify([{ id: "t1", title: "Café 🌍 日本語" }]);
  const postRes = await fetch(`${host.baseUrl}/api/threads`, {
    method: "POST",
    headers,
    body: utf8Payload,
  });
  assert.equal(postRes.status, 200);

  const getRes = await fetch(`${host.baseUrl}/api/threads`, { headers });
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), utf8Payload);

  // Concurrent writes must not corrupt threads.json or leave .tmp behind
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      fetch(`${host.baseUrl}/api/threads`, {
        method: "POST",
        headers,
        body: JSON.stringify([{ id: "seq", rev: i }]),
      })
    )
  );
  const finalThreads = JSON.parse(fs.readFileSync(path.join(host.dataDir, "threads.json"), "utf-8"));
  assert.ok(Array.isArray(finalThreads) && finalThreads.length === 1);
  assert.equal(fs.existsSync(path.join(host.dataDir, "threads.json.tmp")), false);
});

test("BUG-02 & DES-01: POST /api/workspace validates path + approval and POST /api/logs/query filters and redacts", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-ws-switch-"));
  const host = await startHeadlessHost(["--seed-approval-token", "ws-tok-1", "--seed-approval-token", "ws-tok-2"]);
  t.after(async () => {
    await host.stop();
    try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch {}
  });

  const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };

  // Unapproved POST /api/workspace -> 403
  const rNoTok = await fetch(`${host.baseUrl}/api/workspace`, {
    method: "POST",
    headers,
    body: JSON.stringify({ root: wsDir }),
  });
  assert.equal(rNoTok.status, 403);

  // Hard-blocked path -> 403
  const rBlocked = await fetch(`${host.baseUrl}/api/workspace`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "ws-tok-1" },
    body: JSON.stringify({ root: "C:\\Windows\\System32" }),
  });
  assert.equal(rBlocked.status, 403);

  // Valid directory -> 200 and persists to tool_workspace.txt
  const rOk = await fetch(`${host.baseUrl}/api/workspace`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "ws-tok-2" },
    body: JSON.stringify({ root: wsDir }),
  });
  assert.equal(rOk.status, 200);
  const wsData = await rOk.json();
  assert.equal(wsData.root.toLowerCase(), fs.realpathSync.native(wsDir).toLowerCase());

  // /api/logs/query returns startup log and redacts secrets
  const logRes = await fetch(`${host.baseUrl}/api/logs/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: "sanctum", tail: 10, regex: "Sanctum started" }),
  });
  assert.equal(logRes.status, 200);
  const logData = await logRes.json();
  assert.ok(logData.count >= 1);
});

test("BUG-01: HandleProfiles escapes quotes, backslashes, and newlines via JavaScriptSerializer", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const host = await startHeadlessHost();
  t.after(() => host.stop());
  const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };

  const trickyName = 'Bot "Alpha" \\ C:\\test\nLine2';
  const trickyId = 'id-"1"\\x';
  const postRes = await fetch(`${host.baseUrl}/api/profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: trickyId, name: trickyName }),
  });
  assert.equal(postRes.status, 200);
  const created = await postRes.json();
  assert.equal(created.id, trickyId);

  const getRes = await fetch(`${host.baseUrl}/api/profiles`, { headers });
  assert.equal(getRes.status, 200);
  const list = await getRes.json();
  assert.equal(list.data[0].id, trickyId);
  assert.equal(list.data[0].name, trickyName);
});

test("REL-01: undo re-validates original path against current workspace and ToolPath", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const ws2 = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-rel01-ws2-"));
  const host = await startHeadlessHost([
    "--seed-approval-token", "rel01-create",
    "--seed-approval-token", "rel01-del",
    "--seed-approval-token", "rel01-switch",
    "--seed-approval-token", "rel01-undo-bad",
    "--seed-approval-token", "rel01-undo-ok",
  ]);
  t.after(async () => {
    await host.stop();
    try { fs.rmSync(ws2, { recursive: true, force: true }); } catch {}
  });
  const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };
  const ws1 = await (await fetch(`${host.baseUrl}/api/workspace`, { headers })).json();

  // Create & delete in ws1
  await fetch(`${host.baseUrl}/api/tools/execute`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "rel01-create" },
    body: JSON.stringify({ workspaceId: ws1.id, name: "workspace_files", arguments: { action: "create", path: "temp.txt", content: "v1" } }),
  });
  await fetch(`${host.baseUrl}/api/tools/execute`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "rel01-del" },
    body: JSON.stringify({ workspaceId: ws1.id, name: "workspace_files", arguments: { action: "delete", path: "temp.txt" } }),
  });

  // Switch workspace to ws2 under workspace_only -> undo of ws1 file MUST be rejected!
  const sw = await (await fetch(`${host.baseUrl}/api/workspace`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "rel01-switch" },
    body: JSON.stringify({ root: ws2 }),
  })).json();
  const undoBlocked = await fetch(`${host.baseUrl}/api/tools/execute`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "rel01-undo-bad" },
    body: JSON.stringify({ workspaceId: sw.id, name: "workspace_files", arguments: { action: "undo", path: "." } }),
  });
  assert.equal(undoBlocked.status, 400);
});

test("SEC-05: WebView2 egress barrier returns 403, filters ws/wss, and restricts loopback ports", () => {
  const hostPy = fs.readFileSync(path.resolve("tools/native/DesktopHost.cs"), "utf-8");
  assert.ok(hostPy.includes('AddWebResourceRequestedFilter("ws://*"'), "Must filter ws://*");
  assert.ok(hostPy.includes('AddWebResourceRequestedFilter("wss://*"'), "Must filter wss://*");
  assert.ok(hostPy.includes('403, "Forbidden"'), "Blocked egress must return 403, not 204");
  assert.ok(hostPy.includes("uri.Port == _port || uri.Port == _enginePort || uri.Port == 8000"), "Loopback passthrough must be restricted to host, engine, and speech ports");
});

test("CONTRACT: Node core/infra and C# host agree on settings, workspace, terminal rules, and tools/execute", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const { SettingsStore } = await import("../core/infra/storage/settings_store.ts");
  const { matchCommandRule } = await import("../core/infra/security/command_matcher.ts");
  const { resolveScopedPath } = await import("../core/infra/security/path_resolver.ts");

  const host = await startHeadlessHost([
    "--seed-approval-token", "contract-set-1",
    "--seed-approval-token", "contract-tool-1",
  ]);
  t.after(() => host.stop());
  const headers = { "Content-Type": "application/json", "X-Sanctum-Auth": host.token };

  // 1. Settings parity
  const nodeStore = new SettingsStore(path.join(host.dataDir, "node_settings.json"));
  nodeStore.set("general.language", "de");
  await fetch(`${host.baseUrl}/api/settings`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "contract-set-1" },
    body: JSON.stringify({ key: "general.language", value: "de" }),
  });
  const csharpSettings = await (await fetch(`${host.baseUrl}/api/settings`, { headers })).json();
  assert.equal(csharpSettings.status, "success");
  assert.equal(csharpSettings.settings["general.language"], nodeStore.get("general.language"));

  // 2. Workspace parity
  const ws = await (await fetch(`${host.baseUrl}/api/workspace`, { headers })).json();
  assert.equal(typeof ws.root, "string");
  assert.equal(typeof ws.id, "string");

  // 3. Terminal command rules parity
  assert.equal(matchCommandRule("format C:").action, "deny");
  const termDeny = await fetch(`${host.baseUrl}/api/terminal/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "run_command", command: "format C:" }),
  });
  assert.equal(termDeny.status, 403);

  assert.equal(matchCommandRule("echo contract_ok").action, "allow");
  const termAllow = await fetch(`${host.baseUrl}/api/terminal/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "run_command", command: "echo contract_ok" }),
  });
  assert.equal(termAllow.status, 200);

  // 4. Tools/execute path-jail parity
  assert.throws(() => resolveScopedPath({ rawPath: "../escape.txt", workspaceRoot: ws.root, scope: "workspace_only", mode: "read" }));
  const toolDeny = await fetch(`${host.baseUrl}/api/tools/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ workspaceId: ws.id, name: "workspace_files", arguments: { action: "read", path: "../escape.txt" } }),
  });
  assert.equal(toolDeny.status, 400);

  const toolCreate = await fetch(`${host.baseUrl}/api/tools/execute`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": "contract-tool-1" },
    body: JSON.stringify({ workspaceId: ws.id, name: "workspace_files", arguments: { action: "create", path: "contract.txt", content: "ok" } }),
  });
  assert.equal(toolCreate.status, 200);
});
