import test from "node:test";
import assert from "node:assert/strict";
import { createChatSlice } from "../src/store/slices/chatSlice.ts";
import { LocalEngineClient } from "../core/ai/inference/engine.ts";
import { readStreamRecords } from "../core/ai/inference/stream.ts";
import { InMemoryVectorStore } from "../core/ai/rag/vectorStore.ts";

const metrics = { tps: 1, ttftMs: 1, totalTokens: 1, vramUsedGB: 0 };
function store() {
  let state: any;
  const set = (next: any) => { state = { ...state, ...(typeof next === "function" ? next(state) : next) }; };
  const get = () => state;
  state = { ...createChatSlice(set, get, null as any), models: [{ id: "test", name: "Test", config: {} }], activeModelId: "test", telemetry: {} };
  return { get, set };
}
const response = (text: string) => new Response(text);

test("chat stays bound to its origin, sends session settings, and retry does not duplicate prompts", async () => {
  const original = LocalEngineClient.streamChat;
  const { get, set } = store();
  const calls: any[] = [];
  LocalEngineClient.streamChat = async function* (model, messages, options) {
    calls.push({ model, messages, options });
    get().setActiveSessionId("other");
    yield { text: "answer", isFinished: true, metrics };
  };
  try {
    get().updateSessionParams("chat-default", { temperature: 0, topP: 0.4, systemPrompt: "Be concise" });
    await get().sendMessage("hello");
    assert.equal(get().chatSessions[0].messages[1].content, "answer");
    assert.equal(get().chatSessions[0].messages[1].requestStatus.phase, "done");
    assert.equal(calls[0].options.temperature, 0);
    assert.equal(calls[0].options.topP, 0.4);
    assert.equal(calls[0].messages[0].content, "Be concise");
    get().setActiveSessionId("chat-default");
    get().regenerateLastMessage();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(get().chatSessions[0].messages.length, 2);
    assert.equal(calls[1].messages.filter((m: any) => m.role === "user").length, 1);
    const message = get().chatSessions[0].messages[1];
    get().toggleMessageBookmark("chat-default", message.id);
    assert.equal(get().chatSessions[0].messages[1].bookmarked, true);
  } finally { LocalEngineClient.streamChat = original; get().stopInference(); }
});

test("stop aborts transport, rejects concurrent sends, and cannot overwrite a later request", async () => {
  const original = LocalEngineClient.streamChat;
  const { get } = store();
  let signal: AbortSignal | undefined;
  LocalEngineClient.streamChat = async function* (_, __, options) {
    signal = options?.signal;
    await new Promise(resolve => signal?.addEventListener("abort", resolve, { once: true }));
    yield { text: "must not appear", isFinished: true, metrics };
  };
  try {
    const running = get().sendMessage("hello");
    await get().sendMessage("duplicate");
    assert.equal(get().chatSessions[0].messages.length, 2);
    get().stopInference();
    await running;
    assert.equal(signal?.aborted, true);
    assert.equal(get().chatSessions[0].messages[1].content, "");
    assert.equal(get().chatSessions[0].messages[1].requestStatus.phase, "stopped");
    assert.equal(get().activeTracker, null);
  } finally { LocalEngineClient.streamChat = original; get().stopInference(); }
});

test("stream decoder preserves split Unicode and final records, and surfaces engine errors", async () => {
  const bytes = new TextEncoder().encode('data: {"message":{"content":"世界"}}\n\ndata: [DONE]');
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const records = [];
  for await (const record of readStreamRecords(body)) records.push(record);
  assert.equal(records[0].message.content, "世界");
  assert.equal(records[1].done, true);
  await assert.rejects(async () => { for await (const _ of readStreamRecords(response('{"error":"out of memory"}').body!)) {} }, /out of memory/);
});

test("actual engine client rejects truncated streams and accepts finish_reason length", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => response('{"message":{"content":"partial"}}\n');
    await assert.rejects(async () => { for await (const _ of LocalEngineClient.streamChat("test", [])) {} }, /before completion/);
    globalThis.fetch = async () => response('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"length"}]}');
    const chunks = [];
    for await (const chunk of LocalEngineClient.streamChat("test", [])) chunks.push(chunk);
    assert.equal(chunks.at(-1)?.isFinished, true);
    assert.equal(chunks.at(-1)?.text, "ok");
  } finally { globalThis.fetch = original; }
});

test("downloads require an explicit success record", async () => {
  const original = globalThis.fetch;
  try {
    for (const body of ['{"status":"pulling manifest"}\n', '{"error":"disk full"}\n', '']) {
      globalThis.fetch = async () => response(body);
      assert.equal(await LocalEngineClient.pullOllamaModel("test", undefined, () => {}), false);
    }
    globalThis.fetch = async () => response('{"status":"success"}');
    assert.equal(await LocalEngineClient.pullOllamaModel("test", undefined, () => {}), true);
  } finally { globalThis.fetch = original; }
});

test("retry preserves document attachments and creates unique rapid-fire chat ids", async () => {
  const original = LocalEngineClient.streamChat;
  const { get } = store();
  const contexts: string[] = [];
  LocalEngineClient.streamChat = async function* (_, __, options) {
    contexts.push(options?.ragContext || "");
    yield { text: "answer", isFinished: true, metrics };
  };
  try {
    get().addAttachedDocument({ name: "note.txt", size: 6, content: "CANARY" });
    await get().sendMessage("Read the note");
    get().regenerateLastMessage();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(contexts[1], /CANARY/);
    for (let i = 0; i < 20; i++) get().createNewChatSession();
    const ids = get().chatSessions.map((s: any) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally { LocalEngineClient.streamChat = original; get().stopInference(); }
});

test("collection filtering happens before top-k so other collections cannot leak", () => {
  const vectors = new InMemoryVectorStore();
  vectors.addDocument("private", "private.txt", "canary code red");
  vectors.addDocument("public", "public.txt", "canary code blue");
  const hits = vectors.search("canary code red", 1, -1, new Set(["public"]));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].docId, "public");
  assert.equal(vectors.search("canary", 4, -1, new Set()).length, 0);
});

test("cancelling a blocked stream read releases the reader", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const run = (async () => { for await (const _ of readStreamRecords(stream, controller.signal)) {} })();
  controller.abort();
  await assert.rejects(run, { name: "AbortError" });
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});
