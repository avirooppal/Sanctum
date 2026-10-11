import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const WEB_ROOT = path.resolve(__dirname, "..");

test("apps/web production package.json does not import upstream or reference dependencies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "package.json"), "utf8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const forbidden = [
    "@hermes/shared",
    "@nous-research/ui",
    "electron",
    "node-pty",
    "xterm",
    "@xterm/xterm",
    "three",
    "@react-three/fiber",
  ];

  for (const dep of forbidden) {
    assert.equal(
      allDeps[dep],
      undefined,
      `Forbidden upstream dependency found in apps/web: ${dep}`
    );
  }
});

test("production web source code contains zero imports from reference or upstream directories", () => {
  const srcDir = path.join(WEB_ROOT, "src");
  function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
        const content = fs.readFileSync(fullPath, "utf8");
        assert.ok(
          !content.includes(".sanctum/upstream"),
          `File ${fullPath} references .sanctum/upstream`
        );
        assert.ok(
          !content.includes("tools/reference"),
          `File ${fullPath} references tools/reference`
        );
      }
    }
  }
  checkDir(srcDir);
});
