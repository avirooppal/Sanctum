/**
 * V0 observability contract tests (ADR 0105 §4).
 * Deterministic: no network except loopback fakes created inside the test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { Tracer, sha256Hex, isTraceId } from "../core/ai/observability/trace.ts";
import { CallCounters } from "../core/ai/observability/counters.ts";
import { redactSecrets, buildSectionAccounting } from "../core/ai/observability/inspect.ts";
import { gateDebugRequest } from "../core/ai/observability/debug_gate.ts";
import { assemblePrompt } from "../core/ai/prompts/assemble.ts";
import {
  buildOllamaChatRequest,
  streamOllamaChat,
  parseModelIdentity,
  EngineUnavailableError,
} from "../core/ai/inference/ollama_client.ts";

// ---------- helpers ----------
function fakeOllama(handler: (body: any, res: http.ServerResponse, url: string) => void) {
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => handler(raw ? JSON.parse(raw) : null, res, req.url || ""));
  });
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

test("Tracer", async (t) => {
  await t.test("traceId is 32 lowercase hex and unique", () => {
    const tr = new Tracer();
    const a = tr.startTrace("chat.send").traceId;
    const b = tr.startTrace("chat.send").traceId;
    assert.ok(isTraceId(a), a);
    assert.notEqual(a, b);
  });

  await t.test("spans record name, timing, status and attributes", async () => {
    const tr = new Tracer();
    const trace = tr.startTrace("chat.send");
    const span = trace.startSpan("engine.request", { model: "m" });
    span.end("ok", { promptTokens: 12 });
    trace.end("ok");
    const rec = tr.get(trace.traceId)!;
    assert.equal(rec.spans.length, 1);
    assert.equal(rec.spans[0].name, "engine.request");
    assert.equal(rec.spans[0].status, "ok");
    assert.equal(rec.spans[0].attributes.model, "m");
    assert.equal(rec.spans[0].attributes.promptTokens, 12);
    assert.ok(rec.spans[0].endMs! >= rec.spans[0].startMs);
  });

  await t.test("content capture OFF stores only sha256 + length, never text", async () => {
    const tr = new Tracer({ captureContent: false });
    const trace = tr.startTrace("chat.send");
    await trace.recordContent("user", "canary-SECRET-4411");
    const json = JSON.stringify(tr.get(trace.traceId));
    assert.ok(!json.includes("canary-SECRET-4411"), "text must not be stored");
    assert.ok(json.includes(await sha256Hex("canary-SECRET-4411")));
  });

  await t.test("content capture ON stores the text", async () => {
    const tr = new Tracer({ captureContent: true });
    const trace = tr.startTrace("chat.send");
    await trace.recordContent("user", "canary-VISIBLE-1");
    assert.ok(JSON.stringify(tr.get(trace.traceId)).includes("canary-VISIBLE-1"));
  });

  await t.test("retention cap evicts oldest traces", () => {
    const tr = new Tracer({ retention: 3 });
    const ids = [1, 2, 3, 4, 5].map(() => tr.startTrace("x").traceId);
    assert.equal(tr.list().length, 3);
    assert.equal(tr.get(ids[0]), undefined);
    assert.ok(tr.get(ids[4]));
  });

  await t.test("age eviction drops records older than maxAgeMs", () => {
    let now = 1_000_000;
    const tr = new Tracer({ maxAgeMs: 1000, clock: () => now });
    const old = tr.startTrace("x").traceId;
    now += 5000;
    tr.startTrace("y");
    assert.equal(tr.get(old), undefined);
  });

  await t.test("sink receives finished traces", () => {
    const seen: string[] = [];
    const tr = new Tracer({ sink: (r) => seen.push(r.traceId) });
    const trace = tr.startTrace("x");
    trace.end("ok");
    assert.deepEqual(seen, [trace.traceId]);
  });
});

test("CallCounters", async (t) => {
  await t.test("negative control: zero when nothing called", () => {
    const c = new CallCounters();
    assert.deepEqual(c.snapshot(), { chat: 0, embedding: 0, reranker: 0, asr: 0, tts: 0, vision: 0, cloud: 0 });
  });
  await t.test("increments only the invoked role", () => {
    const c = new CallCounters();
    c.increment("chat");
    c.increment("chat");
    c.increment("embedding");
    assert.equal(c.snapshot().chat, 2);
    assert.equal(c.snapshot().embedding, 1);
    assert.equal(c.snapshot().cloud, 0);
  });
});

test("Inspect helpers", async (t) => {
  await t.test("redactSecrets masks Authorization, api-key headers and key fields", () => {
    const out = redactSecrets({
      headers: { Authorization: "Bearer sk-live-CANARY", "x-api-key": "CANARY2", "Content-Type": "application/json" },
      body: { api_key: "CANARY3", model: "m", messages: [{ role: "user", content: "hi" }] },
    });
    const s = JSON.stringify(out);
    assert.ok(!s.includes("CANARY"), s);
    assert.ok(s.includes("application/json"));
    assert.ok(s.includes('"model":"m"'));
  });

  await t.test("section accounting sums to the full message content length", () => {
    const p = assemblePrompt({
      systemPrompt: "SYS",
      history: [{ role: "user", content: "a" }, { role: "assistant", content: "bb" }],
      userText: "ccc",
      passages: [{ sourceId: "doc1#0", text: "PASSAGE" }],
    });
    const acc = buildSectionAccounting(p.sections);
    const total = p.messages.reduce((n, m) => n + m.content.length, 0);
    assert.equal(acc.reduce((n, s) => n + s.chars, 0), total);
  });
});

test("Prompt assembly", async (t) => {
  await t.test("system prompt first, history in order, user text byte-exact last", () => {
    const user = "  Ünïcødé ✓\nline2\r\n\ttab  ";
    const p = assemblePrompt({
      systemPrompt: "You are S.",
      history: [{ role: "user", content: "q1" }, { role: "assistant", content: "a1" }],
      userText: user,
    });
    assert.equal(p.messages[0].role, "system");
    assert.equal(p.messages[0].content, "You are S.");
    assert.deepEqual(p.messages.slice(1, 3).map((m) => m.content), ["q1", "a1"]);
    assert.equal(p.messages.at(-1)!.role, "user");
    assert.equal(p.messages.at(-1)!.content, user, "user text must be byte-exact (no trim/normalise)");
  });

  await t.test("retrieved passages are delimited with source ids inside the single system message", () => {
    const p = assemblePrompt({
      systemPrompt: "You are S.",
      history: [],
      userText: "q",
      passages: [
        { sourceId: "a.md#0", text: "alpha" },
        { sourceId: "b.md#3", text: "beta" },
      ],
    });
    const systems = p.messages.filter((m) => m.role === "system");
    assert.equal(systems.length, 1, "exactly one system message");
    const s = systems[0].content;
    assert.ok(s.startsWith("You are S."));
    assert.ok(s.indexOf("[source a.md#0]") < s.indexOf("[source b.md#3]"), "passages in retrieval order");
    assert.ok(s.includes("untrusted"), "documents labelled untrusted");
  });

  await t.test("empty user text is rejected", () => {
    assert.throws(() => assemblePrompt({ systemPrompt: "", history: [], userText: "   \n" }), /empty/i);
  });

  await t.test("empty system prompt is omitted (no blank system message)", () => {
    const p = assemblePrompt({ systemPrompt: "", history: [], userText: "q" });
    assert.equal(p.messages[0].role, "user");
  });
});

test("Ollama client (loopback fake)", async (t) => {
  await t.test("request body carries exact messages and every sampling option", () => {
    const body = buildOllamaChatRequest({
      model: "qwen3:1.7b",
      messages: [{ role: "user", content: "x" }],
      params: { temperature: 0, topP: 0.5, topK: 7, minP: 0.05, repeatPenalty: 1.1, seed: 42, maxTokens: 9, stop: ["END"], contextSize: 2048 },
    });
    assert.deepEqual(body.messages, [{ role: "user", content: "x" }]);
    assert.equal(body.model, "qwen3:1.7b");
    assert.equal(body.stream, true);
    assert.deepEqual(body.options, {
      temperature: 0, top_p: 0.5, top_k: 7, min_p: 0.05, repeat_penalty: 1.1, seed: 42, num_predict: 9, stop: ["END"], num_ctx: 2048,
    });
  });

  await t.test("undefined params are omitted, not sent as null", () => {
    const body = buildOllamaChatRequest({ model: "m", messages: [{ role: "user", content: "x" }], params: { temperature: 0.3 } });
    assert.deepEqual(body.options, { temperature: 0.3 });
  });

  await t.test("streams deltas in order; final text equals concatenation; usage from engine", async () => {
    let received: any = null;
    const srv = await fakeOllama((body, res) => {
      received = body;
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      for (const d of ["Hel", "lo", " wörld", "\n✓"]) {
        res.write(JSON.stringify({ model: body.model, message: { role: "assistant", content: d }, done: false }) + "\n");
      }
      res.end(
        JSON.stringify({
          model: body.model, message: { role: "assistant", content: "" }, done: true, done_reason: "stop",
          prompt_eval_count: 17, eval_count: 4, prompt_eval_duration: 1_000_000, eval_duration: 2_000_000, total_duration: 5_000_000, load_duration: 10,
        }) + "\n"
      );
    });
    const counters = new CallCounters();
    const tr = new Tracer();
    const trace = tr.startTrace("chat.send");
    const deltas: string[] = [];
    let final: any = null;
    for await (const ev of streamOllamaChat(srv.url, { model: "m1", messages: [{ role: "user", content: "hi" }], params: {} }, { counters, trace })) {
      if (ev.type === "delta") deltas.push(ev.text);
      if (ev.type === "done") final = ev;
    }
    await srv.close();
    assert.equal(received.messages[0].content, "hi");
    assert.deepEqual(deltas, ["Hel", "lo", " wörld", "\n✓"]);
    assert.equal(final.text, deltas.join(""));
    assert.equal(final.usage.promptTokens, 17);
    assert.equal(final.usage.completionTokens, 4);
    assert.equal(final.doneReason, "stop");
    assert.equal(final.engineModel, "m1");
    assert.equal(counters.snapshot().chat, 1);
    const spans = tr.get(trace.traceId)!.spans.map((s) => s.name);
    assert.ok(spans.includes("engine.request") && spans.includes("engine.stream"), spans.join(","));
  });

  await t.test("delta split across TCP chunks mid-JSON is reassembled (no drop, no dup)", async () => {
    const srv = await fakeOllama((body, res) => {
      res.writeHead(200);
      const line1 = JSON.stringify({ message: { content: "AB" }, done: false }) + "\n";
      const line2 = JSON.stringify({ message: { content: "CD" }, done: true, done_reason: "stop", prompt_eval_count: 1, eval_count: 2 }) + "\n";
      const all = line1 + line2;
      res.write(all.slice(0, 7));
      setTimeout(() => { res.write(all.slice(7, 30)); setTimeout(() => res.end(all.slice(30)), 5); }, 5);
    });
    let final: any = null;
    const deltas: string[] = [];
    for await (const ev of streamOllamaChat(srv.url, { model: "m", messages: [{ role: "user", content: "q" }], params: {} })) {
      if (ev.type === "delta") deltas.push(ev.text);
      if (ev.type === "done") final = ev;
    }
    await srv.close();
    assert.deepEqual(deltas, ["AB", "CD"]);
    assert.equal(final.text, "ABCD");
  });

  await t.test("engine unreachable throws EngineUnavailableError and yields NO text", async () => {
    const counters = new CallCounters();
    const texts: string[] = [];
    await assert.rejects(async () => {
      for await (const ev of streamOllamaChat("http://127.0.0.1:9", { model: "m", messages: [{ role: "user", content: "q" }], params: {} }, { counters })) {
        if (ev.type === "delta") texts.push(ev.text);
      }
    }, EngineUnavailableError);
    assert.equal(texts.length, 0);
    assert.equal(counters.snapshot().chat, 1, "attempt is counted");
  });

  await t.test("engine HTTP error surfaces status and message, no synthetic reply", async () => {
    const srv = await fakeOllama((_b, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "model 'nope' not found" }));
    });
    await assert.rejects(async () => {
      for await (const _ of streamOllamaChat(srv.url, { model: "nope", messages: [{ role: "user", content: "q" }], params: {} })) { /* drain */ }
    }, /404.*not found/);
    await srv.close();
  });

  await t.test("abort signal cancels the stream", async () => {
    const srv = await fakeOllama((_b, res) => {
      res.writeHead(200);
      res.write(JSON.stringify({ message: { content: "x" }, done: false }) + "\n");
      // never ends
    });
    const ac = new AbortController();
    const deltas: string[] = [];
    await assert.rejects(async () => {
      for await (const ev of streamOllamaChat(srv.url, { model: "m", messages: [{ role: "user", content: "q" }], params: {} }, { signal: ac.signal })) {
        if (ev.type === "delta") { deltas.push(ev.text); ac.abort(); }
      }
    }, /abort/i);
    assert.deepEqual(deltas, ["x"]);
    await srv.close();
  });

  await t.test("model identity parsed from /api/show modelfile FROM line and details", () => {
    const id = parseModelIdentity("qwen3:1.7b", {
      modelfile: "# Modelfile generated by \"ollama show\"\nFROM C:\\Users\\u\\.ollama\\models\\blobs\\sha256-3d0b79\nTEMPLATE x",
      details: { family: "qwen3", parameter_size: "2.0B", quantization_level: "Q4_K_M", format: "gguf" },
      model_info: { "qwen3.context_length": 40960, "general.architecture": "qwen3" },
    });
    assert.equal(id.blobPath, "C:\\Users\\u\\.ollama\\models\\blobs\\sha256-3d0b79");
    assert.equal(id.blobSha256, "3d0b79");
    assert.equal(id.quantization, "Q4_K_M");
    assert.equal(id.trainedContextLength, 40960);
  });
});

test("Debug API gate", async (t) => {
  await t.test("404 when inspect setting is off, regardless of token", () => {
    assert.equal(gateDebugRequest({ enabled: false, presented: "t", expected: "t" }), 404);
  });
  await t.test("401 when token missing or wrong", () => {
    assert.equal(gateDebugRequest({ enabled: true, presented: null, expected: "t" }), 401);
    assert.equal(gateDebugRequest({ enabled: true, presented: "x", expected: "t" }), 401);
  });
  await t.test("200 only with setting on and exact token", () => {
    assert.equal(gateDebugRequest({ enabled: true, presented: "t", expected: "t" }), 200);
  });
  await t.test("empty expected token never authorises", () => {
    assert.equal(gateDebugRequest({ enabled: true, presented: "", expected: "" }), 401);
  });
});
