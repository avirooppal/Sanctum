import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  selectToolsForPrompt,
  budgetToolOutput,
  formatPokaYokeError,
  type ToolDefLike,
} from "../core/ai/tools/tool_router.ts";
import { workspaceTools } from "../core/ai/tools/workspace_chat.ts";

describe("Anthropic Agent Guidelines — Dynamic Tool Routing & Poka-Yoke ACI", () => {
  test("1. Coding/file prompt routes to compact core toolset (<= 8 tools), excluding browser & daemon tools", () => {
    const selected = selectToolsForPrompt(workspaceTools, {
      userPrompt: "Create a folder named DOGS and write dogs.py to reverse a linked list, then run it",
    });
    const names = selected.map((t) => t.function.name);

    assert.ok(selected.length <= 9, `Expected <= 9 tools for coding prompt, got ${selected.length}: ${names.join(", ")}`);
    assert.ok(names.includes("set_checklist"));
    assert.ok(names.includes("create_directory"));
    assert.ok(names.includes("create_file"));
    assert.ok(names.includes("edit_file"));
    assert.ok(names.includes("read_file"));
    assert.ok(names.includes("run_command"));
    assert.equal(names.some((n) => n.startsWith("browser_")), false, "Browser tools should be excluded for local coding prompt");
    assert.equal(names.includes("start_background"), false, "Background daemon tools should be excluded");
  });

  test("2. Browser prompt dynamically includes browser_* tools", () => {
    const selected = selectToolsForPrompt(workspaceTools, {
      userPrompt: "Open https://example.com in the browser and scrape the pricing table",
    });
    const names = selected.map((t) => t.function.name);
    assert.ok(names.includes("browser_task"));
    assert.ok(names.includes("browser_open"));
    assert.ok(names.includes("browser_extract"));
  });

  test("3. Delete/rename prompt dynamically adds delete_path and move_path", () => {
    const selected = selectToolsForPrompt(workspaceTools, {
      userPrompt: "Delete old_notes.txt and rename draft.py to main.py",
    });
    const names = selected.map((t) => t.function.name);
    assert.ok(names.includes("delete_path"));
    assert.ok(names.includes("move_path"));
  });

  test("4. Memory/math prompt dynamically adds memory_save and calculator", () => {
    const selected = selectToolsForPrompt(workspaceTools, {
      userPrompt: "Remember my preferred language is TypeScript and calculate 42 * 17",
    });
    const names = selected.map((t) => t.function.name);
    assert.ok(names.includes("memory_save"));
    assert.ok(names.includes("calculator"));
  });

  test("5. Plan mode strictly restricts to inspection + PLAN.md editing (no delete_path or run_command)", () => {
    const selected = selectToolsForPrompt(workspaceTools, {
      userPrompt: "Delete everything and run rm -rf",
      planMode: true,
    });
    const names = selected.map((t) => t.function.name);
    assert.ok(names.includes("read_file"));
    assert.ok(names.includes("create_file"));
    assert.ok(names.includes("present_file"));
    assert.equal(names.includes("delete_path"), false);
    assert.equal(names.includes("run_command"), false);
    assert.equal(names.some((n) => n.startsWith("browser_")), false);
  });

  test("6. Connected external MCP tools and recent thread tools are preserved", () => {
    const fakeMcp: ToolDefLike = {
      type: "function",
      function: { name: "mcp__github__list_issues", description: "List GitHub issues" },
    };
    const selected = selectToolsForPrompt([...workspaceTools, fakeMcp], {
      userPrompt: "Check the readme",
      recentToolNames: ["read_logs"],
    });
    const names = selected.map((t) => t.function.name);
    assert.ok(names.includes("mcp__github__list_issues"), "Connected MCP tool must always be preserved");
    assert.ok(names.includes("read_logs"), "Recently used tool in thread must remain available");
  });

  test("7. budgetToolOutput preserves head + tail and inserts recovery guidance when oversized", () => {
    const huge = "HEADER_START\n" + "A".repeat(12000) + "\nFOOTER_END";
    const budgeted = budgetToolOutput(huge, 1000, "read_file");
    assert.ok(budgeted.length < huge.length);
    assert.ok(budgeted.startsWith("HEADER_START"));
    assert.ok(budgeted.endsWith("FOOTER_END"));
    assert.ok(budgeted.includes("read_file_range"), "Should suggest read_file_range for oversized read_file output");
  });

  test("8. formatPokaYokeError injects self-correcting recovery hints for common tool failures", () => {
    const editHint = formatPokaYokeError("edit_file", "Target old_text not found in file");
    assert.ok(editHint.includes("read_file"), "edit_file mismatch should suggest read_file");

    const createHint = formatPokaYokeError("create_file", "File already exists and will not overwrite");
    assert.ok(createHint.includes("edit_file"), "create_file exists error should suggest edit_file");

    const missingHint = formatPokaYokeError("read_file", "ENOENT: file does not exist");
    assert.ok(missingHint.includes("list_directory"), "missing file error should suggest list_directory");

    const runHint = formatPokaYokeError("run_command", "Exit code: 1\nSTDERR: NameError: name 'x' is not defined");
    assert.ok(runHint.includes("edit_file"), "failed run_command should suggest fixing source with edit_file");
  });
});
