import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Phase 6.1: Machine-checked Feature Registry & FEATURES.md sync", () => {
  test("every feature in feature_registry.json has a valid status, non-empty tests, and every referenced test file exists", () => {
    const regPath = path.join(ROOT, "feature_registry.json");
    assert.ok(fs.existsSync(regPath), "feature_registry.json must exist");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf-8"));
    const allowedStatuses = new Set(["verified", "partial", "experimental", "removed"]);
    const seenIds = new Set<string>();

    assert.ok(Array.isArray(reg.features) && reg.features.length >= 20);
    for (const f of reg.features) {
      assert.ok(f.id && !seenIds.has(f.id), `Duplicate or missing feature ID: ${f.id}`);
      seenIds.add(f.id);
      assert.ok(allowedStatuses.has(f.status), `Invalid status '${f.status}' on ${f.id}`);
      assert.ok(Array.isArray(f.tests) && f.tests.length > 0, `Feature ${f.id} has no proving test`);
      for (const rel of f.tests) {
        assert.ok(fs.existsSync(path.join(ROOT, rel)), `Feature ${f.id} references missing test: ${rel}`);
      }
    }

    // Verify FEATURES.md includes every feature ID from registry
    const featuresMd = fs.readFileSync(path.join(ROOT, "FEATURES.md"), "utf-8");
    for (const f of reg.features) {
      assert.ok(featuresMd.includes(f.id), `FEATURES.md is out of sync (missing ${f.id})`);
    }
  });
});
