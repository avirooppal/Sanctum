import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, parseMarkdownBlocks } from "../build/tests/ui/SafeMarkdown.js";

test("sanitizeUrl allows safe http, https, and hash links", () => {
  assert.equal(sanitizeUrl("https://example.com"), "https://example.com");
  assert.equal(sanitizeUrl("http://127.0.0.1:8765/page"), "http://127.0.0.1:8765/page");
  assert.equal(sanitizeUrl("#section"), "#section");
  assert.equal(sanitizeUrl("/relative/path"), "/relative/path");
});

test("sanitizeUrl blocks javascript:, data:, and malicious protocol injection", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), null);
  assert.equal(sanitizeUrl("//malicious.com"), null);
});

test("parseMarkdownBlocks isolates code blocks from paragraphs", () => {
  const md = "Hello world\n\n```python\nprint(42)\n```\n\nTail text";
  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[0].content, "Hello world");
  assert.equal(blocks[1].type, "code");
  assert.equal(blocks[1].language, "python");
  assert.equal(blocks[1].content, "print(42)");
  assert.equal(blocks[2].type, "paragraph");
  assert.equal(blocks[2].content, "Tail text");
});

test("parseMarkdownBlocks handles unclosed code fence without crashing", () => {
  const md = "```typescript\nconst x = 10;";
  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].content, "const x = 10;");
});

test("SafeMarkdown renders without throwing and escapes dangerous html elements", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SafeMarkdown } = await import("../build/tests/ui/SafeMarkdown.js");
  
  const rawPayload = '<script>alert(1)</script><img src="http://evil.com/leak" onerror="alert(2)">**bold** [safe link](https://sanctum.local/docs)';
  const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: rawPayload }));
  
  assert(!html.includes("<script>"), "Must not include script tags");
  assert(!html.includes("<img"), "Must not include img tags (prevent egress/tracking)");
  assert(html.includes("<strong>bold</strong>"), "Must support bold markdown");
  assert(html.includes('href="https://sanctum.local/docs"'), "Must render safe links");
});

