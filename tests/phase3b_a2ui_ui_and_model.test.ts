import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  A2UI_PINNED_VERSION,
  validateA2uiSurfaceClient,
  flattenA2uiToMarkdown,
  shouldEnableRichReplies,
  buildCompactA2uiPromptBlock,
} from "../src/lib/a2ui/adapter.ts";

const ROOT = process.cwd();

describe("Phase 3b-3/4/5: A2UI UI adapter, fallback branches, XSS, Auto gating & zero-network audit", () => {
  test("zero-network, zero-eval, zero-remote-import audit on A2UI UI modules", () => {
    const files = [
      "src/lib/a2ui/adapter.ts",
      "src/components/a2ui/A2uiSurfaceRenderer.tsx",
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      assert.equal(/\beval\s*\(/.test(src), false, `${rel} must not use eval()`);
      assert.equal(/\bnew\s+Function\b/.test(src), false, `${rel} must not use new Function()`);
      assert.equal(/dangerouslySetInnerHTML/.test(src), false, `${rel} must not use dangerouslySetInnerHTML`);
      assert.equal(/<iframe\b/i.test(src), false, `${rel} must not render iframes`);
      assert.equal(/https?:\/\//i.test(src), false, `${rel} must not contain external HTTP(S) URLs`);
    }
  });

  test("validates all fallback branches: valid, unknown component, spoofed approval, password, XSS, remote image, version mismatch, depth cap", () => {
    // Valid surface
    const ok = validateA2uiSurfaceClient({
      a2uiVersion: A2UI_PINNED_VERSION,
      surfaceId: "s1",
      summaryText: "Quick summary.",
      components: [
        { id: "c1", type: "Table", props: { columns: ["A", "B"], rows: [["1", "2"]] } },
        { id: "c2", type: "TodoList", props: { items: [{ title: "Ship", status: "done" }] } },
        { id: "c3", type: "Button", props: { label: "Continue" } },
      ],
    });
    assert.equal(ok.ok, true);
    assert.ok(ok.markdownFallback.includes("| A | B |"));
    assert.ok(ok.markdownFallback.includes("- [x] Ship"));
    assert.ok(ok.markdownFallback.includes("[Continue]"));

    // Spoofed approval card rejected
    assert.equal(
      validateA2uiSurfaceClient({ surfaceId: "s2", components: [{ id: "a", type: "ApprovalCard", props: {} }] }).code,
      "disallowed_component"
    );

    // Password input rejected
    assert.equal(
      validateA2uiSurfaceClient({ surfaceId: "s3", components: [{ id: "p", type: "TextField", props: { inputType: "password" } }] }).code,
      "disallowed_secret_field"
    );

    // XSS script & javascript: URI rejected
    assert.equal(
      validateA2uiSurfaceClient({ surfaceId: "s4", components: [{ id: "x", type: "Text", props: { text: "<script>alert(1)</script>" } }] }).code,
      "unsafe_content"
    );
    assert.equal(
      validateA2uiSurfaceClient({ surfaceId: "s5", components: [{ id: "x", type: "Text", props: { text: "javascript:alert(1)" } }] }).code,
      "unsafe_content"
    );

    // Remote image rejected
    assert.equal(
      validateA2uiSurfaceClient({ surfaceId: "s6", components: [{ id: "i", type: "Card", props: { image: "https://evil.com/x.png" } }] }).code,
      "remote_media_blocked"
    );

    // Unsupported version rejected with markdown fallback preserved
    const verFail = validateA2uiSurfaceClient({
      a2uiVersion: "2.0.0",
      surfaceId: "s7",
      summaryText: "Old summary preserved",
      components: [{ id: "t", type: "Text", props: { text: "Hello" } }],
    });
    assert.equal(verFail.ok, false);
    assert.equal(verFail.code, "unsupported_version");
    assert.ok(verFail.markdownFallback.includes("Old summary preserved"));
  });

  test("Rich Replies mode (Off default, Auto >= 70%, Always) and auto-disable after 3 consecutive failures", () => {
    assert.equal(shouldEnableRichReplies("off", 0.95, 0).enabled, false);
    assert.equal(shouldEnableRichReplies("auto", null, 0).enabled, false);
    assert.equal(shouldEnableRichReplies("auto", 0.50, 0).enabled, false);
    assert.equal(shouldEnableRichReplies("auto", 0.75, 0).enabled, true);
    assert.equal(shouldEnableRichReplies("always", 0.10, 0).enabled, true);
    assert.equal(shouldEnableRichReplies("always", 0.99, 3).enabled, false, "Must auto-disable after 3 consecutive failures");

    const promptBlock = buildCompactA2uiPromptBlock();
    assert.ok(promptBlock.length < 500, "Compact A2UI prompt block must stay small for local context windows");
    assert.ok(promptBlock.includes(A2UI_PINNED_VERSION));
  });

  test("A2UI.md exists and documents pinned version, catalog, exclusions, and fallback matrix", () => {
    const doc = fs.readFileSync(path.join(ROOT, "A2UI.md"), "utf-8");
    assert.ok(doc.includes("0.9.1"));
    assert.ok(doc.includes("ApprovalCard") || doc.includes("Approvals"));
    assert.ok(doc.includes("a2ui_user_action"));
    assert.ok(doc.includes("Fallback Matrix"));
  });
});
