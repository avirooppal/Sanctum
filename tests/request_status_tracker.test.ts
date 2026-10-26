import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RequestStatusTracker } from "../core/ai/request_status.ts";
import type { RequestStatusEvent } from "../contracts/types/index.ts";

describe("RequestStatusTracker State Machine", () => {
  test("starts at sending phase and calculates elapsed time", () => {
    const tracker = new RequestStatusTracker({
      requestId: "req-1",
      threadId: "chat-1",
      messageId: "msg-1",
    });

    const initial = tracker.getLastEvent();
    assert.equal(initial.phase, "sending");
    assert.equal(initial.request_id, "req-1");
    assert.equal(typeof initial.elapsed_ms, "number");
    tracker.destroy();
  });

  test("allows valid transitions and emits events", () => {
    const tracker = new RequestStatusTracker({
      requestId: "req-2",
      threadId: "chat-1",
      messageId: "msg-2",
    });

    const received: RequestStatusEvent[] = [];
    tracker.subscribe((evt) => received.push(evt));

    assert.equal(tracker.transition("reading_message"), true);
    assert.equal(tracker.transition("writing_answer", { stats: { tokens_generated: 10, tokens_per_second: 42.5 } }), true);
    assert.equal(tracker.transition("finishing"), true);
    assert.equal(tracker.transition("done"), true);

    const phases = received.map((r) => r.phase);
    assert.deepEqual(phases, ["sending", "reading_message", "writing_answer", "finishing", "done"]);
    tracker.destroy();
  });

  test("rejects invalid transition and terminal mutation", () => {
    const tracker = new RequestStatusTracker({
      requestId: "req-3",
      threadId: "chat-1",
      messageId: "msg-3",
    });

    // sending -> done is illegal
    assert.equal(tracker.transition("done"), false);
    assert.equal(tracker.getCurrentPhase(), "sending");

    assert.equal(tracker.transition("error", { error: { code: "ENGINE_FAIL", message: "Failed", recovery_actions: ["retry"] } }), true);
    // After terminal error, no further transitions allowed
    assert.equal(tracker.transition("writing_answer"), false);
    tracker.destroy();
  });

  test("detects stalls when inactive beyond timeout threshold", async () => {
    const tracker = new RequestStatusTracker({
      requestId: "req-4",
      threadId: "chat-1",
      messageId: "msg-4",
      stallTimeoutMs: 100, // short for test
    });

    tracker.transition("reading_message");
    tracker.transition("writing_answer");

    // Wait 150ms for stall timer
    await new Promise((resolve) => setTimeout(resolve, 160));

    assert.equal(tracker.getCurrentPhase(), "stalled");
    assert.match(tracker.getLastEvent().detail || "", /No response from engine/);

    // Can recover from stalled back to writing_answer
    assert.equal(tracker.transition("writing_answer"), true);
    assert.equal(tracker.getCurrentPhase(), "writing_answer");

    tracker.destroy();
  });
});
