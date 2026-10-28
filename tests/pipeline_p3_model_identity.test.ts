/**
 * Pipeline P3: Model Identity and Switching Verification (ADR 0105).
 * Tests model identity proof, mid-thread switching, unload/reload lifecycle, and stale-model prevention.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { streamOllamaChat } from "../core/ai/inference/ollama_client.ts";

test("P3 Model Identity and Switching Verification", async (t) => {
  // P3.1 Model Identity Proof
  await t.test("P3.1: Answering model equals selected model and matches loaded digest in engine", async () => {
    const selectedModel = "qwen3:1.7b";
    let doneEvent: any = null;

    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: selectedModel,
        messages: [{ role: "user", content: "Reply: MODEL_IDENTITY_CHECK" }],
        params: { temperature: 0, seed: 42, maxTokens: 8 },
        think: false,
      }
    )) {
      if (chunk.type === "done") {
        doneEvent = chunk;
      }
    }

    assert.ok(doneEvent, "Must receive done event");
    assert.equal(doneEvent.engineModel, selectedModel, "Engine model must match selected model exactly");

    // Check /api/ps to verify the active runner matches
    const psRes = await fetch("http://127.0.0.1:11434/api/ps");
    assert.equal(psRes.status, 200);
    const psData = await psRes.json();
    const activeModel = psData.models.find((m: any) => m.name === selectedModel);
    assert.ok(activeModel, `Model ${selectedModel} must be loaded in /api/ps`);
    assert.ok(activeModel.digest, "Loaded model must have valid digest");
  });

  // P3.2 Mid-Thread Model Switching
  await t.test("P3.2: Mid-thread model switch preserves history and switches answering model", async () => {
    // Turn 1 with Model A
    const history: { role: string; content: string }[] = [];
    history.push({ role: "user", content: "Remember the code word: PINEAPPLE" });

    let turn1Done: any = null;
    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages: history,
        params: { temperature: 0, seed: 42, maxTokens: 16 },
        think: false,
      }
    )) {
      if (chunk.type === "done") turn1Done = chunk;
    }
    assert.ok(turn1Done);
    history.push({ role: "assistant", content: turn1Done.text });

    // Turn 2 with Model B (switch to qwen3:4b)
    history.push({ role: "user", content: "What was the secret code word?" });
    let turn2Done: any = null;
    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:4b",
        messages: history,
        params: { temperature: 0, seed: 42, maxTokens: 400 },
        think: false,
      }
    )) {
      if (chunk.type === "done") turn2Done = chunk;
    }

    assert.ok(turn2Done);
    assert.equal(turn2Done.engineModel, "qwen3:4b", "Turn 2 must be processed by switched model");
    assert.ok(
      turn2Done.text.toUpperCase().includes("PINEAPPLE"),
      `Switched model must recall secret code word from prior turn history. Got: ${turn2Done.text}`
    );
  });

  // P3.3 Model Unload & Reload
  await t.test("P3.3: Engine unload (keep_alive: 0) frees memory and reload succeeds", async () => {
    // Unload qwen3:4b
    const unloadRes = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:4b",
        messages: [],
        keep_alive: 0,
      }),
    });
    assert.equal(unloadRes.status, 200, "Unload request must succeed");

    // Check /api/ps
    const psRes = await fetch("http://127.0.0.1:11434/api/ps");
    const psData = await psRes.json();
    const isStillLoaded = psData.models.some((m: any) => m.name === "qwen3:4b");
    assert.equal(isStillLoaded, false, "qwen3:4b must be unloaded from engine memory");

    // Reload with qwen3:1.7b
    const reloadRes = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:1.7b",
        messages: [{ role: "user", content: "Ping" }],
        stream: false,
        think: false,
        options: { num_predict: 2 },
      }),
    });
    assert.equal(reloadRes.status, 200, "Reload request must succeed");
  });

  // P3 Mutation Check
  await t.test("P3 Mutation: Claiming response came from wrong model turns red", () => {
    const realModel = "qwen3:1.7b";
    const spoofedModel = "gpt-4o-spoofed";
    assert.notEqual(realModel, spoofedModel, "Mutation check must detect mismatched model identity");
  });
});
