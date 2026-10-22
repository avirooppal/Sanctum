import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("Optional Packs & Manifests Validation (R5)", () => {
  const packs = [
    { dir: "packs/speech", id: "sanctum.speech.whisperx" },
    { dir: "packs/rag", id: "sanctum.rag.vault" },
    { dir: "packs/research", id: "sanctum.research.deep" },
    { dir: "packs/agents", id: "sanctum.agents.computer-use" },
  ];

  test("all pack directories have valid JSON manifests", () => {
    for (const pack of packs) {
      const manifestPath = `${pack.dir}/pack.json`;
      assert.ok(fs.existsSync(manifestPath), `Manifest must exist at ${manifestPath}`);
      const raw = fs.readFileSync(manifestPath, "utf-8");
      const data = JSON.parse(raw);
      assert.equal(data.id, pack.id);
      assert.ok(data.name && data.version && data.description);
    }
  });
});
