import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SETTINGS_COMPONENTS_DIR = path.resolve(process.cwd(), "src/components/jan");

const DENYLIST = [
  "parity",
  "reproducing",
  "screenshot",
  ".png",
  "defaults to",
  "for offline/privacy guarantees",
  "9f7dba0d",
  "186e7d53",
  "telemetry",
];

function getAllTsxFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllTsxFiles(full));
    } else if (file.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

test("Settings Reality Gate: Denylist and Real Interactive Controls", async (t) => {
  await t.test("settings components must not contain meta/spec or prompt denylist tokens", () => {
    const files = getAllTsxFiles(SETTINGS_COMPONENTS_DIR).filter(
      (f) => path.basename(f).startsWith("Settings") || path.basename(f) === "JanAppShell.tsx"
    );

    assert.ok(files.length >= 10, "Must inspect all settings section components");

    const violations: { file: string; token: string; line: number; text: string }[] = [];

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const token of DENYLIST) {
          if (line.toLowerCase().includes(token.toLowerCase())) {
            violations.push({
              file: fileName,
              token,
              line: i + 1,
              text: line.trim(),
            });
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} reality gate violation(s) in Settings components:\n` +
        violations.map((v) => ` - [${v.file}:${v.line}] matches "${v.token}": ${v.text}`).join("\n")
    );
  });

  await t.test("every settings section must render interactive controls", () => {
    const files = getAllTsxFiles(SETTINGS_COMPONENTS_DIR).filter(
      (f) => path.basename(f).startsWith("Settings") && path.basename(f) !== "SettingsMenu.tsx"
    );

    assert.ok(files.length >= 10, "Must have all settings pages implemented");

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, "utf-8");

      const hasButtons = content.includes("<Button") || content.includes("<button");
      const hasInputs =
        content.includes('role="switch"') ||
        content.includes("<input") ||
        content.includes("<select") ||
        content.includes("<textarea");

      assert.ok(
        hasButtons,
        `Settings section ${fileName} must contain interactive button controls`
      );
      assert.ok(
        hasInputs,
        `Settings section ${fileName} must contain interactive inputs/switches/selects`
      );
    }
  });
});
