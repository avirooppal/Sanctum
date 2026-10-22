import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createNewThread, createMessage } from "../core/domain/threads.ts";
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
});
