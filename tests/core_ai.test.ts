import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { splitThinking } from "../core/ai/inference/format.ts";
import { estimateModelFit } from "../core/ai/hardware/fit.ts";
import { PromptTemplates } from "../core/ai/prompts/index.ts";

describe("Core AI Layer Characterization & Tests (R3)", () => {
  test("splitThinking extracts reasoning from think tags cleanly", () => {
    const raw = "<think>\nStep 1: Check memory.\nStep 2: Compare tokens.\n</think>\n\nHere is the answer.";
    const { thinking, answer } = splitThinking(raw);

    assert.equal(thinking, "Step 1: Check memory.\nStep 2: Compare tokens.");
    assert.equal(answer, "Here is the answer.");
  });

  test("splitThinking handles incomplete think tags during active stream", () => {
    const raw = "<think>\nPartial reasoning still thinking...";
    const { thinking, answer } = splitThinking(raw);

    assert.equal(thinking, "Partial reasoning still thinking...");
    assert.equal(answer, "");
  });

  test("splitThinking handles prompt outputs without think tags", () => {
    const raw = "Regular assistant output without reasoning.";
    const { thinking, answer } = splitThinking(raw);

    assert.equal(thinking, "");
    assert.equal(answer, "Regular assistant output without reasoning.");
  });

  test("estimateModelFit calculates VRAM offloading accurately", () => {
    // 8GB model on 12GB VRAM -> fits full
    const fit1 = estimateModelFit(8.0, 12.0);
    assert.equal(fit1.canFitFullVRAM, true);
    assert.equal(fit1.offloadRatio, 1.0);
    assert.equal(fit1.recommendedGpuLayers, 64);

    // 8GB model on 4GB VRAM -> partial offload
    const fit2 = estimateModelFit(8.0, 4.0);
    assert.equal(fit2.canFitFullVRAM, false);
    assert.ok(fit2.offloadRatio < 1.0);
    assert.ok(fit2.recommendedGpuLayers < 64);
  });

  test("PromptTemplates generates formatted system and fallback prompts", () => {
    assert.ok(PromptTemplates.SYSTEM_OFFLINE_ASSISTANT.includes("private local assistant"));
    const ragPrompt = PromptTemplates.SYSTEM_RAG_ASSISTANT("Doc Context A");
    assert.ok(ragPrompt.includes("Doc Context A"));
  });
});
