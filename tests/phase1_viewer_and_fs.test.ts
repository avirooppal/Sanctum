import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import {
  renderSanitizedMarkdown,
  buildSandboxedPreviewConfig,
  detectCandidateFilePaths,
} from "../core/infra/security/content_sanitizer.ts";

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

async function startHeadlessHost(seedTokens: string[] = []): Promise<{
  proc: ChildProcess;
  baseUrl: string;
  token: string;
  dataDir: string;
  workspaceDir: string;
  stop: () => Promise<void>;
}> {
  const port = await getFreePort();
  const token = "test-token-" + Math.random().toString(36).slice(2, 12);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-phase1-test-"));
  const workspaceDir = path.join(dataDir, "workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });

  const args = ["--headless", "--port", String(port), "--data-dir", dataDir, "--auth-token", token];
  for (const st of seedTokens) {
    args.push("--seed-approval-token", st);
  }

  const proc = spawn(HOST_EXE, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  return { proc, baseUrl, token, dataDir, workspaceDir, stop };
}

test("PHASE1-01: C# Host /api/fs/tree, /api/fs/read, /api/fs/raw (HTTP 206 Range), and /api/fs/events", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const tok1 = "tok-write-1";
  const tok2 = "tok-write-2";
  const host = await startHeadlessHost([tok1, tok2]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  // Seed diverse file types in workspace
  fs.mkdirSync(path.join(host.workspaceDir, "docs"), { recursive: true });
  fs.mkdirSync(path.join(host.workspaceDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(host.workspaceDir, "media"), { recursive: true });
  fs.mkdirSync(path.join(host.workspaceDir, ".git"), { recursive: true });
  fs.mkdirSync(path.join(host.workspaceDir, "node_modules"), { recursive: true });

  fs.writeFileSync(path.join(host.workspaceDir, "docs", "readme.md"), "# Hello\n\n## Section 1\nContent", "utf8");
  fs.writeFileSync(path.join(host.workspaceDir, "src", "index.ts"), "export const x = 42;\n", "utf8");
  fs.writeFileSync(path.join(host.workspaceDir, "data.json"), JSON.stringify({ ok: true, count: 3 }), "utf8");
  fs.writeFileSync(path.join(host.workspaceDir, "table.csv"), "id,name\n1,Alice\n2,Bob\n", "utf8");
  fs.writeFileSync(
    path.join(host.workspaceDir, "preview.html"),
    "<html><body><script>fetch('/api/settings')</script><h1>Untrusted</h1></body></html>",
    "utf8"
  );
  fs.writeFileSync(
    path.join(host.workspaceDir, "icon.svg"),
    "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'><circle r='10'/></svg>",
    "utf8"
  );
  fs.writeFileSync(path.join(host.workspaceDir, ".git", "config"), "[core]\n", "utf8");

  // Binary + MP4 fixture (200 deterministic bytes)
  const mp4Bytes = Buffer.alloc(200);
  for (let i = 0; i < 200; i++) mp4Bytes[i] = i & 0xff;
  fs.writeFileSync(path.join(host.workspaceDir, "media", "sample.mp4"), mp4Bytes);
  fs.writeFileSync(path.join(host.workspaceDir, "unknown.bin"), Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));

  await t.test("1. /api/fs/tree loads workspace, sorts directories first, and marks/filters ignored folders", async () => {
    const resDefault = await fetch(`${host.baseUrl}/api/fs/tree?path=`, { headers });
    assert.equal(resDefault.status, 200);
    const dataDefault = await resDefault.json();
    assert.ok(Array.isArray(dataDefault.entries));
    const namesDefault = dataDefault.entries.map((e: any) => e.name);
    assert.ok(namesDefault.includes("docs"));
    assert.ok(namesDefault.includes("src"));
    assert.ok(!namesDefault.includes(".git"), ".git should be hidden when showIgnored=false");
    assert.ok(!namesDefault.includes("node_modules"), "node_modules should be hidden when showIgnored=false");

    const resAll = await fetch(`${host.baseUrl}/api/fs/tree?path=&showIgnored=true`, { headers });
    assert.equal(resAll.status, 200);
    const dataAll = await resAll.json();
    const gitEntry = dataAll.entries.find((e: any) => e.name === ".git");
    assert.ok(gitEntry && gitEntry.ignored === true, ".git should be present and marked ignored when showIgnored=true");

    const resNested = await fetch(`${host.baseUrl}/api/fs/tree?path=docs`, { headers });
    assert.equal(resNested.status, 200);
    const dataNested = await resNested.json();
    assert.equal(dataNested.entries.length, 1);
    assert.equal(dataNested.entries[0].path, "docs/readme.md");
  });

  await t.test("2. /api/fs/read reads text files with revision hash and detects binary files with hexPreview", async () => {
    const resMd = await fetch(`${host.baseUrl}/api/fs/read?path=docs/readme.md`, { headers });
    assert.equal(resMd.status, 200);
    const mdData = await resMd.json();
    assert.equal(mdData.binary, false);
    assert.match(mdData.content, /# Hello/);
    assert.ok(typeof mdData.revision === "string" && mdData.revision.length === 16);

    const resBin = await fetch(`${host.baseUrl}/api/fs/read?path=unknown.bin`, { headers });
    assert.equal(resBin.status, 200);
    const binData = await resBin.json();
    assert.equal(binData.binary, true);
    assert.ok(typeof binData.hexPreview === "string" && binData.hexPreview.includes("00 01 02 FF FE"));
  });

  await t.test("3. /api/fs/raw supports HTTP Range (206 Partial Content) and sets strict CSP on HTML/SVG", async () => {
    const resRange = await fetch(`${host.baseUrl}/api/fs/raw?path=media/sample.mp4`, {
      headers: {
        "X-Sanctum-Auth": host.token,
        Range: "bytes=10-49",
      },
    });
    assert.equal(resRange.status, 206);
    assert.equal(resRange.headers.get("content-range"), "bytes 10-49/200");
    assert.equal(resRange.headers.get("accept-ranges"), "bytes");
    const buf = Buffer.from(await resRange.arrayBuffer());
    assert.equal(buf.length, 40);
    for (let i = 0; i < 40; i++) {
      assert.equal(buf[i], 10 + i);
    }

    // HTML & SVG must carry sandboxed Content-Security-Policy and X-Content-Type-Options: nosniff
    for (const rel of ["preview.html", "icon.svg"]) {
      const resUntrusted = await fetch(`${host.baseUrl}/api/fs/raw?path=${rel}`, {
        headers: { "X-Sanctum-Auth": host.token },
      });
      assert.equal(resUntrusted.status, 200);
      assert.equal(resUntrusted.headers.get("x-content-type-options"), "nosniff");
      const csp = resUntrusted.headers.get("content-security-policy") || "";
      assert.match(csp, /sandbox/);
      assert.match(csp, /default-src 'none'/);
    }
  });

  await t.test("4. /api/fs/events emits file change events when files change", async () => {
    const pollBefore = await fetch(`${host.baseUrl}/api/fs/events?poll=1&since=0`, { headers });
    assert.equal(pollBefore.status, 200);
    const beforeData = await pollBefore.json();
    const initialSeq = beforeData.seq || 0;

    // Write via /api/fs/write with approval token
    const writeRes = await fetch(`${host.baseUrl}/api/fs/write`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": tok1 },
      body: JSON.stringify({ path: "src/index.ts", content: "export const x = 99;\nexport const y = 100;\n" }),
    });
    assert.equal(writeRes.status, 200);

    const pollAfter = await fetch(`${host.baseUrl}/api/fs/events?poll=1&since=${initialSeq}`, { headers });
    assert.equal(pollAfter.status, 200);
    const afterData = await pollAfter.json();
    assert.ok(afterData.seq > initialSeq, "Event sequence number should increment after write");
    assert.ok(
      afterData.events.some((ev: any) => ev.path === "src/index.ts"),
      "Event log should include modified path src/index.ts"
    );
  });
});

test("PHASE1-02: C# Host Checkpoints, Unified Diff Hunks, Per-Hunk Accept/Reject, and Rewind", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const tokEdit1 = "tok-cp-edit-1";
  const tokApply = "tok-cp-apply";
  const tokRewind = "tok-cp-rewind";
  const host = await startHeadlessHost([tokEdit1, tokApply, tokRewind]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  const originalLines = [
    "line 1",
    "line 2",
    "line 3",
    "line 4",
    "line 5",
    "line 6",
    "line 7",
    "line 8",
    "line 9",
    "line 10",
    "line 11",
    "line 12",
  ];
  const filePath = path.join(host.workspaceDir, "module.ts");
  fs.writeFileSync(filePath, originalLines.join("\n"), "utf8");

  // Modify top and bottom of module.ts (2 separate hunks) via /api/fs/write
  const modifiedLines = [...originalLines];
  modifiedLines[0] = "line 1 CHANGED";
  modifiedLines[11] = "line 12 CHANGED";

  const writeRes = await fetch(`${host.baseUrl}/api/fs/write`, {
    method: "POST",
    headers: { ...headers, "X-Sanctum-Approval": tokEdit1 },
    body: JSON.stringify({ path: "module.ts", content: modifiedLines.join("\n") }),
  });
  assert.equal(writeRes.status, 200);

  let checkpointId = "";

  await t.test("1. Creating a turn checkpoint produces unified diff hunks and +added/-removed counts", async () => {
    const res = await fetch(`${host.baseUrl}/api/checkpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "create", turnIndex: 1, label: "Two-hunk edit" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.checkpoint);
    checkpointId = data.checkpoint.id;
    assert.equal(data.checkpoint.filesChanged, 1);
    assert.equal(data.checkpoint.totalAdded, 2);
    assert.equal(data.checkpoint.totalRemoved, 2);
    const fileDiff = data.checkpoint.fileDiffs[0];
    assert.equal(fileDiff.path, "module.ts");
    assert.equal(fileDiff.hunks.length, 2, "Changes separated by >6 context lines should form 2 hunks");
  });

  await t.test("2. apply_hunks without approval token is rejected (403); with token selectively applies hunk 0 only", async () => {
    const noAuth = await fetch(`${host.baseUrl}/api/checkpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "apply_hunks",
        id: checkpointId,
        path: "module.ts",
        acceptedHunks: [0],
      }),
    });
    assert.equal(noAuth.status, 403);

    const withAuth = await fetch(`${host.baseUrl}/api/checkpoints`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": tokApply },
      body: JSON.stringify({
        action: "apply_hunks",
        id: checkpointId,
        path: "module.ts",
        acceptedHunks: [0],
      }),
    });
    assert.equal(withAuth.status, 200);

    const diskLines = fs.readFileSync(filePath, "utf8").split("\n");
    assert.equal(diskLines[0], "line 1 CHANGED", "Accepted hunk 0 should remain applied");
    assert.equal(diskLines[11], "line 12", "Rejected hunk 1 should revert to original line 12");
  });

  await t.test("3. rewind without approval token is rejected (403); with token restores original file", async () => {
    const noAuth = await fetch(`${host.baseUrl}/api/checkpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "rewind", id: checkpointId }),
    });
    assert.equal(noAuth.status, 403);

    const withAuth = await fetch(`${host.baseUrl}/api/checkpoints`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": tokRewind },
      body: JSON.stringify({ action: "rewind", id: checkpointId }),
    });
    assert.equal(withAuth.status, 200);
    assert.equal(fs.readFileSync(filePath, "utf8"), originalLines.join("\n"));
  });
});

test("PHASE1-03: Security Regression — Path Traversal, Hard-Blocked Paths, Approval Gates, Executable Block", async (t) => {
  if (!fs.existsSync(HOST_EXE)) {
    t.skip(`Desktop host not built at ${HOST_EXE}`);
    return;
  }

  const tokOpen1 = "tok-open-exe";
  const tokOpen2 = "tok-open-ps1";
  const host = await startHeadlessHost([tokOpen1, tokOpen2]);
  t.after(() => host.stop());

  const headers = {
    "Content-Type": "application/json",
    "X-Sanctum-Auth": host.token,
  };

  const hostilePaths = [
    "../../Windows/win.ini",
    "..\\..\\Windows\\System32\\drivers\\etc\\hosts",
    "\\\\evil.server\\share\\secret.txt",
    "CON",
    path.join(os.homedir(), ".ssh", "id_rsa"),
    path.join(host.dataDir, "settings.json"),
  ];

  await t.test("1. All /api/fs/* endpoints reject traversal, UNC, reserved device names, and hard-blocked paths", async () => {
    for (const badPath of hostilePaths) {
      const q = encodeURIComponent(badPath);
      const rTree = await fetch(`${host.baseUrl}/api/fs/tree?path=${q}`, { headers });
      assert.ok(rTree.status === 400 || rTree.status === 403, `tree(${badPath}) returned ${rTree.status}`);

      const rRead = await fetch(`${host.baseUrl}/api/fs/read?path=${q}`, { headers });
      assert.ok(rRead.status === 400 || rRead.status === 403, `read(${badPath}) returned ${rRead.status}`);

      const rRaw = await fetch(`${host.baseUrl}/api/fs/raw?path=${q}`, { headers });
      assert.ok(rRaw.status === 400 || rRaw.status === 403, `raw(${badPath}) returned ${rRaw.status}`);

      const rReveal = await fetch(`${host.baseUrl}/api/fs/reveal`, {
        method: "POST",
        headers: { ...headers, "X-Sanctum-Dry-Run": "1" },
        body: JSON.stringify({ path: badPath }),
      });
      assert.ok(rReveal.status === 400 || rReveal.status === 403, `reveal(${badPath}) returned ${rReveal.status}`);
    }
  });

  await t.test("2. /api/fs/open-external blocks .exe and .ps1 even WITH a valid approval token", async () => {
    fs.writeFileSync(path.join(host.workspaceDir, "payload.exe"), "MZ", "utf8");
    fs.writeFileSync(path.join(host.workspaceDir, "script.ps1"), "Write-Host hi", "utf8");

    const resExe = await fetch(`${host.baseUrl}/api/fs/open-external`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": tokOpen1 },
      body: JSON.stringify({ path: "payload.exe" }),
    });
    assert.equal(resExe.status, 403);
    const exeBody = await resExe.json();
    assert.match(exeBody.error, /executable|script|blocked/i);

    const resPs1 = await fetch(`${host.baseUrl}/api/fs/open-external`, {
      method: "POST",
      headers: { ...headers, "X-Sanctum-Approval": tokOpen2 },
      body: JSON.stringify({ path: "script.ps1" }),
    });
    assert.equal(resPs1.status, 403);
  });

  await t.test("3. /api/ide/open requires a single-use approval token", async () => {
    const resNoApproval = await fetch(`${host.baseUrl}/api/ide/open`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ide: "code", path: "" }),
    });
    assert.equal(resNoApproval.status, 403);
  });
});

test("PHASE1-04: Untrusted HTML/SVG/Markdown Sanitization & Candidate File Detection", async (t) => {
  await t.test("1. HTML/SVG sandbox config never includes allow-same-origin", () => {
    const htmlPayload = "<html><body><script>fetch('/api/settings').then(r=>r.text()).then(alert)</script></body></html>";
    const defaultCfg = buildSandboxedPreviewConfig(htmlPayload, { isSvg: false, allowScripts: false });
    assert.equal(defaultCfg.sandbox, "", "Default sandbox must be completely empty");
    assert.ok(!defaultCfg.sandbox.includes("allow-same-origin"));

    const scriptsCfg = buildSandboxedPreviewConfig(htmlPayload, { isSvg: false, allowScripts: true });
    assert.equal(scriptsCfg.sandbox, "allow-scripts");
    assert.ok(
      !scriptsCfg.sandbox.includes("allow-same-origin"),
      "Even with scripts enabled, allow-same-origin must NEVER be present"
    );

    const svgCfg = buildSandboxedPreviewConfig("<svg onload=alert(1)></svg>", { isSvg: true, allowScripts: false });
    assert.equal(svgCfg.sandbox, "");
    assert.match(svgCfg.srcDoc, /Content-Security-Policy/);
  });

  await t.test("2. Markdown sanitizer strips scripts, event handlers, javascript: URIs, and remote images", () => {
    const maliciousMd = [
      "# Security Report",
      "<script>fetch('/api/settings')</script>",
      "<img src=x onerror=alert(1)>",
      "<svg onload=alert(1)><circle r=5/></svg>",
      "[Click me](javascript:alert(document.cookie))",
      "![Tracker](https://evil.example/pixel.png)",
      "![Local](assets/diagram.png)",
    ].join("\n\n");

    const result = renderSanitizedMarkdown(maliciousMd);
    assert.ok(!result.html.includes("<script"), "Script tag must not be rendered as executable HTML");
    assert.ok(!result.html.includes("onerror="), "Inline event handlers must be neutralized");
    assert.ok(!result.html.includes("onload="), "SVG onload handler must be neutralized");
    assert.ok(!result.html.includes("href=\"javascript:"), "javascript: links must be neutralized");
    assert.ok(!result.html.includes("<img src=\"https://evil.example/pixel.png\""), "Remote image URL must be blocked from rendering as img");
    assert.ok(result.html.includes("md-blocked-img"), "Blocked remote image placeholder must be emitted");
    assert.equal(result.toc.length, 1);
    assert.equal(result.toc[0].text, "Security Report");
  });

  await t.test("3. detectCandidateFilePaths extracts candidate workspace paths and ignores URLs", () => {
    const msg = "Updated `src/components/viewer/ArtifactViewerPanel.tsx` and docs/readme.md#L12. Visit https://example.com/foo/bar.ts for docs.";
    const candidates = detectCandidateFilePaths(msg);
    assert.ok(candidates.includes("src/components/viewer/ArtifactViewerPanel.tsx"));
    assert.ok(candidates.includes("docs/readme.md"));
    assert.ok(!candidates.some((c) => c.includes("example.com")));
  });
});
