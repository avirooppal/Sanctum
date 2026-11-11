import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  readLogs,
  getRecentDiagnosticErrors,
} from "../core/infra/logs/log_reader.ts";
import { recordAuditLog, clearAuditLogs } from "../core/infra/security/audit_logger.ts";
import { SecurityPathError } from "../core/infra/security/path_resolver.ts";

test("Diagnostic Logs & Tooling Suite", async (t) => {
  const tmpRoot = path.join(os.tmpdir(), "sanctum-logs-test-" + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });

  t.after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  await t.test("1. readLogs: Tails and filters audit logs", () => {
    clearAuditLogs();

    recordAuditLog({
      tool: "git_diff",
      action: "read",
      scope: "workspace_only",
      decision: "allowed",
      reason: "Safe operation",
    });

    recordAuditLog({
      tool: "run_command",
      command: "format c:",
      action: "execute",
      scope: "workspace_only",
      decision: "denied",
      reason: "Destructive disk formatting blocked",
    });

    const res = readLogs({
      source: "audit",
      tail: 10,
    });

    assert.equal(res.source, "audit");
    assert.ok(res.matchedCount >= 2);

    // Filter by regex
    const deniedOnly = readLogs({
      source: "audit",
      regex: '"decision":"denied"',
    });

    assert.ok(deniedOnly.matchedCount >= 1);
    assert.ok(deniedOnly.lines.some((l) => l.raw.includes("Destructive disk formatting blocked")));
  });

  await t.test("2. readLogs: Reads custom workspace file logs respecting access scope", () => {
    const customLog = path.join(tmpRoot, "app.log");
    const sampleLines = [
      "[2026-11-09T10:00:00.000Z] [INFO] Server started on port 3000",
      "[2026-11-09T10:01:00.000Z] [WARN] High memory utilization 85%",
      "[2026-11-09T10:02:00.000Z] [ERROR] Database connection timed out after 5000ms",
      "[2026-11-09T10:03:00.000Z] [INFO] Reconnected to database",
    ].join("\n");

    fs.writeFileSync(customLog, sampleLines, "utf-8");

    // Read within workspace using relative path
    const res = readLogs({
      source: "file",
      path: "app.log",
      workspaceRoot: tmpRoot,
      scope: "workspace_only",
      tail: 2,
    });

    assert.equal(res.source, "file");
    assert.equal(res.matchedCount, 2);
    assert.ok(res.lines[1].raw.includes("Reconnected to database"));

    // Regex filter for ERROR
    const errorOnly = readLogs({
      source: "file",
      path: "app.log",
      workspaceRoot: tmpRoot,
      regex: "\\[ERROR\\]",
    });

    assert.equal(errorOnly.matchedCount, 1);
    assert.ok(errorOnly.lines[0].raw.includes("Database connection timed out"));
  });

  await t.test("3. readLogs: Rejects reading arbitrary files outside workspace scope", () => {
    assert.throws(
      () => {
        readLogs({
          source: "file",
          path: "../outside.log",
          workspaceRoot: tmpRoot,
          scope: "workspace_only",
        });
      },
      (err: any) => err instanceof SecurityPathError
    );
  });

  await t.test("4. readLogs: Time range filtering", () => {
    const customLog = path.join(tmpRoot, "timed.log");
    const sample = [
      "[2026-11-09T10:00:00Z] Step 1",
      "[2026-11-09T10:30:00Z] Step 2",
      "[2026-11-09T11:00:00Z] Step 3",
    ].join("\n");
    fs.writeFileSync(customLog, sample, "utf-8");

    const timeFiltered = readLogs({
      source: "file",
      path: "timed.log",
      workspaceRoot: tmpRoot,
      timeStart: "2026-11-09T10:15:00Z",
      timeEnd: "2026-11-09T10:45:00Z",
    });

    assert.equal(timeFiltered.matchedCount, 1);
    assert.ok(timeFiltered.lines[0].raw.includes("Step 2"));
  });

  await t.test("5. getRecentDiagnosticErrors: Aggregates recent error entries", () => {
    const errors = getRecentDiagnosticErrors(10);
    assert.ok(Array.isArray(errors));
  });
});
