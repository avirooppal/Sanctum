import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Phase 1.6: Local-only positioning & zero stale cloud provider references", () => {
  test("docs, UI, and installer copy contain no stale cloud-provider marketing or unbacked claims", () => {
    const docFiles = ["README.md", "FEATURES.md", "CAPABILITIES.md", "HARNESS.md", "PROTOCOL.md"];
    const forbidden = [
      /Cloud Frontier/i,
      /Frontier Cloud/i,
      /\/v1\/providers\b/,
      /CloudProvidersCard/i,
      /cloud_providers\.json/,
      /100%\s*wired/i,
    ];

    const violations: string[] = [];

    for (const rel of docFiles) {
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, "utf-8");
      for (const rx of forbidden) {
        if (rx.test(content)) {
          violations.push(`${rel} matches forbidden pattern ${rx}`);
        }
      }
    }

    const scanSrc = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanSrc(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(ROOT, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full, "utf-8");
        for (const rx of forbidden) {
          if (rx.test(content)) {
            violations.push(`${rel} matches forbidden pattern ${rx}`);
          }
        }
      }
    };
    scanSrc(path.join(ROOT, "src"));

    assert.deepEqual(violations, [], `Stale cloud/unbacked references found:\n${violations.join("\n")}`);

    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf-8");
    assert.match(readme, /strictly local, private/i);
    const features = fs.readFileSync(path.join(ROOT, "FEATURES.md"), "utf-8");
    assert.match(features, /strictly local, private/i);
  });
});
