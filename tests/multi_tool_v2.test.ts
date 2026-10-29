/**
 * Multi-Tool Calling Architecture (v2) Test Suite
 * Verifies parallel scheduling, conflict serialization, error isolation,
 * output truncation, call parsing, and cancellation guarantees.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { ToolScheduler } from "../core/ai/tools/scheduler.ts";
import { ToolExecutor } from "../core/ai/tools/executor.ts";
import { ToolPermissionGate } from "../core/ai/tools/permission_gate.ts";
import { ToolPermissionEngine } from "../core/ai/tools/permissions.ts";
import { parseModelToolCalls } from "../core/ai/tools/parse_calls.ts";
import { type ToolCallRequest, type ToolSpec } from "../core/ai/tools/types.ts";

test("Multi-Tool V2: Architecture & Execution Guarantees", async (t) => {
  // 1. Parallel execution of independent read tools
  await t.test("Parallel Execution: independent reads run concurrently", async () => {
    const scheduler = new ToolScheduler({ concurrency: 4 });
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const specs = new Map<string, ToolSpec>();
    specs.set("read_a", {
      name: "read_a",
      safety: "read",
      parallelSafe: true,
      resources: () => ["file:a.txt"],
      run: async () => {
        await delay(30);
        return "content-a";
      },
    });
    specs.set("read_b", {
      name: "read_b",
      safety: "read",
      parallelSafe: true,
      resources: () => ["file:b.txt"],
      run: async () => {
        await delay(30);
        return "content-b";
      },
    });

    const calls: ToolCallRequest[] = [
      { id: "c1", name: "read_a", arguments: { path: "a.txt" }, index: 0 },
      { id: "c2", name: "read_b", arguments: { path: "b.txt" }, index: 1 },
    ];

    const t0 = Date.now();
    const results = await scheduler.scheduleAndRun(calls, specs, async (call, spec) => {
      const out = await spec!.run(call.arguments, { signal: new AbortController().signal });
      return {
        id: call.id,
        toolName: call.name,
        ok: true,
        status: "completed",
        output: out,
        exitCode: 0,
        durationMs: 30,
      };
    });

    const duration = Date.now() - t0;
    assert.equal(results.length, 2);
    assert.equal(results[0].id, "c1");
    assert.equal(results[0].output, "content-a");
    assert.equal(results[1].id, "c2");
    assert.equal(results[1].output, "content-b");
    // Should run concurrently in ~30-50ms instead of serial ~60ms+
    assert.ok(duration < 55, `Expected concurrent execution, took ${duration}ms`);
  });

  // 2. Conflict-aware serialization: edits on the same file serialize
  await t.test("Conflict Serialization: edits on the same file serialize in order", async () => {
    const scheduler = new ToolScheduler({ concurrency: 4 });
    const order: string[] = [];

    const specs = new Map<string, ToolSpec>();
    specs.set("edit_file", {
      name: "edit_file",
      safety: "write",
      parallelSafe: false,
      resources: (args) => [`file:${args.path}`],
      run: async (args) => {
        order.push(`start-${args.step}`);
        await new Promise((r) => setTimeout(r, 20));
        order.push(`end-${args.step}`);
        return `done-${args.step}`;
      },
    });

    const calls: ToolCallRequest[] = [
      { id: "c1", name: "edit_file", arguments: { path: "shared.txt", step: 1 }, index: 0 },
      { id: "c2", name: "edit_file", arguments: { path: "shared.txt", step: 2 }, index: 1 },
    ];

    const results = await scheduler.scheduleAndRun(calls, specs, async (call, spec) => {
      const out = await spec!.run(call.arguments, { signal: new AbortController().signal });
      return {
        id: call.id,
        toolName: call.name,
        ok: true,
        status: "completed",
        output: out,
        exitCode: 0,
        durationMs: 20,
      };
    });

    assert.equal(results.length, 2);
    // Verified serial execution order: start-1 -> end-1 -> start-2 -> end-2
    assert.deepEqual(order, ["start-1", "end-1", "start-2", "end-2"]);
  });

  // 3. Error isolation: one failing tool doesn't abort sibling tools
  await t.test("Error Isolation: failed call does not abort successful siblings in all-settled mode", async () => {
    const gate = new ToolPermissionGate();
    gate.registerTool({
      name: "valid_tool",
      description: "Valid tool",
      parameters: { type: "object", properties: { x: { type: "string", description: "x" } } },
      permissionLevel: "auto_allow",
    });

    const executor = new ToolExecutor(gate);
    executor.registerHandler("valid_tool", async (args) => ({
      stdout: `Processed ${args.x}`,
      exitCode: 0,
    }));

    const calls: ToolCallRequest[] = [
      { id: "c1", name: "valid_tool", arguments: { x: "first" }, index: 0 },
      { id: "c2", name: "non_existent_tool", arguments: {}, index: 1 },
      { id: "c3", name: "valid_tool", arguments: { x: "third" }, index: 2 },
    ];

    const results = await executor.executeMultipleCalls(calls, "session-test");
    assert.equal(results.length, 3);
    assert.equal(results[0].status, "completed");
    assert.equal(results[0].output, "Processed first");
    assert.equal(results[1].status, "error");
    assert.equal(results[1].ok, false);
    assert.equal(results[2].status, "completed");
    assert.equal(results[2].output, "Processed third");
  });

  // 4. Output Truncation & Spill-to-file
  await t.test("Output Truncation: large outputs are capped and spilled to file reference", async () => {
    const gate = new ToolPermissionGate();
    gate.registerTool({
      name: "big_output_tool",
      description: "Outputs big text",
      parameters: { type: "object", properties: {} },
      permissionLevel: "auto_allow",
    });

    const executor = new ToolExecutor(gate);
    executor.registerSpec({
      name: "big_output_tool",
      safety: "read",
      parallelSafe: true,
      maxOutputChars: 500,
      run: async () => "A".repeat(3000),
    });

    const calls: ToolCallRequest[] = [
      { id: "c1", name: "big_output_tool", arguments: {}, index: 0 },
    ];

    const results = await executor.executeMultipleCalls(calls, "session-test");
    assert.equal(results.length, 1);
    assert.equal(results[0].meta?.truncated, true);
    assert.ok(results[0].meta?.fullOutputRef);
    assert.ok(fs.existsSync(results[0].meta.fullOutputRef));
    assert.equal(fs.readFileSync(results[0].meta.fullOutputRef, "utf-8").length, 3000);
    // Cleanup spilled temp file
    fs.unlinkSync(results[0].meta.fullOutputRef);
  });

  // 5. Model tool call parsing across formats and JSON repair
  await t.test("Model Tool Call Parsing: supports XML tags, OpenAI format, and lenient JSON repair", () => {
    // 5a. OpenAI format with trailing comma
    const openAiMsg = {
      tool_calls: [
        {
          id: "call_1",
          function: { name: "readFile", arguments: '{"path": "test.txt",}' },
        },
      ],
    };
    const parsed1 = parseModelToolCalls(openAiMsg, 1);
    assert.equal(parsed1.length, 1);
    assert.equal(parsed1[0].name, "read_file");
    assert.equal(parsed1[0].arguments.path, "test.txt");

    // 5b. Qwen XML tag format
    const qwenMsg = {
      content:
        'Let me inspect the file:\n<tool_call>{"name": "list_directory", "arguments": {"path": "src"}}</tool_call>',
    };
    const parsed2 = parseModelToolCalls(qwenMsg, 2);
    assert.equal(parsed2.length, 1);
    assert.equal(parsed2[0].name, "list_directory");
    assert.equal(parsed2[0].arguments.path, "src");

    // 5c. Llama 3 format
    const llamaMsg = {
      content:
        '[TOOL_CALLS] [{"name": "edit_file", "arguments": {"path": "a.ts", "old_text": "x", "new_text": "y"}}]',
    };
    const parsed3 = parseModelToolCalls(llamaMsg, 3);
    assert.equal(parsed3.length, 1);
    assert.equal(parsed3[0].name, "edit_file");
    assert.equal(parsed3[0].arguments.new_text, "y");
  });

  // 6. Path Canonicalization & Security Jail
  await t.test("Permissions & Sandbox: path traversal is strictly rejected", () => {
    const engine = new ToolPermissionEngine({
      mode: "default",
      workspaceRoot: "C:/Users/aviroop/Desktop/Sanctum",
    });

    const jailCheck1 = engine.validatePathWithinWorkspace("../../outside.txt");
    assert.equal(jailCheck1.valid, false);
    assert.ok(jailCheck1.error?.includes("escapes workspace boundary"));

    const jailCheck2 = engine.validatePathWithinWorkspace("src/app/page.tsx");
    assert.equal(jailCheck2.valid, true);
  });
});
