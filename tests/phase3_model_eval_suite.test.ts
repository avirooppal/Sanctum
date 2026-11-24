import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EVAL_TASKS, runEvalSuite } from "../tools/eval/model_eval_suite.mjs";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

describe("Phase 3.4: 40-task per-model eval suite & persistence", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p3-4-"));
  const procs: ChildProcess[] = [];

  after(() => {
    for (const p of procs) { try { p.kill(); } catch {} }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("eval suite contains 40 tasks across all 5 categories and records measured results to /v1/evals", async () => {
    assert.equal(EVAL_TASKS.length, 40, "Eval suite must contain at least 40 tasks");
    const categories = new Set(EVAL_TASKS.map((t) => t.category));
    for (const req of ["file_edit", "search_read", "multi_step_plan", "error_recovery", "injection_refusal"]) {
      assert.ok(categories.has(req), `Missing eval category: ${req}`);
    }

    const dataDir = path.join(tmpRoot, "appdata");
    fs.mkdirSync(dataDir, { recursive: true });
    const proc = spawn(HOST_EXE, ["--harness", "--data-dir", dataDir, "--provider", "mock"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    procs.push(proc);

    const info: any = await new Promise((resolve, reject) => {
      let buf = "";
      proc.stdout!.on("data", (d: Buffer) => {
        buf += d.toString("utf-8");
        const nl = buf.indexOf("\n");
        if (nl >= 0) resolve(JSON.parse(buf.slice(0, nl).trim()));
      });
      proc.on("exit", (code) => reject(new Error(`Exit ${code}`)));
    });

    const baseUrl = `http://127.0.0.1:${info.httpPort}`;
    const summary = await runEvalSuite({
      provider: "mock",
      model: "mock-eval-model",
      dataDir,
      baseUrl,
      token: info.token,
    });

    assert.equal(summary.totalTasks, 40);
    assert.ok(summary.passRate >= 0 && summary.passRate <= 1);
    assert.ok(summary.measuredAt);

    const evalsRes = await fetch(`${baseUrl}/v1/evals`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    assert.equal(evalsRes.status, 200);
    const stored = await evalsRes.json();
    assert.equal(stored.models["mock-eval-model"].totalTasks, 40);
    assert.equal(stored.models["mock-eval-model"].passRate, summary.passRate);
  });
});
