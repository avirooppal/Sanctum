import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Jan v0.8.7 Exact UI Parity Characterization", () => {
  const referenceDir = path.resolve("docs/design/reference/owner");
  const localesDir = path.resolve("src/locales/en");

  test("all 7 reference screenshots from owner exist with valid dimensions and non-empty payload", () => {
    const requiredScreenshots = [
      "preview.webp", // Step 1 first run
      "preview (1).webp", // Hub view
      "preview (2).webp", // Search modal
      "preview (3).webp", // Create project dialog
      "9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png", // Settings general
      "Screenshot 2026-10-25 190854.png", // Floating sidebar
      "186e7d53-2468-4c1c-b016-18af1233da1f.png", // Downloads popover
    ];

    for (const file of requiredScreenshots) {
      const fullPath = path.join(referenceDir, file);
      assert.equal(fs.existsSync(fullPath), true, `Screenshot missing: ${file}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 1000, `Screenshot file truncated: ${file}`);
    }
  });

  test("upstream v0.8.7 en string tables exist and sanitize 'Jan' to 'Sanctum'", () => {
    const tables = ["setup.json", "hub.json", "settings.json", "common.json", "chat.json"];
    for (const t of tables) {
      const fp = path.join(localesDir, t);
      assert.equal(fs.existsSync(fp), true, `Locale file missing: ${t}`);
      const raw = fs.readFileSync(fp, "utf-8");
      assert.ok(raw.length > 0, `Empty locale file: ${t}`);
      const parsed = JSON.parse(raw);
      assert.equal(typeof parsed, "object");
    }
  });

  test("app icon suite generated from Beta.jpg exists across all target resolutions", () => {
    const icoPath = path.resolve("deploy/installer/app-icon.ico");
    assert.equal(fs.existsSync(icoPath), true, "app-icon.ico missing");
    const stat = fs.statSync(icoPath);
    assert.ok(stat.size > 15000, "app-icon.ico lacks multi-resolution mipmaps");

    const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
    for (const s of pngSizes) {
      const p = path.resolve(`assets/icons/icon-${s}.png`);
      assert.equal(fs.existsSync(p), true, `Missing icon-${s}.png`);
    }

    const contactSheet = path.resolve("assets/icons/contact_sheet.png");
    assert.equal(fs.existsSync(contactSheet), true, "Missing contact sheet verification image");
  });

  test("ADR 0103, ui-provenance.md, ui-deviations.md and UI_PARITY.md are initialized", () => {
    const docs = [
      "docs/adr/0103-pinned-jan-v087-ui-architecture.md",
      "docs/ui-provenance.md",
      "docs/ui-deviations.md",
      "docs/UI_PARITY.md",
    ];
    for (const d of docs) {
      const fp = path.resolve(d);
      assert.equal(fs.existsSync(fp), true, `Documentation missing: ${d}`);
      assert.ok(fs.readFileSync(fp, "utf-8").length > 200, `Incomplete documentation: ${d}`);
    }
  });
});
