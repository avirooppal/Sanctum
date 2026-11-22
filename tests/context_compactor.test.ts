import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  compactConversationHistory,
  estimateHistoryTokens,
  type CompactableMessage,
} from "../core/ai/tools/context_compactor.ts";

describe("Anthropic Agent Guidelines — #5 Automatic Context Compaction", () => {
  test("1. Short history below 70% of num_ctx is left untouched", () => {
    const msgs: CompactableMessage[] = [
      { role: "system", content: "You are a helpful local agent." },
      { role: "user", content: "Create DOGS/dogs.py" },
      { role: "assistant", content: "Done." },
    ];
    const res = compactConversationHistory(msgs, { maxContextTokens: 8192 });
    assert.equal(res.compacted, false);
    assert.equal(res.droppedCount, 0);
    assert.equal(res.messages.length, 3);
  });

  test("2. Long history exceeding 70% of num_ctx compacts middle turns and preserves system + recent tail", () => {
    const msgs: CompactableMessage[] = [
      { role: "system", content: "SYSTEM_RULE_KEEP_ME" },
      { role: "user", content: "Build DOGS/dogs.py and verify output" },
      { role: "tool", tool_name: "read_file", content: "X".repeat(9000) },
      { role: "assistant", content: "Analyzed huge file " + "Y".repeat(6000) },
      { role: "tool", tool_name: "run_command", content: "Exit code: 0\n" + "Z".repeat(9000) },
      // Recent 6 messages that must survive verbatim
      { role: "user", content: "Recent question 1" },
      { role: "assistant", content: "Recent answer 1" },
      { role: "user", content: "Recent question 2" },
      { role: "assistant", content: "Recent answer 2" },
      { role: "user", content: "Recent question 3" },
      { role: "assistant", content: "RECENT_TAIL_KEEP_ME" },
    ];

    const res = compactConversationHistory(msgs, {
      maxContextTokens: 4096,
      thresholdRatio: 0.7,
      keepRecentMessages: 6,
    });

    assert.equal(res.compacted, true);
    assert.equal(res.droppedCount, 4);
    assert.ok(res.estimatedTokensAfter < res.estimatedTokensBefore * 0.3, "Token count should drop drastically");
    assert.equal(res.messages[0].content, "SYSTEM_RULE_KEEP_ME");
    assert.equal(res.messages[1].role, "system");
    assert.ok(res.messages[1].content.includes("Compacted Earlier Conversation"));
    assert.ok(res.messages[1].content.includes("DOGS/dogs.py"), "Summary must preserve referenced file paths");
    assert.equal(res.messages[res.messages.length - 1].content, "RECENT_TAIL_KEEP_ME");
    assert.equal(res.messages.length, 1 + 1 + 6);
  });

  test("3. Compaction preserves tool_calls file references in summary", () => {
    const msgs: CompactableMessage[] = [
      { role: "system", content: "sys" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ function: { name: "create_file", arguments: { path: "src/app.ts" } } }],
      },
      { role: "tool", tool_name: "create_file", content: "Created src/app.ts\n" + "A".repeat(12000) },
      { role: "user", content: "Next step" },
      { role: "assistant", content: "Working on it" },
    ];

    const res = compactConversationHistory(msgs, {
      maxContextTokens: 2048,
      thresholdRatio: 0.7,
      keepRecentMessages: 2,
    });

    assert.equal(res.compacted, true);
    assert.ok(res.messages[1].content.includes("src/app.ts"));
    assert.ok(estimateHistoryTokens(res.messages) < res.estimatedTokensBefore);
  });
});
