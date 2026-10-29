import test from "node:test";
import assert from "node:assert/strict";
import { LocalEngineClient } from "../core/ai/inference/engine.ts";

test("reasoning models display streamed thinking before their answer", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response([
    { message: { thinking: "Checking the document" }, done: false },
    { message: { content: "LANTERN" }, done: false },
    { done: true, eval_count: 12 },
  ].map(value => JSON.stringify(value)).join("\n"));
  try {
    const events = [];
    for await (const event of LocalEngineClient.streamChat("qwen3:1.7b", [])) events.push(event);
    assert.match(events[0].text, /<think>\nChecking the document/);
    assert.equal(events.at(-1)?.text, "<think>\nChecking the document\n</think>\n\nLANTERN");
    assert.equal(events.at(-1)?.isFinished, true);
  } finally { globalThis.fetch = original; }
});

test("empty online engine is distinct from an unreachable engine", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ online: true, models: [] });
    assert.deepEqual(await LocalEngineClient.fetchOllamaModels(), []);
    globalThis.fetch = async () => { throw new Error("connection refused"); };
    await assert.rejects(LocalEngineClient.fetchOllamaModels(), /Cannot reach Ollama/);
  } finally { globalThis.fetch = original; }
});

test("failed model installation retains the daemon's actionable error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"error":"disk quota exceeded"}\n');
  const progress: string[] = [];
  try {
    assert.equal(await LocalEngineClient.pullOllamaModel("test", undefined, (_, status) => progress.push(status)), false);
    assert.match(progress.at(-1)!, /disk quota exceeded/);
  } finally { globalThis.fetch = original; }
});
