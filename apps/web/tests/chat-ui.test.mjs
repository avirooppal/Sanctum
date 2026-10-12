import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("ContextBar renders truthful Unknown state when token usage data is missing", async () => {
  const { ContextBar } = await import("../build/tests/ui/ContextBar.js");

  const html = renderToStaticMarkup(
    React.createElement(ContextBar, {
      conversation: "conv-1",
      contextLimit: 8192,
    })
  );

  assert(html.includes("Tokens:"), "Must include Tokens label");
  assert(html.includes("Unknown"), "Must truthfully state Unknown rather than a synthetic number");
  assert(html.includes("Window: 8,192"), "Must show context window limit");
});

test("ChatComposer lists ONLY implemented slash commands and no speculative commands", async () => {
  const { IMPLEMENTED_SLASH_COMMANDS } = await import("../build/tests/ui/ChatComposer.js");

  const commands = IMPLEMENTED_SLASH_COMMANDS.map(c => c.command);
  assert.deepEqual(
    commands,
    ["/help", "/clear", "/stop", "/info"],
    "Must only contain implemented slash commands"
  );
  assert(!commands.includes("/eval"), "Must not include unimplemented commands");
  assert(!commands.includes("/model"), "Must not include unimplemented commands");
});

test("ChatComposer renders accessible textarea with configurable Enter hint", async () => {
  const { ChatComposer } = await import("../build/tests/ui/ChatComposer.js");

  const html = renderToStaticMarkup(
    React.createElement(ChatComposer, {
      prompt: "",
      setPrompt: () => {},
      onSend: () => {},
      onStop: () => {},
      busy: false,
      sendOnEnter: true,
    })
  );

  assert(html.includes('aria-label="Message"'), "Must have accessible label for textarea");
  assert(html.includes("Enter to send (Shift+Enter for newline)"), "Must describe Enter-to-send shortcut");
  assert(html.includes("Attach"), "Must have attachment button for Knowledge");
});

test("ChatView renders document measure layout and user bubbles layout without throwing", async () => {
  const { ChatView } = await import("../build/tests/ui/ChatView.js");

  const messages = [
    { role: "user", content: "What is Sanctum?" },
    { role: "assistant", content: "Sanctum is a private on-device workspace [^1] with `local` inference." },
  ];

  // 1. Bubble layout
  const bubbleHtml = renderToStaticMarkup(
    React.createElement(ChatView, {
      messages,
      prompt: "",
      setPrompt: () => {},
      onSend: () => {},
      onStop: () => {},
      busy: false,
      sendOnEnter: true,
      messageLayout: "bubble",
      conversationId: "conv-test",
    })
  );

  assert(bubbleHtml.includes("ui-user-bubble"), "Bubble mode must render user bubbles");
  assert(bubbleHtml.includes("Sanctum"), "Must render assistant label");
  assert(bubbleHtml.includes("ui-citation-chip"), "Must render citation chip in bubble mode");

  // 2. Document layout
  const docHtml = renderToStaticMarkup(
    React.createElement(ChatView, {
      messages,
      prompt: "",
      setPrompt: () => {},
      onSend: () => {},
      onStop: () => {},
      busy: false,
      sendOnEnter: true,
      messageLayout: "document",
      conversationId: "conv-test",
    })
  );

  assert(docHtml.includes("max-w-[720px]"), "Document mode must enforce ~720px measure");
  assert(docHtml.includes("Sanctum"), "Must render assistant content");
});

test("ChatView renders calm streaming indicator during local generation", async () => {
  const { ChatView } = await import("../build/tests/ui/ChatView.js");

  const messages = [
    { role: "user", content: "Explain local inference." },
    { role: "assistant", content: "Local inference runs" },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ChatView, {
      messages,
      prompt: "",
      setPrompt: () => {},
      onSend: () => {},
      onStop: () => {},
      busy: true,
      sendOnEnter: true,
      conversationId: "conv-streaming",
    })
  );

  assert(html.includes("Thinking locally…"), "Must render calm local thinking indicator");
  assert(html.includes("animate-ping"), "Must include subtle calm pulsing animation");
});
