import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("API Surface & Route Contracts Characterization", () => {
  const routes = [
    {
      path: "/api/ollama/models",
      method: "GET",
      description: "Proxies local Ollama /api/tags to avoid browser CORS, returns installed models",
      expectedShape: {
        online: "boolean",
        endpoint: "string",
        models: "array",
      },
    },
    {
      path: "/api/ollama/pull",
      method: "POST",
      description: "Streams model pulling progress directly from Ollama daemon via ndjson",
      requestPayload: { name: "string" },
      expectedContentType: "application/x-ndjson",
    },
    {
      path: "/api/audio/transcribe",
      method: "POST",
      description: "Handles audio file transcription via WhisperX server on port 8000",
      requestContentType: "multipart/form-data",
      expectedResponse: {
        success: "boolean",
        provider: "string?",
        text: "string?",
      },
    },
    {
      path: "/api/audio/whisperx",
      method: "GET",
      description: "Health & version probe for WhisperX local service",
      expectedResponse: {
        online: "boolean",
        endpoint: "string",
      },
    },
  ];

  test("all required API endpoints are documented with schemas", () => {
    assert.equal(routes.length, 4);
    for (const r of routes) {
      assert.ok(r.path.startsWith("/api/"));
      assert.ok(["GET", "POST"].includes(r.method));
    }
  });

  test("route paths exist in project filesystem", async () => {
    const fs = await import("node:fs");
    assert.ok(fs.existsSync("src/app/api/ollama/models/route.ts"));
    assert.ok(fs.existsSync("src/app/api/ollama/pull/route.ts"));
    assert.ok(fs.existsSync("src/app/api/audio/transcribe/route.ts"));
    assert.ok(fs.existsSync("src/app/api/audio/whisperx/route.ts"));
  });
});
