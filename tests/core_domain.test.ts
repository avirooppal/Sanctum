import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createNewThread, createMessage, reconcileThreadSnapshots } from "../core/domain/threads.ts";
import { categorizeModel, determineArchitecture } from "../core/domain/models.ts";
import { determineDocumentType } from "../core/domain/documents.ts";

describe("Core Domain Layer Tests (R4)", () => {
  test("createNewThread creates properly initialized session", () => {
    const thread = createNewThread("test-session-1", "llama3.2", "Custom Title");
    assert.equal(thread.id, "test-session-1");
    assert.equal(thread.modelId, "llama3.2");
    assert.equal(thread.title, "Custom Title");
    assert.equal(thread.messages.length, 0);
  });

  test("createMessage creates valid user and assistant messages with timestamps", () => {
    const msg = createMessage("user", "Hello local AI");
    assert.ok(msg.id.startsWith("msg-"));
    assert.equal(msg.role, "user");
    assert.equal(msg.content, "Hello local AI");
    assert.ok(msg.timestamp.length > 0);
  });

  test("categorizeModel correctly identifies model capabilities from names", () => {
    assert.equal(categorizeModel("qwen2.5-coder:7b"), "coding");
    assert.equal(categorizeModel("deepseek-r1:8b"), "reasoning");
    assert.equal(categorizeModel("llama3.2-vision"), "vision");
    assert.equal(categorizeModel("nomic-embed-text"), "embedding");
    assert.equal(categorizeModel("mistral:7b"), "general");
  });

  test("determineArchitecture identifies model families accurately", () => {
    assert.equal(determineArchitecture("qwen2"), "qwen");
    assert.equal(determineArchitecture("deepseek"), "deepseek");
    assert.equal(determineArchitecture("mistral"), "mistral");
    assert.equal(determineArchitecture("llama"), "llama");
  });

  test("determineDocumentType parses file extensions into recognized types", () => {
    assert.equal(determineDocumentType("report.pdf"), "pdf");
    assert.equal(determineDocumentType("notes.md"), "md");
    assert.equal(determineDocumentType("data.csv"), "csv");
    assert.equal(determineDocumentType("app.tsx"), "code");
    assert.equal(determineDocumentType("plain.txt"), "txt");
  });

  test("REL-02: reconcileThreadSnapshots resolves host newer vs localStorage newer and migrates once", () => {
    const tHost = createNewThread("s-host", "m", "From Host");
    tHost.messages.push(createMessage("user", "host msg"));
    const tLocal = createNewThread("s-local", "m", "From Local");
    tLocal.messages.push(createMessage("user", "local msg"));

    // 1. Host missing, local has data, not migrated -> local migrates to host
    const mig = reconcileThreadSnapshots([], { revision: 0, updatedAt: 100, sessions: [tLocal] }, false);
    assert.equal(mig.winner, "local");
    assert.equal(mig.shouldPushToHost, true);
    assert.equal(mig.snapshot.sessions[0].id, "s-local");

    // 2. Host newer revision wins over older local
    const hostNewer = reconcileThreadSnapshots(
      { revision: 5, updatedAt: 500, sessions: [tHost] },
      { revision: 2, updatedAt: 200, sessions: [tLocal] },
      true
    );
    assert.equal(hostNewer.winner, "host");
    assert.equal(hostNewer.shouldPushToHost, false);
    assert.equal(hostNewer.snapshot.sessions[0].id, "s-host");

    // 3. Local newer revision wins and pushes to host
    const localNewer = reconcileThreadSnapshots(
      { revision: 2, updatedAt: 200, sessions: [tHost] },
      { revision: 6, updatedAt: 600, sessions: [tLocal] },
      true
    );
    assert.equal(localNewer.winner, "local");
    assert.equal(localNewer.shouldPushToHost, true);
    assert.equal(localNewer.snapshot.sessions[0].id, "s-local");
  });
});
