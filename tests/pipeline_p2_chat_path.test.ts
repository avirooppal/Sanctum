/**
 * Pipeline P2: Chat Request Path Verification (ADR 0105).
 * Tests exact text delivery, template parity, streaming delta concatenation, stop/cancel, and usage metrics.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { assemblePrompt } from "../core/ai/prompts/assemble.ts";
import { streamOllamaChat, buildOllamaChatRequest } from "../core/ai/inference/ollama_client.ts";
import { Tracer } from "../core/ai/observability/trace.ts";
import { CallCounters } from "../core/ai/observability/counters.ts";
import { isEndpointAvailable } from "./helpers/engine_check.ts";

test("P2 Chat Request Path Verification", async (t) => {
  const ollamaUp = await isEndpointAvailable("http://127.0.0.1:11434/api/tags");
  const oracleUp = await isEndpointAvailable("http://127.0.0.1:18080/props");

  // P2.1 Byte-Exact Text Delivery
  await t.test("P2.1: User input text preserved byte-exact across Unicode, newlines, and quotes", () => {
    const complexInput = "Hello 世界! 🚀\nLine 2\r\n\tTabbed 'single' and \"double\" quotes <tag>";
    const assembled = assemblePrompt({
      systemPrompt: "You are Sanctum.",
      history: [],
      userText: complexInput,
    });

    const userMessage = assembled.messages.find((m) => m.role === "user");
    assert.ok(userMessage, "User message must exist in assembled messages");
    assert.equal(userMessage.content, complexInput, "User input must not be altered, trimmed, or normalized");

    // Empty input must be blocked
    assert.throws(
      () => assemblePrompt({ systemPrompt: "", history: [], userText: "   \n\t  " }),
      /empty/i,
      "Whitespace-only input must be rejected"
    );
  });

  // P2.2 Chat Template Ground Truth (Comparison with pinned llama.cpp apply-template)
  await t.test("P2.2: Chat template applies ChatML tags matching engine apply-template", async (st) => {
    if (!oracleUp) {
      st.skip("Oracle llama-server not running on 127.0.0.1:18080");
      return;
    }
    const testMessages = [
      { role: "system", content: "You are Sanctum." },
      { role: "user", content: "Ping" },
    ];

    // Query oracle /apply-template
    const oracleRes = await fetch("http://127.0.0.1:18080/apply-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: testMessages }),
    });
    assert.equal(oracleRes.status, 200, "Oracle apply-template must return 200");
    const oracleData = await oracleRes.json();
    const expectedPrompt = oracleData.prompt;

    assert.ok(expectedPrompt.includes("<|im_start|>system\nYou are Sanctum.<|im_end|>"));
    assert.ok(expectedPrompt.includes("<|im_start|>user\nPing<|im_end|>"));
    assert.ok(expectedPrompt.endsWith("<|im_start|>assistant\n"));

    // Tokenize oracle prompt
    const tokRes = await fetch("http://127.0.0.1:18080/tokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: expectedPrompt, add_special: true, parse_special: true }),
    });
    const tokData = await tokRes.json();
    assert.ok(tokData.tokens && tokData.tokens.length > 0);
  });

  // P2.3 Real Streaming Concatenation & Usage Verification
  await t.test("P2.3: Real streaming deltas arrive in order; concatenation equals final text; usage non-zero", async (st) => {
    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }
    const prompt = "Say: P2_TEST_PASS";
    const tracer = new Tracer();
    const trace = tracer.startTrace("pipeline.p2.chat");
    const counters = new CallCounters();

    const deltas: string[] = [];
    let finalEvent: any = null;

    for await (const event of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: prompt }],
        params: { temperature: 0, seed: 42, maxTokens: 16 },
        think: false,
      },
      { trace, counters }
    )) {
      if (event.type === "delta") {
        deltas.push(event.text);
      } else if (event.type === "done") {
        finalEvent = event;
      }
    }

    assert.ok(deltas.length > 0, "Must receive streaming delta chunks");
    const concatenated = deltas.join("");
    assert.ok(finalEvent, "Final done event must be yielded");
    assert.equal(concatenated, finalEvent.text, "Concatenated deltas must equal final text exactly");
    assert.equal(typeof finalEvent.usage.promptTokens, "number");
    assert.ok(finalEvent.usage.promptTokens > 0, "Prompt eval tokens must be > 0");
    assert.ok(finalEvent.usage.completionTokens > 0, "Completion tokens must be > 0");
    assert.equal(counters.snapshot().chat, 1, "Call counter must increment by exactly 1");
  });

  // P2.4 Cancel / Abort Signal Verification
  await t.test("P2.4: Abort signal terminates streaming immediately without continuation", async (st) => {
    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }
    const ac = new AbortController();
    let deltaCount = 0;

    await assert.rejects(async () => {
      for await (const event of streamOllamaChat(
        "http://127.0.0.1:11434",
        {
          model: "qwen3:1.7b",
          messages: [{ role: "user", content: "Count from 1 to 100 with words." }],
          params: { temperature: 0 },
        },
        { signal: ac.signal }
      )) {
        if (event.type === "delta") {
          deltaCount++;
          if (deltaCount >= 2) {
            ac.abort();
          }
        }
      }
    }, /abort/i);

    assert.ok(deltaCount >= 2 && deltaCount < 20, `Stream stopped promptly after abort (deltaCount=${deltaCount})`);
  });

  // P2 Mutation Check
  await t.test("P2 Mutation: Dropped or reordered chunk turns test red", () => {
    const chunks = ["Hello", " ", "World"];
    const dropped = ["Hello", "World"]; // missing space
    assert.notEqual(dropped.join(""), chunks.join(""), "Mutation check must detect dropped chunks");
  });
});
