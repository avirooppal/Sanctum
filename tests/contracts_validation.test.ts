import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_LM_STUDIO_ENDPOINT,
  DEFAULT_WHISPERX_ENDPOINT,
  JAN_STYLE_DOWNLOAD_CATALOG,
  ErrorCodes,
  SanctumApiClient,
} from "../contracts/index.ts";

describe("Contracts & Client Layer Validation (R2)", () => {
  test("contracts exports all pinned default constants", () => {
    assert.equal(DEFAULT_OLLAMA_ENDPOINT, "http://127.0.0.1:11434");
    assert.equal(DEFAULT_LM_STUDIO_ENDPOINT, "http://127.0.0.1:1234/v1");
    assert.equal(DEFAULT_WHISPERX_ENDPOINT, "http://127.0.0.1:8000");
  });

  test("contracts exports full error codes dictionary", () => {
    assert.ok(ErrorCodes.ENGINE_OFFLINE);
    assert.ok(ErrorCodes.WHISPERX_OFFLINE);
    assert.ok(ErrorCodes.OUT_OF_VRAM);
    assert.ok(ErrorCodes.FILE_READ_FAILED);
  });

  test("SanctumApiClient provides expected contract methods", () => {
    assert.equal(typeof SanctumApiClient.fetchModels, "function");
    assert.equal(typeof SanctumApiClient.pullModel, "function");
    assert.equal(typeof SanctumApiClient.checkWhisperX, "function");
    assert.equal(typeof SanctumApiClient.transcribeAudio, "function");
  });

  test("Jan-style download catalog complies with CuratedModel schema", () => {
    for (const model of JAN_STYLE_DOWNLOAD_CATALOG) {
      assert.ok(typeof model.id === "string");
      assert.ok(typeof model.name === "string");
      assert.ok(typeof model.sizeGB === "number");
      assert.ok(["chat", "reasoning", "embedding", "audio"].includes(model.type));
    }
  });
});
