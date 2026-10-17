import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("StatusBar renders health, offline egress badge, and context bar", async () => {
  const { StatusBar } = await import("../build/tests/ui/StatusBar.js");

  const models = [
    {
      id: "sanctum-chat-v1",
      capabilities: ["text", "tools"],
      context_length: 4096,
      license: "Apache-2.0",
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(StatusBar, {
      conversation: "conv-status-test",
      activeModel: "sanctum-chat-v1",
      models,
      onSelectModel: () => {},
    })
  );

  assert(html.includes("role=\"status\""), "Must have role status for accessibility");
  assert(html.includes("Startup checks: unknown. Ledger unavailable."), "Absent evidence must remain unknown");
  assert(!html.includes("0 outbound"), "Missing health cannot prove zero historical traffic");
  assert(html.includes("sanctum-chat-v1"), "Must display active model ID");
  assert(html.includes("Tokens:"), "Must integrate real context usage bar");
  assert(html.includes("Unknown"), "Must display truthful Unknown for empty/missing usage");
});

test("StatusBar renders background jobs counter button", async () => {
  const { StatusBar } = await import("../build/tests/ui/StatusBar.js");

  const html = renderToStaticMarkup(
    React.createElement(StatusBar, {
      conversation: "conv-status-2",
      activeModel: "model-a",
      models: [],
      onSelectModel: () => {},
    })
  );

  assert(html.includes("Unknown queued or active requests"), "Must not fabricate counts or classify every lane as background");
  assert(html.includes("aria-label=\"Background jobs status\""), "Must provide accessible label for jobs status");
});
