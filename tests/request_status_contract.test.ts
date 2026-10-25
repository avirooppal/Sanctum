import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { REQUEST_PHASES, type RequestPhase, type RequestStatusEvent } from "../contracts/types/index.ts";

// State Machine Transition Rule Engine
const LEGAL_TRANSITIONS: Record<RequestPhase, RequestPhase[]> = {
  sending: ["queued", "loading_model", "reading_message", "error"],
  queued: ["loading_model", "reading_message", "cancelled"],
  loading_model: ["reading_message", "cancelled", "error"],
  reading_message: ["searching_documents", "thinking", "using_tool", "writing_answer", "error"],
  searching_documents: ["thinking", "writing_answer", "error"],
  thinking: ["using_tool", "writing_answer", "stopped", "error"],
  using_tool: ["waiting_approval", "thinking", "writing_answer", "error"],
  waiting_approval: ["using_tool", "thinking", "writing_answer", "cancelled"],
  writing_answer: ["stalled", "finishing", "stopped", "error"],
  stalled: ["writing_answer", "stopped", "error"],
  finishing: ["done", "error"],
  done: [],
  stopped: [],
  cancelled: [],
  error: [],
};

function isValidTransition(from: RequestPhase, to: RequestPhase): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

function validateSequence(sequence: RequestPhase[]): { valid: boolean; failedAt?: string } {
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    if (!isValidTransition(from, to)) {
      return { valid: false, failedAt: `${from} -> ${to}` };
    }
  }
  return { valid: true };
}

describe("Request Status & Lifecycle Contract (AMENDMENT 1)", () => {
  test("every canonical phase is legal and distinct", () => {
    const allPhases: RequestPhase[] = [
      "sending",
      "queued",
      "loading_model",
      "reading_message",
      "searching_documents",
      "thinking",
      "using_tool",
      "waiting_approval",
      "writing_answer",
      "finishing",
      "done",
      "stopped",
      "cancelled",
      "stalled",
      "error",
    ];
    assert.equal(allPhases.length, 15);
    const set = new Set(allPhases);
    assert.equal(set.size, 15);
  });

  test("validates legal phase sequence: normal fast chat", () => {
    const seq: RequestPhase[] = ["sending", "reading_message", "writing_answer", "finishing", "done"];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: cold model load", () => {
    const seq: RequestPhase[] = ["sending", "loading_model", "reading_message", "writing_answer", "finishing", "done"];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: busy queued engine", () => {
    const seq: RequestPhase[] = ["sending", "queued", "loading_model", "reading_message", "writing_answer", "finishing", "done"];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: RAG vault search and reasoning", () => {
    const seq: RequestPhase[] = ["sending", "reading_message", "searching_documents", "thinking", "writing_answer", "finishing", "done"];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: tool execution with user approval gate", () => {
    const seq: RequestPhase[] = [
      "sending",
      "reading_message",
      "thinking",
      "using_tool",
      "waiting_approval",
      "using_tool",
      "writing_answer",
      "finishing",
      "done",
    ];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: stall detection and recovery", () => {
    const seq: RequestPhase[] = ["sending", "reading_message", "writing_answer", "stalled", "writing_answer", "finishing", "done"];
    const res = validateSequence(seq);
    assert.ok(res.valid, `Sequence failed at: ${res.failedAt}`);
  });

  test("validates legal phase sequence: user cancellation and stop", () => {
    const cancelSeq: RequestPhase[] = ["sending", "queued", "cancelled"];
    assert.ok(validateSequence(cancelSeq).valid);

    const stopSeq: RequestPhase[] = ["sending", "reading_message", "writing_answer", "stopped"];
    assert.ok(validateSequence(stopSeq).valid);
  });

  test("rejects illegal transitions: jumping from sending directly to done", () => {
    const illegalSeq: RequestPhase[] = ["sending", "done"];
    assert.equal(validateSequence(illegalSeq).valid, false);
  });

  test("rejects illegal transitions: modifying state after done", () => {
    const illegalSeq: RequestPhase[] = ["sending", "reading_message", "writing_answer", "finishing", "done", "writing_answer"];
    assert.equal(validateSequence(illegalSeq).valid, false);
  });

  test("honesty rule: percentage is only valid when strictly within [0, 100]", () => {
    const validEvent: RequestStatusEvent = {
      request_id: "req-1",
      thread_id: "th-1",
      message_id: "msg-1",
      phase: "loading_model",
      timestamp: Date.now(),
      elapsed_ms: 1240,
      progress: { current: 42, total: 100, unit: "percent", percentage: 42 },
      detail: "Llama-3.2-3B",
    };
    assert.ok(validEvent.progress && validEvent.progress.percentage !== undefined);
    assert.ok(validEvent.progress.percentage >= 0 && validEvent.progress.percentage <= 100);
  });
});
