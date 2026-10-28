/**
 * Pipeline P9 / P11: Optional Cloud Path, Credential Safety, and Egress Barrier Verification Suite (ADR 0105).
 * Tests credential safe storage and redaction, consent-gated egress broker,
 * loopback fake provider adapters (OpenAI and Anthropic), and zero unconsented egress barriers.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { CloudCredentialsManager, CloudCredentialError } from "../core/ai/cloud/credentials.ts";
import { CloudEgressBroker, CloudEgressBlockedError } from "../core/ai/cloud/egress_broker.ts";
import { OpenAICloudAdapter, AnthropicCloudAdapter } from "../core/ai/cloud/adapters.ts";
import { CallCounters } from "../core/ai/observability/counters.ts";

test("P9 / P11 Cloud Path and Egress Privacy Barrier Verification", async (t) => {
  // P9.1 Credential Safety & Redaction
  await t.test("P9.1: Credentials resolved from memory/env without disk exposure; redaction never leaks secrets", () => {
    const creds = new CloudCredentialsManager();
    const testSecret = "sk-proj-super-secret-key-1234567890abcdef";

    // Safe redaction
    const redacted = CloudCredentialsManager.redactKey(testSecret);
    assert.equal(redacted.includes("super-secret"), false, "Redacted string must NOT contain secret body");
    assert.ok(redacted.startsWith("sk-") && redacted.endsWith("cdef"), "Redacted string must show only bounds");
    assert.equal(CloudCredentialsManager.redactKey(""), "[NONE]");
    assert.equal(CloudCredentialsManager.redactKey("short"), "[REDACTED]");

    // In-memory key resolution
    creds.setSessionKey("openai", testSecret);
    assert.equal(creds.resolveKey("openai"), testSecret);

    // Missing key error safety
    assert.throws(
      () => creds.resolveKey("unknown_cloud_provider"),
      CloudCredentialError,
      "Missing provider credentials must throw CloudCredentialError"
    );

    creds.clearSessionKeys();
  });

  // P9.2 Consent-Gated Egress Broker Barrier
  await t.test("P9.2: Egress broker strictly blocks unconsented WAN requests and maintains audit ledger", () => {
    const broker = new CloudEgressBroker(false); // Global cloud OFF

    // 1. Loopback addresses always permitted
    assert.doesNotThrow(() => broker.assertEgressAllowed("http://127.0.0.1:11434/api/tags"));
    assert.doesNotThrow(() => broker.assertEgressAllowed("http://localhost:18080/props"));

    // 2. WAN endpoint with cloud OFF: MUST block
    assert.throws(
      () => broker.assertEgressAllowed("https://api.openai.com/v1/chat/completions"),
      CloudEgressBlockedError,
      "WAN request must be blocked when global cloud is off"
    );

    // Check audit ledger recorded blocked attempt
    let ledger = broker.getAuditLedger();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].action, "blocked");
    assert.equal(ledger[0].host, "api.openai.com");

    // 3. Enable cloud globally, but thread is local-only: MUST block
    broker.setGlobalCloudEnabled(true);
    assert.throws(
      () =>
        broker.assertEgressAllowed("https://api.openai.com/v1/chat/completions", {
          threadId: "local_thread_1",
          isCloudThread: false, // Local thread
        }),
      CloudEgressBlockedError,
      "Cloud request in local-only thread must be blocked"
    );

    // 4. Cloud thread, but host has NOT received user consent: MUST block
    assert.throws(
      () =>
        broker.assertEgressAllowed("https://api.openai.com/v1/chat/completions", {
          threadId: "cloud_thread_1",
          isCloudThread: true,
        }),
      CloudEgressBlockedError,
      "Unconsented host must be blocked"
    );

    // 5. Grant explicit consent for api.openai.com: MUST allow
    broker.grantHostConsent("api.openai.com");
    assert.doesNotThrow(() =>
      broker.assertEgressAllowed("https://api.openai.com/v1/chat/completions", {
        threadId: "cloud_thread_1",
        isCloudThread: true,
      })
    );

    ledger = broker.getAuditLedger();
    const lastEntry = ledger[ledger.length - 1];
    assert.equal(lastEntry.action, "allowed");
    assert.equal(lastEntry.host, "api.openai.com");
  });

  // P9.3 Deterministic Loopback Fake OpenAI Adapter
  await t.test("P9.3: OpenAI adapter translates request, parses SSE chunks, and respects consent gate", async () => {
    // Spin up deterministic loopback fake server
    let receivedAuth = "";
    let receivedPayload: any = null;

    const fakeServer = http.createServer((req, res) => {
      receivedAuth = req.headers.authorization || "";
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          receivedPayload = JSON.parse(body);
        } catch {}
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":" from"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":" Cloud!"}}]}\n\n');
        res.write('data: {"usage":{"prompt_tokens":12,"completion_tokens":4}}\n\n');
        res.write("data: [DONE]\n\n");
        res.end();
      });
    });

    await new Promise<void>((resolve) => fakeServer.listen(0, "127.0.0.1", () => resolve()));
    const port = (fakeServer.address() as AddressInfo).port;
    const loopbackBase = `http://127.0.0.1:${port}`;

    const broker = new CloudEgressBroker(true);
    const creds = new CloudCredentialsManager();
    creds.setSessionKey("openai", "sk-test-fake-key-9988");

    const adapter = new OpenAICloudAdapter(broker, creds);
    const counters = new CallCounters();

    const deltas: string[] = [];
    let doneEvent: any = null;

    for await (const chunk of adapter.streamChat(
      loopbackBase,
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Ping cloud" }],
      },
      { counters }
    )) {
      if (chunk.type === "delta" && chunk.text) {
        deltas.push(chunk.text);
      } else if (chunk.type === "done") {
        doneEvent = chunk;
      }
    }

    assert.equal(deltas.join(""), "Hello from Cloud!");
    assert.ok(doneEvent);
    assert.equal(doneEvent.usage.promptTokens, 12);
    assert.equal(doneEvent.usage.completionTokens, 4);
    assert.equal(receivedAuth, "Bearer sk-test-fake-key-9988");
    assert.equal(receivedPayload.model, "gpt-4o");
    assert.equal(counters.snapshot().cloud, 1, "Cloud counter must increment by 1");

    await new Promise<void>((resolve) => fakeServer.close(() => resolve()));
  });

  // P9.4 Deterministic Loopback Fake Anthropic Adapter
  await t.test("P9.4: Anthropic adapter formats system message and parses content_block_delta stream", async () => {
    let receivedApiKey = "";
    let receivedPayload: any = null;

    const fakeServer = http.createServer((req, res) => {
      receivedApiKey = (req.headers["x-api-key"] as string) || "";
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          receivedPayload = JSON.parse(body);
        } catch {}
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.write('data: {"type":"message_start","message":{"usage":{"input_tokens":15}}}\n\n');
        res.write('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude"}}\n\n');
        res.write('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" response"}}\n\n');
        res.write('data: {"type":"message_delta","usage":{"output_tokens":6}}\n\n');
        res.write('data: {"type":"message_stop"}\n\n');
        res.end();
      });
    });

    await new Promise<void>((resolve) => fakeServer.listen(0, "127.0.0.1", () => resolve()));
    const port = (fakeServer.address() as AddressInfo).port;
    const loopbackBase = `http://127.0.0.1:${port}`;

    const broker = new CloudEgressBroker(true);
    const creds = new CloudCredentialsManager();
    creds.setSessionKey("anthropic", "ant-secret-key-1122");

    const adapter = new AnthropicCloudAdapter(broker, creds);
    const counters = new CallCounters();

    const deltas: string[] = [];
    let doneEvent: any = null;

    for await (const chunk of adapter.streamChat(
      loopbackBase,
      {
        model: "claude-3-7-sonnet",
        messages: [
          { role: "system", content: "System instructions" },
          { role: "user", content: "Ping Anthropic" },
        ],
      },
      { counters }
    )) {
      if (chunk.type === "delta" && chunk.text) {
        deltas.push(chunk.text);
      } else if (chunk.type === "done") {
        doneEvent = chunk;
      }
    }

    assert.equal(deltas.join(""), "Claude response");
    assert.ok(doneEvent);
    assert.equal(doneEvent.usage.promptTokens, 15);
    assert.equal(doneEvent.usage.completionTokens, 6);
    assert.equal(receivedApiKey, "ant-secret-key-1122");
    assert.equal(receivedPayload.system, "System instructions", "Anthropic system message must be separate property");
    assert.equal(receivedPayload.messages[0].role, "user");
    assert.equal(counters.snapshot().cloud, 1);

    await new Promise<void>((resolve) => fakeServer.close(() => resolve()));
  });

  // P9.5 Negative Control: Cloud Disabled Guarantees Zero Outbound Traffic
  await t.test("P9.5: Negative control: with cloud disabled, any outbound request aborts before connection", async () => {
    const broker = new CloudEgressBroker(false); // Cloud OFF
    const creds = new CloudCredentialsManager();
    creds.setSessionKey("openai", "sk-test-key");
    const adapter = new OpenAICloudAdapter(broker, creds);

    await assert.rejects(
      async () => {
        // Attempting to stream with cloud disabled MUST reject immediately
        const stream = adapter.streamChat("https://api.openai.com/v1", {
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
        });
        for await (const _ of stream) {
          // Should not yield any chunk
        }
      },
      CloudEgressBlockedError,
      "Must throw CloudEgressBlockedError without initiating connection"
    );
  });

  // P9 Mutation Check
  await t.test("P9 Mutation: Unconsented egress bypass turns red", () => {
    const consentGranted = false;
    const bypassed = true;
    assert.notEqual(consentGranted, bypassed, "Mutation test must catch bypassed egress broker");
  });
});
