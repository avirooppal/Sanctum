import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();

describe("Phase 5.3-5.4: Speech/OCR pack integrity & zero cloud browser SpeechRecognition fallback", () => {
  test("browser cloud SpeechRecognition / webkitSpeechRecognition is removed from src/", () => {
    const violations: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, "utf-8");
        if (/\bwebkitSpeechRecognition\b|\bwindow\s+as\s+any\)\.SpeechRecognition\b/.test(content)) {
          violations.push(path.relative(ROOT, full));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(violations, [], `Cloud browser SpeechRecognition found in: ${violations.join(", ")}`);
  });

  test("verify_packs_integrity.py passes on real repo and fails closed when a declared file is missing", () => {
    const okRes = spawnSync("python", ["tools/verify_packs_integrity.py"], { encoding: "utf-8", timeout: 10000 });
    assert.equal(okRes.status, 0, `Pack integrity check failed: ${okRes.stderr}\n${okRes.stdout}`);
    const parsed = JSON.parse(okRes.stdout);
    assert.equal(parsed.ok, true);
    assert.ok(parsed.packs.every((p: any) => p.status === "installed" && p.sha256.length === 64));

    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-empty-packs-"));
    try {
      const failRes = spawnSync("python", ["tools/verify_packs_integrity.py", emptyDir], { encoding: "utf-8", timeout: 10000 });
      assert.notEqual(failRes.status, 0, "Missing declared packs MUST fail build-time check");
      const failJson = JSON.parse(failRes.stdout);
      assert.equal(failJson.ok, false);
      assert.ok(failJson.packs.some((p: any) => p.status === "missing"));
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
