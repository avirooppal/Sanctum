import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_LM_STUDIO_ENDPOINT,
  DEFAULT_WHISPERX_ENDPOINT,
  JAN_STYLE_DOWNLOAD_CATALOG,
  BENCHMARK_PRESETS,
  HARDWARE_THREAD_OPTIONS,
  ARENA_SPLIT_OPTIONS,
} from "../src/lib/constants.ts";

describe("Application Constants & Contracts Characterization", () => {
  test("default endpoints are pinned", () => {
    assert.equal(DEFAULT_OLLAMA_ENDPOINT, "http://127.0.0.1:11434");
    assert.equal(DEFAULT_LM_STUDIO_ENDPOINT, "http://127.0.0.1:1234/v1");
    assert.equal(DEFAULT_WHISPERX_ENDPOINT, "http://127.0.0.1:8000");
  });

  test("Jan-style curated download catalog contains expected models and categories", () => {
    assert.ok(JAN_STYLE_DOWNLOAD_CATALOG.length >= 8);

    const modelIds = JAN_STYLE_DOWNLOAD_CATALOG.map((m) => m.id);
    assert.ok(modelIds.includes("llama3.2"));
    assert.ok(modelIds.includes("deepseek-r1:8b"));
    assert.ok(modelIds.includes("nomic-embed-text"));
    assert.ok(modelIds.includes("whisper-base"));

    // Every model must have size, type, parameters, and description
    for (const m of JAN_STYLE_DOWNLOAD_CATALOG) {
      assert.ok(m.id && m.name && m.description);
      assert.ok(m.sizeGB > 0);
      assert.ok(["chat", "reasoning", "embedding", "audio"].includes(m.type));
    }
  });

  test("benchmark presets and options are non-empty and well-formed", () => {
    assert.equal(BENCHMARK_PRESETS.length, 3);
    assert.ok(HARDWARE_THREAD_OPTIONS.includes(8));
    assert.ok(ARENA_SPLIT_OPTIONS.some(([id]) => id === "dual"));
  });
});
