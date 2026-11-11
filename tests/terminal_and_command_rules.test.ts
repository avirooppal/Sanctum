import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  matchCommandRule,
  type CommandRule,
} from "../core/infra/security/command_matcher.ts";
import {
  runCommand,
  startBackgroundProcess,
  readBackgroundProcessOutput,
  stopBackgroundProcess,
} from "../core/infra/security/terminal_runner.ts";

test("Terminal & Permission Rules Suite", async (t) => {
  const tmpRoot = path.join(os.tmpdir(), "sanctum-term-test-" + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });

  t.after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  await t.test("1. Command Rule Matcher: Auto-Allows Read-Only Queries", () => {
    const safeCommands = [
      "git status",
      "git diff HEAD~1",
      "git log -n 5",
      "git branch -a",
      "dir",
      "ls -la",
      "pwd",
      "echo 'test'",
      "node -v",
      "npm -v",
      "python --version",
    ];

    for (const cmd of safeCommands) {
      const match = matchCommandRule(cmd);
      assert.equal(
        match.action,
        "allow",
        `Expected "${cmd}" to be auto-allowed, got ${match.action} (${match.reason})`
      );
    }
  });

  await t.test("2. Command Rule Matcher: Hard Denies Destructive Commands", () => {
    const dangerousCommands = [
      "format C:",
      "diskpart /s script.txt",
      "rmdir /s /q C:\\",
      "del /f /s /q C:\\windows",
      "rm -rf /",
      "rm -rf /*",
      "rm -rf C:\\",
      "Remove-Item -Path C:\\ -Recurse -Force",
      ":(){ :|:& };:",
    ];

    for (const cmd of dangerousCommands) {
      const match = matchCommandRule(cmd);
      assert.equal(
        match.action,
        "deny",
        `Expected "${cmd}" to be denied, got ${match.action}`
      );
    }
  });

  await t.test("3. Command Rule Matcher: Fallbacks to Ask for Mutating Commands", () => {
    const askCommands = [
      "npm install react",
      "cargo build --release",
      "python train.py",
      "git push origin main",
      "git commit -m 'feat'",
    ];

    for (const cmd of askCommands) {
      const match = matchCommandRule(cmd);
      assert.equal(
        match.action,
        "ask",
        `Expected "${cmd}" to prompt for confirmation, got ${match.action}`
      );
    }
  });

  await t.test("4. Command Rule Matcher: Custom Rules Override Default Behavior", () => {
    const customRules: CommandRule[] = [
      { pattern: "^npm\\s+test$", action: "allow", description: "Allow running tests" },
      { pattern: "^git\\s+log.*", action: "deny", description: "Block git log" },
    ];

    const testMatch = matchCommandRule("npm test", customRules);
    assert.equal(testMatch.action, "allow");

    const logMatch = matchCommandRule("git log -n 1", customRules);
    assert.equal(logMatch.action, "deny");
  });

  await t.test("5. Terminal Runner: Synchronous runCommand Execution", async () => {
    const result = await runCommand({
      command: "echo test_sanctum_runner_success",
      workspaceRoot: tmpRoot,
      cwd: tmpRoot,
      timeoutMs: 10000,
    });

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("test_sanctum_runner_success"));
    assert.equal(result.truncated, false);
  });

  await t.test("6. Terminal Runner: Blocks Execution of Denied Commands", async () => {
    await assert.rejects(
      async () => {
        await runCommand({
          command: "format C:",
          workspaceRoot: tmpRoot,
        });
      },
      /Command blocked by security policy/
    );
  });

  await t.test("7. Terminal Runner: Output Truncation with Spillover File", async () => {
    // Generate output that exceeds maxOutputChars = 500
    const result = await runCommand({
      command: "powershell -Command \"1..100 | ForEach-Object { 'Line ' + $_ + ' of padding data' }\"",
      workspaceRoot: tmpRoot,
      cwd: tmpRoot,
      maxOutputChars: 300,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.truncated, true);
    assert.ok(result.spillPath && fs.existsSync(result.spillPath));
    assert.ok(result.stdout.includes("[Output truncated: full log saved to"));
  });

  await t.test("8. Terminal Runner: Background Process Lifecycle (start, read, stop)", async () => {
    const startRes = startBackgroundProcess({
      command: "powershell -Command \"Start-Sleep -Seconds 10; Write-Output 'bg_done'\"",
      workspaceRoot: tmpRoot,
      cwd: tmpRoot,
    });

    assert.ok(startRes.taskId.startsWith("bg-"));

    // Give process 200ms to spin up
    await new Promise((resolve) => setTimeout(resolve, 200));

    const readRes = readBackgroundProcessOutput(startRes.taskId);
    assert.equal(readRes.taskId, startRes.taskId);
    assert.equal(readRes.status, "running");

    const stopRes = stopBackgroundProcess(startRes.taskId);
    assert.equal(stopRes.stopped, true);

    const postStopRes = readBackgroundProcessOutput(startRes.taskId);
    assert.equal(postStopRes.status, "terminated");
  });
});
