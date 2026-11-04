import test from "node:test";
import assert from "node:assert/strict";
import { createAgentSlice } from "../src/store/slices/agentSlice.ts";
import { createRagSlice } from "../src/store/slices/ragSlice.ts";
import { globalVectorStore } from "../core/ai/rag/vectorStore.ts";
import { globalMemoryStore, redactSecrets } from "../core/ai/memory/memory_store.ts";
import { executeWorkspaceToolCall } from "../core/ai/tools/workspace_chat.ts";

test("Autonomous Agent & Features Validation", async (t) => {
  await t.test("Agent slice initializes with valid defaults and persistent structure", () => {
    let state: any = {};
    const set = (updater: any) => {
      const next = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...next };
    };
    const get = () => state;

    const slice = createAgentSlice(set, get, null as any);
    state = { ...slice, activeModelId: "llama3.2", models: [{ id: "llama3.2", name: "Llama 3.2" }] };

    assert.ok(Array.isArray(state.agentRuns), "agentRuns must be an array");
    assert.ok(state.agentRuns.length > 0, "agentRuns has default run");
    assert.equal(typeof state.startAgentTask, "function");
    assert.equal(typeof state.approveNextAction, "function");
    assert.equal(typeof state.skipStep, "function");
    assert.equal(typeof state.retryStep, "function");
  });

  await t.test("startAgentTask generates dynamic concrete steps for code intent", async () => {
    let state: any = {};
    const set = (updater: any) => {
      const next = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...next };
    };
    const get = () => state;

    const slice = createAgentSlice(set, get, null as any);
    state = { ...slice, activeModelId: "llama3.2", models: [{ id: "llama3.2", name: "Llama 3.2" }] };

    await state.startAgentTask("Refactor API auth and write unit tests");
    const active = state.agentRuns.find((r: any) => r.id === state.activeRunId);

    assert.ok(active, "Active run created");
    assert.equal(active.goal, "Refactor API auth and write unit tests");
    assert.ok(active.steps.length >= 3, "Decomposed into at least 3 steps");
    assert.ok(
      active.steps.some((s: any) => s.requiresApproval === true),
      "Safety gate: at least one critical step requires approval"
    );
  });

  await t.test("approveNextAction advances approval-gated step to completed", async () => {
    let state: any = {};
    const set = (updater: any) => {
      const next = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...next };
    };
    const get = () => state;

    const slice = createAgentSlice(set, get, null as any);
    state = { ...slice, activeModelId: "llama3.2", models: [{ id: "llama3.2", name: "Llama 3.2" }] };

    await state.startAgentTask("Execute automated sandbox audit");
    const initialRun = state.agentRuns.find((r: any) => r.id === state.activeRunId);
    const waitingStep = initialRun.steps.find((s: any) => s.status === "waiting_approval");
    assert.ok(waitingStep, "Found waiting_approval step");

    await state.approveNextAction();
    const updatedRun = state.agentRuns.find((r: any) => r.id === state.activeRunId);
    const completedStep = updatedRun.steps.find((s: any) => s.id === waitingStep.id);
    assert.equal(completedStep.status, "completed");
  });

  await t.test("RAG slice supports dynamic chunk size, overlap, and hybrid search", async () => {
    let state: any = {};
    const set = (updater: any) => {
      const next = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...next };
    };
    const get = () => state;

    const slice = createRagSlice(set, get, null as any);
    state = { ...slice };

    assert.equal(state.chunkSize, 800);
    assert.equal(state.overlap, 120);

    state.setChunkSize(400);
    state.setOverlap(60);

    assert.equal(state.chunkSize, 400);
    assert.equal(state.overlap, 60);

    state.uploadDocument("col-default", {
      name: "sample.txt",
      size: 1024,
      type: "txt",
      rawContent: "Sanctum is a sovereign local AI platform designed for offline privacy and hybrid BM25 retrieval.",
    });

    assert.equal(state.documents.length, 1);
    assert.equal(state.documents[0].name, "sample.txt");
    assert.ok(state.documents[0].chunks.length > 0);

    const hybridResults = await globalVectorStore.hybridSearch("sovereign local AI hybrid BM25", 3);
    assert.ok(hybridResults.length > 0, "Hybrid search returns matching document chunk");
  });

  await t.test("LocalMemoryStore supports secret redaction, recall, and wipe", async () => {
    globalMemoryStore.clear();
    const redacted = redactSecrets("My key is sk-1234567890abcdefghijklmnop and token ghp_1234567890abcdefghij1234567890ab");
    assert.ok(!redacted.includes("sk-123456"), "OpenAI secret key redacted");
    assert.ok(!redacted.includes("ghp_123456"), "GitHub token redacted");

    const calcRes = await executeWorkspaceToolCall({
      name: "calculator",
      arguments: { expression: "(12 * 4) + 2" },
    });
    assert.equal(calcRes.ok, true);
    assert.equal(calcRes.result?.result, 50);

    const saveRes = await executeWorkspaceToolCall({
      name: "memory_save",
      arguments: { content: "User prefers TypeScript strict mode and functional components", category: "preference" },
    });
    assert.equal(saveRes.ok, true);

    const recallRes = await executeWorkspaceToolCall({
      name: "memory_recall",
      arguments: { query: "TypeScript strict mode" },
    });
    assert.equal(recallRes.ok, true);
    assert.ok(recallRes.result?.facts?.length >= 1, "Recalled saved preference fact");

    globalMemoryStore.clear();
    assert.equal(globalMemoryStore.listFacts().length, 0, "Memory store wiped cleanly");
  });
});
