import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function startDaemon(dataDir: string, mockScript: string): Promise<{ proc: ChildProcess; baseUrl: string; token: string }> {
  fs.mkdirSync(dataDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock", "--mock-script", mockScript],
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
        resolve({ proc, baseUrl: `http://127.0.0.1:${info.httpPort}`, token: info.token });
      }
    });
    proc.stderr!.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Exit ${code}: ${stderr}`)); });
  });
}

describe("Phase 3b-2: Host A2UI validator, session log, text flattener & untrusted actions", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3b-2-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("valid surface persists with markdownFallback, malicious surfaces fail closed, and 'Delete all files' button never deletes anything", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, "README.md"), "# Local Repo\n", "utf-8");

    const scriptPath = path.join(tmpRoot, "mock-a2ui.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Here is the table and file card."],
            toolCalls: [
              {
                id: "tc_valid",
                name: "render_ui",
                arguments: {
                  a2uiVersion: "0.9.1",
                  surfaceId: "surf_1",
                  summaryText: "Comparison of local engines.",
                  components: [
                    { id: "t1", type: "Table", props: { columns: ["Engine", "Local"], rows: [["Ollama", "Yes"], ["llama.cpp", "Yes"]] } },
                    { id: "f_ok", type: "FileCard", props: { path: "README.md", description: "Repo readme" } },
                    { id: "f_esc", type: "FileCard", props: { path: "..\\outside.txt", description: "Escape attempt" } },
                    { id: "btn_del", type: "Button", props: { label: "Delete all files", action: "delete_all" } },
                  ],
                },
              },
              // Malicious surfaces: spoofed approval card, password field, remote image, XSS script
              {
                id: "tc_spoof",
                name: "render_ui",
                arguments: { surfaceId: "surf_spoof", components: [{ id: "a1", type: "ApprovalCard", props: { approve: true } }] },
              },
              {
                id: "tc_pw",
                name: "render_ui",
                arguments: { surfaceId: "surf_pw", components: [{ id: "p1", type: "TextField", props: { label: "Password", inputType: "password" } }] },
              },
              {
                id: "tc_img",
                name: "render_ui",
                arguments: { surfaceId: "surf_img", components: [{ id: "i1", type: "Card", props: { image: "https://tracker.evil.com/pixel.png" } }] },
              },
              {
                id: "tc_xss",
                name: "render_ui",
                arguments: { surfaceId: "surf_xss", components: [{ id: "x1", type: "Text", props: { text: "<script>alert(1)</script>" } }] },
              },
            ],
          },
          { contentDeltas: ["Done rendering."] },
        ],
      }),
      "utf-8"
    );

    const daemon = await startDaemon(dataDir, scriptPath);
    procs.push(daemon.proc);
    const headers = { Authorization: `Bearer ${daemon.token}`, "Content-Type": "application/json" };

    const sess = await (
      await fetch(`${daemon.baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "A2UI Host Test", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock" }),
      })
    ).json();

    await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Show table", idempotencyKey: "a2ui-1" }),
    });

    let events: any[] = [];
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      if (cur.events.some((e: any) => e.type === "run_finished")) {
        events = cur.events;
        break;
      }
    }

    const surfaces = events.filter((e) => e.type === "a2ui_surface");
    assert.equal(surfaces.length, 5);

    const validSurf = surfaces.find((s) => s.payload.surfaceId === "surf_1");
    assert.equal(validSurf.payload.valid, true);
    assert.equal(validSurf.payload.a2uiVersion, "0.9.1");
    assert.ok(validSurf.payload.markdownFallback.includes("| Engine | Local |"));
    assert.ok(validSurf.payload.markdownFallback.includes("[Delete all files]"));

    const fOk = validSurf.payload.surface.components.find((c: any) => c.id === "f_ok");
    const fEsc = validSurf.payload.surface.components.find((c: any) => c.id === "f_esc");
    assert.equal(fOk.props.pathValid, true, "In-scope existing FileCard must have pathValid=true");
    assert.equal(fEsc.props.pathValid, false, "Out-of-scope FileCard must have pathValid=false");

    // All 4 malicious surfaces rejected with fallbackToText=true
    for (const badId of ["surf_spoof", "surf_pw", "surf_img", "surf_xss"]) {
      const bad = surfaces.find((s) => s.payload.surfaceId === badId);
      assert.equal(bad.payload.valid, false, `${badId} must be rejected`);
      assert.equal(bad.payload.fallbackToText, true);
    }

    // Clicking "Delete all files" button emits action event ONLY — never deletes README.md
    const actRes = await fetch(`${daemon.baseUrl}/v1/sessions/${sess.sessionId}/a2ui-action`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "act-1",
        surfaceId: "surf_1",
        componentId: "btn_del",
        actionName: "delete_all",
        data: {},
      }),
    });
    assert.equal(actRes.status, 200);
    const act = await actRes.json();
    assert.equal(act.toolsExecuted, false);
    assert.equal(fs.existsSync(path.join(wsDir, "README.md")), true, "README.md must NOT be deleted by UI button action");
  });
});
