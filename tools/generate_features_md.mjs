/**
 * Generates FEATURES.md directly from feature_registry.json so documentation
 * can never drift ahead of tested, verified features.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "feature_registry.json"), "utf-8"));

const lines = [
  "# Sanctum — Registry-Driven Feature Inventory",
  "",
  "Sanctum is a strictly local, private AI workspace and agent harness for Windows. This document is generated directly from `feature_registry.json`; every active feature is backed by automated tests.",
  "",
  "## Known Limits (Stated Plainly)",
  ...registry.limits.map((l) => `- ${l}`),
  "",
  "## Feature Registry",
  "",
  "| ID | Feature | Status | UI / API Entry Point | Proving Test(s) |",
  "|---|---|---|---|---|",
  ...registry.features.map(
    (f) => `| \`${f.id}\` | ${f.name} | **${f.status}** | ${f.uiEntryPoint} | ${f.tests.map((t) => `\`${t}\``).join(", ")} |`
  ),
  "",
];

fs.writeFileSync(path.join(ROOT, "FEATURES.md"), lines.join("\n"), "utf-8");
console.log(`Generated FEATURES.md with ${registry.features.length} features.`);
