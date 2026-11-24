import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Phase 2.7: THREATS.md completeness & test references", () => {
  test("THREATS.md covers all required attacker types and every referenced test file exists", () => {
    const threatsPath = path.join(ROOT, "THREATS.md");
    assert.ok(fs.existsSync(threatsPath), "THREATS.md must exist");
    const content = fs.readFileSync(threatsPath, "utf-8");

    const requiredSections = [
      "Malicious File",
      "Malicious Cloned Repo",
      "Malicious Web Page",
      "Malicious MCP Server",
      "Other Local User",
      "Local Malware",
      "workspace_only",
    ];
    for (const s of requiredSections) {
      assert.ok(content.includes(s), `THREATS.md must cover '${s}'`);
    }

    const refs = content.match(/tests\/[a-zA-Z0-9_.-]+\.test\.ts/g) || [];
    assert.ok(refs.length >= 6, "THREATS.md must cite proving test files");
    for (const rel of new Set(refs)) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `Referenced test file missing: ${rel}`);
    }
  });
});
