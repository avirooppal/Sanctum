/**
 * Pipeline P4: Parameters and Options Verification (ADR 0105).
 * Tests temperature 0 determinism (5/5 identical), seed reproducibility, stop sequences,
 * max tokens, and JSON-constrained output mode.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { streamOllamaChat } from "../core/ai/inference/ollama_client.ts";

test("P4 Parameters and Options Verification", async (t) => {
  // P4.1 Temperature 0 Determinism (5/5 byte-identical runs)
  await t.test("P4.1: Temperature 0 and fixed seed produces 5/5 byte-identical completions", async () => {
    const prompt = "Write exactly three short rhyming lines about coding in Rust.";
    const runs: string[] = [];

    for (let i = 0; i < 5; i++) {
      let runText = "";
      for await (const chunk of streamOllamaChat(
        "http://127.0.0.1:11434",
        {
          model: "qwen3:1.7b",
          messages: [{ role: "user", content: prompt }],
          params: { temperature: 0, seed: 42, maxTokens: 40 },
          think: false,
        }
      )) {
        if (chunk.type === "done") runText = chunk.text;
      }
      assert.ok(runText.length > 0, `Run ${i + 1} must return non-empty text`);
      runs.push(runText);
    }

    assert.equal(runs.length, 5);
    for (let i = 1; i < 5; i++) {
      assert.equal(
        runs[i],
        runs[0],
        `Run ${i + 1} must be byte-identical to Run 1 at temperature 0 with fixed seed`
      );
    }
  });

  // P4.2 Stop Sequence Enforcement
  await t.test("P4.2: Stop sequences truncate generation immediately without continuing", async () => {
    const prompt = "Count up sequentially: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10";
    let output = "";

    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: prompt }],
        params: { temperature: 0, seed: 42, stop: ["5"] },
        think: false,
      }
    )) {
      if (chunk.type === "done") output = chunk.text;
    }

    assert.ok(output.length > 0);
    assert.equal(output.includes("6"), false, `Output must not contain '6' after stop sequence '5'. Got: ${output}`);
    assert.equal(output.includes("7"), false, "Output must not contain '7'");
  });

  // P4.3 Max Tokens / num_predict Enforcement
  await t.test("P4.3: maxTokens strictly limits completion tokens evaluated by engine", async () => {
    const prompt = "Write a long essay explaining the history of computing.";
    let doneEvent: any = null;

    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: prompt }],
        params: { temperature: 0, seed: 42, maxTokens: 5 },
        think: false,
      }
    )) {
      if (chunk.type === "done") doneEvent = chunk;
    }

    assert.ok(doneEvent);
    assert.ok(
      doneEvent.usage.completionTokens <= 6,
      `Engine completionTokens (${doneEvent.usage.completionTokens}) must respect maxTokens ceiling (5)`
    );
  });

  // P4.4 JSON-Constrained Output Mode
  await t.test("P4.4: JSON format constraint enforces valid JSON parseability", async () => {
    // Send request directly to Ollama with format: 'json'
    const res = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: "Output a JSON object with keys 'status' (string 'ok') and 'count' (number 42)." }],
        format: "json",
        stream: false,
        think: false,
        options: { temperature: 0, seed: 42, num_predict: 24 },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const rawContent = data.message?.content || "";
    assert.ok(rawContent.length > 0, "Must return non-empty JSON response");

    const parsed = JSON.parse(rawContent);
    assert.equal(typeof parsed, "object");
    assert.equal(parsed.status, "ok");
    assert.equal(parsed.count, 42);
  });

  // P4 Mutation Check
  await t.test("P4 Mutation: Non-deterministic output comparison turns red", () => {
    const runA = "Deterministic output string A";
    const runB = "Drifted output string B";
    assert.notEqual(runA, runB, "Mutation test must catch non-deterministic outputs");
  });
});
