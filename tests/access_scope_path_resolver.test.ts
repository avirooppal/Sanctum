import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  resolveScopedPath,
  isHardBlockedPath,
  SecurityPathError,
} from "../core/infra/security/path_resolver.ts";
import {
  readRecentAuditLogs,
  clearAuditLogs,
  recordAuditLog,
} from "../core/infra/security/audit_logger.ts";

test("Path Resolver & Access Scope Security Test Suite", async (t) => {
  const tmpRoot = path.join(os.tmpdir(), "sanctum-test-workspace-" + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, "safe.txt"), "hello world");

  t.after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  await t.test("1. Workspace Containment (workspace_only)", () => {
    const res = resolveScopedPath({
      rawPath: "safe.txt",
      workspaceRoot: tmpRoot,
      mode: "read",
      scope: "workspace_only",
    });
    assert.equal(res.outsideWorkspace, false);
    assert.equal(res.resolvedPath.toLowerCase(), path.join(tmpRoot, "safe.txt").toLowerCase());
  });

  await t.test("2. Rejects path traversal outside workspace under workspace_only", () => {
    assert.throws(
      () => {
        resolveScopedPath({
          rawPath: "../secret.txt",
          workspaceRoot: tmpRoot,
          mode: "read",
          scope: "workspace_only",
        });
      },
      (err: any) => err instanceof SecurityPathError && err.code === "SCOPE_VIOLATION"
    );
  });

  await t.test("3. Rejects null bytes in path", () => {
    assert.throws(
      () => {
        resolveScopedPath({
          rawPath: "safe.txt\0.exe",
          workspaceRoot: tmpRoot,
          mode: "read",
          scope: "workspace_only",
        });
      },
      (err: any) => err instanceof SecurityPathError && err.code === "NULL_BYTE_DETECTED"
    );
  });

  await t.test("4. Rejects UNC network paths", () => {
    assert.throws(
      () => {
        resolveScopedPath({
          rawPath: "\\\\remote-server\\share\\malicious.txt",
          workspaceRoot: tmpRoot,
          mode: "read",
          scope: "system_full",
        });
      },
      (err: any) => err instanceof SecurityPathError && err.code === "UNC_PATH_FORBIDDEN"
    );
  });

  await t.test("5. Rejects Windows reserved device names and invalid stems", () => {
    const invalidStems = ["CON", "prn.txt", "AUX", "NUL", "COM1", "lpt3.dat", "trailing. ", "bad."];
    for (const stem of invalidStems) {
      assert.throws(
        () => {
          resolveScopedPath({
            rawPath: stem,
            workspaceRoot: tmpRoot,
            mode: "read",
            scope: "workspace_only",
          });
        },
        (err: any) => err instanceof SecurityPathError && err.code === "INVALID_SEGMENT"
      );
    }
  });

  await t.test("6. Hard-blocked system paths are blocked unconditionally without override", () => {
    const windir = process.env.windir || "C:\\Windows";
    const sys32 = path.join(windir, "System32", "calc.exe");
    const sshKey = path.join(os.homedir(), ".ssh", "id_rsa");

    assert.equal(isHardBlockedPath(sys32).blocked, true);
    assert.equal(isHardBlockedPath(sshKey).blocked, true);

    // Even in system_full mode, hard-blocked paths must throw
    assert.throws(
      () => {
        resolveScopedPath({
          rawPath: sys32,
          workspaceRoot: tmpRoot,
          mode: "read",
          scope: "system_full",
          overrideHardBlocked: false,
        });
      },
      (err: any) => err instanceof SecurityPathError && err.code === "HARD_BLOCKED_PATH"
    );

    assert.throws(
      () => {
        resolveScopedPath({
          rawPath: sshKey,
          workspaceRoot: tmpRoot,
          mode: "read",
          scope: "system_full",
          overrideHardBlocked: false,
        });
      },
      (err: any) => err instanceof SecurityPathError && err.code === "HARD_BLOCKED_PATH"
    );
  });

  await t.test("7. Selected folders allowlist allows granted external folders and blocks others", () => {
    const allowedDir = path.join(os.tmpdir(), "sanctum-allowed-" + Date.now());
    const unallowedDir = path.join(os.tmpdir(), "sanctum-unallowed-" + Date.now());
    fs.mkdirSync(allowedDir, { recursive: true });
    fs.mkdirSync(unallowedDir, { recursive: true });

    try {
      // Allowed folder targets
      const allowedRes = resolveScopedPath({
        rawPath: path.join(allowedDir, "file.txt"),
        workspaceRoot: tmpRoot,
        mode: "read",
        scope: "selected_folders",
        allowedFolders: [allowedDir],
      });
      assert.equal(allowedRes.outsideWorkspace, true);

      // Unallowed folder targets
      assert.throws(
        () => {
          resolveScopedPath({
            rawPath: path.join(unallowedDir, "file.txt"),
            workspaceRoot: tmpRoot,
            mode: "read",
            scope: "selected_folders",
            allowedFolders: [allowedDir],
          });
        },
        (err: any) => err instanceof SecurityPathError && err.code === "NOT_IN_ALLOWLIST"
      );
    } finally {
      try {
        fs.rmSync(allowedDir, { recursive: true, force: true });
        fs.rmSync(unallowedDir, { recursive: true, force: true });
      } catch {}
    }
  });

  await t.test("8. system_read allows reading outside workspace but blocks writing", () => {
    const externalFile = path.join(os.tmpdir(), "sanctum-test-external-" + Date.now() + ".txt");
    fs.writeFileSync(externalFile, "test data");

    try {
      // Read allowed
      const readRes = resolveScopedPath({
        rawPath: externalFile,
        workspaceRoot: tmpRoot,
        mode: "read",
        scope: "system_read",
      });
      assert.equal(readRes.outsideWorkspace, true);

      // Write blocked
      assert.throws(
        () => {
          resolveScopedPath({
            rawPath: externalFile,
            workspaceRoot: tmpRoot,
            mode: "write",
            scope: "system_read",
          });
        },
        (err: any) => err instanceof SecurityPathError && err.code === "WRITE_BLOCKED_IN_READ_ONLY"
      );
    } finally {
      try {
        fs.unlinkSync(externalFile);
      } catch {}
    }
  });

  await t.test("9. Audit logger records external events and denials", () => {
    clearAuditLogs();

    recordAuditLog({
      tool: "test_tool",
      path: "C:\\test\\path.txt",
      action: "read",
      scope: "system_read",
      decision: "allowed",
      reason: "Unit test entry",
    });

    const logs = readRecentAuditLogs(10);
    assert.ok(logs.length >= 1);
    assert.equal(logs[0].tool, "test_tool");
    assert.equal(logs[0].decision, "allowed");
  });
});
