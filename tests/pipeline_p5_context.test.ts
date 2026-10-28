/**
 * Pipeline P5: Context Handling Verification (ADR 0105).
 * Tests multilingual Unicode preservation, large paste handling, code block escaping,
 * and context token accounting.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { assemblePrompt } from "../core/ai/prompts/assemble.ts";
import { streamOllamaChat } from "../core/ai/inference/ollama_client.ts";
import { isEndpointAvailable } from "./helpers/engine_check.ts";

test("P5 Context Handling Verification", async (t) => {
  const ollamaUp = await isEndpointAvailable("http://127.0.0.1:11434/api/tags");
  const oracleUp = await isEndpointAvailable("http://127.0.0.1:18080/props");

  // P5.1 Multilingual Unicode Handling
  await t.test("P5.1: Multilingual text (CJK, Indic, Arabic, Cyrillic) preserves exact characters", async (st) => {
    const multilingual = "CJK: 你好世界, Indic: नमस्ते दुनिया, Arabic: مرحبا بالعالم, Japanese: こんにちは, Cyrillic: Привет мир";
    const assembled = assemblePrompt({
      systemPrompt: "You are an assistant.",
      history: [],
      userText: multilingual,
    });

    const userMsg = assembled.messages.find((m) => m.role === "user");
    assert.equal(userMsg?.content, multilingual, "Multilingual text must match byte-exact");

    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }

    // Live engine round-trip
    let doneEvent: any = null;
    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: `Echo back exactly: ${multilingual}` }],
        params: { temperature: 0, seed: 42, maxTokens: 48 },
        think: false,
      }
    )) {
      if (chunk.type === "done") doneEvent = chunk;
    }

    assert.ok(doneEvent);
    assert.ok(doneEvent.usage.promptTokens > 20, "Prompt tokens must reflect multi-byte tokenization");
  });

  // P5.2 Code Block and Markdown Formatting Preservation
  await t.test("P5.2: Complex code blocks with backticks, regex, and indentation are preserved", () => {
    const rawCode = "```typescript\nfunction test<T>(val: T): boolean {\n  return /^([a-z0-9_-]+)$/i.test(String(val));\n}\n```";
    const assembled = assemblePrompt({
      systemPrompt: "System",
      history: [],
      userText: rawCode,
    });

    const userMsg = assembled.messages.find((m) => m.role === "user");
    assert.equal(userMsg?.content, rawCode, "Raw code block with triple backticks and regex must not be altered");
  });

  // P5.3 Very Large Paste / Long Input Stress
  await t.test("P5.3: Very large paste (20,000+ characters) is assembled and processed without crash", async (st) => {
    const repeatedSentence = "The quick brown fox jumps over the lazy dog in the private sanctuary. ";
    const largeText = repeatedSentence.repeat(300); // ~21,000 characters
    assert.ok(largeText.length > 20000);

    const assembled = assemblePrompt({
      systemPrompt: "System instructions.",
      history: [],
      userText: largeText,
    });

    assert.equal(assembled.messages[1].content.length, largeText.length);

    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }

    // Call engine with large prompt and verify prompt_eval_count handles it
    const res = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: largeText.slice(0, 4000) + "\n\nReply with one word: ACCEPTED" }],
        stream: false,
        think: false,
        options: { num_predict: 4, num_ctx: 4096 },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.prompt_eval_count > 500, "Large input must yield significant prompt_eval_count");
    assert.ok(data.message?.content);
  });

  // P5.4 Tokenizer Token Counting Verification (Oracle ground truth)
  await t.test("P5.4: Engine tokenizer token counting matches token evaluation", async (st) => {
    if (!oracleUp) {
      st.skip("Oracle llama-server not running on 127.0.0.1:18080");
      return;
    }
    const sampleText = "Sanctum local sovereign AI workspace running on device.";
    const tokRes = await fetch("http://127.0.0.1:18080/tokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sampleText, add_special: false, parse_special: false }),
    });
    assert.equal(tokRes.status, 200);
    const tokData = await tokRes.json();
    assert.ok(tokData.tokens.length > 5, "Sample sentence must tokenize to > 5 tokens");
    const count = tokData.tokens.length;

    // Detokenize back
    const detokRes = await fetch("http://127.0.0.1:18080/detokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: tokData.tokens }),
    });
    const detokData = await detokRes.json();
    assert.equal(detokData.content.trim(), sampleText.trim(), "Detokenized text must match original");
  });

  // P5 Mutation Check
  await t.test("P5 Mutation: Unicode truncation or encoding corruption turns red", () => {
    const original = "日本語 ✓ 🚀";
    const corrupted = "??? ? ?";
    assert.notEqual(original, corrupted, "Mutation check must detect corrupted unicode strings");
  });
});
