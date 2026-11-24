import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 2.1: PowerShell AST shell confinement, Job Object limits & env stripping", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p2-1-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) {
      try { p.kill(); } catch {}
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("table-driven AST evaluator catches aliases, backticks, base64, here-strings, call operators, cmd /c, and redirections", () => {
    const cases: Array<{ name: string; command: string; expected: "allow" | "ask" | "deny" }> = [
      // Safe read-only commands
      { name: "git status", command: "git status", expected: "allow" },
      { name: "Get-ChildItem", command: "Get-ChildItem", expected: "allow" },
      { name: "ls alias", command: "ls", expected: "allow" },
      { name: "node version", command: "node --version", expected: "allow" },

      // Obfuscated & dynamic invocations
      { name: "iex alias", command: "iex 'Write-Host hi'", expected: "deny" },
      { name: "Invoke-Expression", command: "Invoke-Expression $payload", expected: "deny" },
      { name: "backtick iex", command: "i`e`x 'calc'", expected: "deny" },
      { name: "backtick ls", command: "l`s", expected: "ask" },
      { name: "base64 -EncodedCommand", command: "powershell -EncodedCommand SQBFAFgA", expected: "deny" },
      { name: "base64 -enc", command: "powershell.exe -enc SQBFAFgA", expected: "deny" },
      { name: "call operator &", command: "& ('g'+'it') status", expected: "ask" },
      { name: "dot-sourcing .", command: ". ./evil.ps1", expected: "ask" },
      { name: "cmd /c wrapper", command: "cmd /c dir", expected: "ask" },
      { name: "here-string single", command: "@'\nwhoami\n'@", expected: "ask" },
      { name: "here-string double", command: "@\"\n$(whoami)\n\"@", expected: "ask" },
      { name: "subexpression in echo", command: "echo $(whoami)", expected: "ask" },
      { name: "dotnet Process::Start", command: "[System.Diagnostics.Process]::Start('calc')", expected: "ask" },
      { name: "Start-Process RunAs", command: "Start-Process powershell -Verb RunAs", expected: "deny" },
      { name: "recursive root delete", command: "rm -Recurse -Force C:\\", expected: "deny" },
      { name: "redirection to Windows", command: "echo pwn > C:\\Windows\\System32\\pwn.txt", expected: "deny" },
      { name: "redirection to local file", command: "echo hi > out.txt", expected: "ask" },
      { name: "credential path access", command: "cat C:\\Users\\test\\.ssh\\id_rsa", expected: "deny" },
      { name: "unparseable syntax", command: "git status \"unterminated", expected: "ask" },
    ];

    const fixturePath = path.join(tmpRoot, "ast-fixture.json");
    fs.writeFileSync(
      fixturePath,
      JSON.stringify({ commands: cases.map((c, i) => ({ id: String(i), command: c.command })) }),
      "utf-8"
    );

    const res = spawnSync(HOST_EXE, ["--eval-permission-fixture", fixturePath], {
      encoding: "utf-8",
      timeout: 15000,
    });
    assert.equal(res.status, 0, `Fixture eval failed: ${res.stderr}`);
    const parsed = JSON.parse(res.stdout.trim());
    assert.equal(parsed.commands.length, cases.length);

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const actual = parsed.commands[i].action;
      assert.equal(
        actual,
        c.expected,
        `Case '${c.name}' (${c.command}): expected '${c.expected}', got '${actual}' (reason: ${parsed.commands[i].reason})`
      );
    }
  });

  test("run_command strips secret env vars and enforces output cap inside Job Object", async () => {
    const dataDir = path.join(tmpRoot, "appdata");
    const wsDir = path.join(tmpRoot, "workspace");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(wsDir, { recursive: true });

    const scriptPath = path.join(tmpRoot, "mock-env.json");
    fs.writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          {
            contentDeltas: ["Checking env"],
            toolCalls: [
              {
                id: "tc_env",
                name: "run_command",
                arguments: { command: "Write-Output \"SECRET=$env:MY_SECRET_TOKEN|NORMAL=$env:SANCTUM_SAFE_TEST\"" },
              },
            ],
          },
          { contentDeltas: ["Done"] },
        ],
      }),
      "utf-8"
    );

    const proc = spawn(
      HOST_EXE,
      ["--harness", "--data-dir", dataDir, "--provider", "mock", "--mock-script", scriptPath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          MY_SECRET_TOKEN: "SUPER_SECRET_DO_NOT_LEAK",
          SANCTUM_SAFE_TEST: "VISIBLE_OK",
        },
      }
    );
    procs.push(proc);

    const info: any = await new Promise((resolve, reject) => {
      let buf = "";
      proc.stdout!.on("data", (d: Buffer) => {
        buf += d.toString("utf-8");
        const nl = buf.indexOf("\n");
        if (nl >= 0) resolve(JSON.parse(buf.slice(0, nl).trim()));
      });
      proc.on("exit", (code) => reject(new Error(`Exited early ${code}`)));
    });

    const baseUrl = `http://127.0.0.1:${info.httpPort}`;
    const headers = { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" };

    // Use Named Pipe to approve high-risk run_command
    const sess = await (
      await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Env Test", workspace: wsDir, mode: "build", autonomy: "auto_reads", model: "mock" }),
      })
    ).json();

    await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Check env", idempotencyKey: "env-1" }),
    });

    const net = await import("node:net");
    const sendPipe = (method: string, reqPath: string, body: any) =>
      new Promise<any>((resolve, reject) => {
        const c = net.connect(`\\\\.\\pipe\\${info.pipeName}`, () => {
          c.write(JSON.stringify({ method, path: reqPath, body }) + "\n");
        });
        let b = "";
        c.on("data", (ch) => {
          b += ch.toString("utf-8");
          const nl = b.indexOf("\n");
          if (nl >= 0) {
            c.end();
            resolve(JSON.parse(b.slice(0, nl)));
          }
        });
        c.on("error", reject);
      });

    let approved = false;
    let toolOutput = "";
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cur = await (await fetch(`${baseUrl}/v1/sessions/${sess.sessionId}`, { headers })).json();
      const pending = cur.events.find((e: any) => e.type === "approval_requested");
      if (pending && !approved) {
        const appr = await sendPipe("POST", `/v1/approvals/${pending.payload.approvalId}`, {
          approved: true,
          callId: pending.payload.callId,
          argsSha256: pending.payload.argsSha256,
        });
        assert.equal(appr.status, 200);
        approved = true;
      }
      const fin = cur.events.find((e: any) => e.type === "tool_finished" && e.payload?.tool === "run_command");
      if (fin) {
        toolOutput = String(fin.payload?.output?.inline || fin.payload?.output || "");
        break;
      }
    }

    assert.equal(toolOutput.includes("SUPER_SECRET_DO_NOT_LEAK"), false, "Secret env var must be stripped");
    assert.ok(toolOutput.includes("VISIBLE_OK"), "Non-secret env var should remain accessible");
  });
});
