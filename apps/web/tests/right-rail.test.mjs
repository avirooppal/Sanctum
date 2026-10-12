import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("RightRail returns null when isOpen is false", async () => {
  const { RightRail } = await import("../build/tests/ui/RightRail.js");

  const html = renderToStaticMarkup(
    React.createElement(RightRail, {
      messages: [],
      isOpen: false,
      onClose: () => {},
    })
  );

  assert.equal(html, "", "Must return empty when closed");
});

test("RightRail extracts code artifacts with language, lines, copy and download actions", async () => {
  const { RightRail } = await import("../build/tests/ui/RightRail.js");

  const messages = [
    {
      role: "assistant",
      content: "Here is a python script:\n\n```python\ndef hello():\n    print('sanctum')\n```\nAnd typescript:\n\n```typescript\nconst a = 1;\n```",
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(RightRail, {
      messages,
      isOpen: true,
      onClose: () => {},
    })
  );

  assert(html.includes("Files &amp; Code (2)") || html.includes("Files & Code (2)"), "Must count 2 code artifacts");
  assert(html.includes("python"), "Must detect python snippet");
  assert(html.includes("typescript"), "Must detect typescript snippet");
  assert(html.includes("Download"), "Must provide download action");
  assert(html.includes("Copy"), "Must provide copy action");
});

test("RightRail extracts citations and safe links", async () => {
  const { RightRail } = await import("../build/tests/ui/RightRail.js");

  const messages = [
    {
      role: "assistant",
      content: "Refer to documentation [^1] and [Local Guide](https://sanctum.local/guide).",
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(RightRail, {
      messages,
      isOpen: true,
      onClose: () => {},
    })
  );

  assert(html.includes("Links &amp; Citations (2)") || html.includes("Links & Citations (2)"), "Must count 2 links/citations");
  assert(html.includes("Source: 1") || html.includes("Citation"), "Must include citation chip reference");
});

test("RightRail renders accessible Knowledge tree header and empty state", async () => {
  const { RightRail } = await import("../build/tests/ui/RightRail.js");

  const html = renderToStaticMarkup(
    React.createElement(RightRail, {
      messages: [],
      isOpen: true,
      onClose: () => {},
    })
  );

  assert(html.includes("Knowledge Tree"), "Must include Knowledge Tree tab");
  assert(html.includes("Close right rail"), "Must include accessible close button");
});
