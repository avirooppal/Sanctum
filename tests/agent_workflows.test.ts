import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeChecklistItems,
  inferVerifyCommandForFile,
} from "../core/ai/tools/agent_workflows.ts";

describe("Anthropic Agent Workflows — #2 Auto-Verify & #4 Live Task Checklist", () => {
  test("1. normalizeChecklistItems accepts structured array with flexible status aliases", () => {
    const items = normalizeChecklistItems([
      { text: "Create DOGS folder", status: "completed" },
      { title: "Write dogs.py", status: "running" },
      { step: "Verify output", status: "pending" },
      { text: "Failed check", status: "error" },
    ]);
    assert.equal(items.length, 4);
    assert.deepEqual(
      items.map((i) => i.status),
      ["done", "in_progress", "pending", "failed"]
    );
  });

  test("2. normalizeChecklistItems accepts JSON string and markdown checklist string", () => {
    const fromJson = normalizeChecklistItems(
      JSON.stringify([{ text: "Step A", status: "done" }, { text: "Step B", status: "pending" }])
    );
    assert.equal(fromJson.length, 2);
    assert.equal(fromJson[0].status, "done");

    const fromMd = normalizeChecklistItems(
      "- [x] Create folder\n- [~] Edit script\n- [ ] Run tests\n- [!] Lint check"
    );
    assert.equal(fromMd.length, 4);
    assert.deepEqual(
      fromMd.map((i) => i.status),
      ["done", "in_progress", "pending", "failed"]
    );
  });

  test("3. normalizeChecklistItems caps list size at 20 and ignores empty items", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ text: i === 0 ? "   " : `Task ${i}` }));
    const items = normalizeChecklistItems(raw);
    assert.equal(items.length, 19);
  });

  test("4. inferVerifyCommandForFile maps runnable script extensions accurately", () => {
    assert.equal(inferVerifyCommandForFile("DOGS/dogs.py"), 'python "DOGS/dogs.py"');
    assert.equal(inferVerifyCommandForFile("scripts/app.js"), 'node "scripts/app.js"');
    assert.equal(inferVerifyCommandForFile("scripts/app.mjs"), 'node "scripts/app.mjs"');
    assert.equal(
      inferVerifyCommandForFile("src/demo.ts"),
      'node --experimental-strip-types "src/demo.ts"'
    );
    assert.equal(inferVerifyCommandForFile("README.md"), null);
    assert.equal(inferVerifyCommandForFile("data.json"), null);
  });

  test("5. inferVerifyCommandForFile rejects command injection and traversal paths", () => {
    assert.equal(inferVerifyCommandForFile("dogs.py; calc.exe"), null);
    assert.equal(inferVerifyCommandForFile("dogs.py && whoami"), null);
    assert.equal(inferVerifyCommandForFile("../escape.py"), null);
    assert.equal(inferVerifyCommandForFile("a|b.py"), null);
    assert.equal(inferVerifyCommandForFile("$(whoami).py"), null);
  });
});
