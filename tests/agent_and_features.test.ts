import test from "node:test";
import assert from "node:assert/strict";
import { createAgentSlice } from "../src/store/slices/agentSlice.ts";
import { createRagSlice } from "../src/store/slices/ragSlice.ts";
import { globalVectorStore } from "../core/ai/rag/vectorStore.ts";

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

  await t.test("RAG slice supports dynamic chunk size and overlap configuration", () => {
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

    // Upload with configured parameters
    state.uploadDocument("col-default", {
      name: "sample.txt",
      size: 1024,
      type: "txt",
      rawContent: "Sanctum is a sovereign local AI platform designed for offline privacy.",
    });

    assert.equal(state.documents.length, 1);
    assert.equal(state.documents[0].name, "sample.txt");
    assert.ok(state.documents[0].chunks.length > 0);
  });
});
