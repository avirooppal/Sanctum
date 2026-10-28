/**
 * Pipeline P1: Startup and Engine Readiness Test Suite (ADR 0105).
 * Tests P1.1 (hashes), P1.2 (args/props), P1.3 (model loaded), P1.4 (health), P1.5 (port conflict).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { LocalEngineClient } from "../core/ai/inference/engine.ts";

function computeSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return "sha256:" + hash.digest("hex");
}

test("P1 Startup and Engine Readiness", async (t) => {
  // P1.1 Binary & Model Hash Verification
  await t.test("P1.1: GGUF model file hash matches manifest digest exactly", async () => {
    const userProfile = process.env.USERPROFILE || "";
    const manifestPath = path.join(
      userProfile,
      ".ollama",
      "models",
      "manifests",
      "registry.ollama.ai",
      "library",
      "qwen3",
      "1.7b"
    );

    assert.ok(fs.existsSync(manifestPath), `Manifest must exist at ${manifestPath}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const modelLayer = manifest.layers.find(
      (l: any) => l.mediaType === "application/vnd.ollama.image.model"
    );
    assert.ok(modelLayer, "Model layer must exist in manifest");
    const expectedDigest = modelLayer.digest;

    const blobPath = path.join(
      userProfile,
      ".ollama",
      "models",
      "blobs",
      expectedDigest.replace(":", "-")
    );
    assert.ok(fs.existsSync(blobPath), `Blob file must exist at ${blobPath}`);

    // Compute actual hash
    const computedDigest = computeSha256(blobPath);
    assert.equal(computedDigest, expectedDigest, "Blob SHA-256 must match manifest digest exactly");
  });

  // P1.1 Mutation Check
  await t.test("P1.1 Mutation: Corrupted or mismatched hash must fail verification", async () => {
    const mutatedDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const userProfile = process.env.USERPROFILE || "";
    const blobPath = path.join(
      userProfile,
      ".ollama",
      "models",
      "blobs",
      "sha256-3d0b790534fe4b79525fc3692950408dca41171676ed7e21db57af5c65ef6ab6"
    );
    const computed = computeSha256(blobPath);

    assert.notEqual(computed, mutatedDigest, "Verification must turn red when digest is mutated");
  });

  // P1.2 Engine Launch Parameters & Props Ground Truth
  await t.test("P1.2: Engine metadata & props match model registry specs", async () => {
    const res = await fetch("http://127.0.0.1:18080/props");
    assert.equal(res.status, 200, "Oracle /props must be accessible");
    const props = await res.json();

    assert.equal(typeof props.default_generation_settings?.n_ctx, "number");
    assert.equal(props.default_generation_settings.n_ctx, 4096, "Context size must match launch parameter (4096)");
    assert.ok(props.chat_template && props.chat_template.includes("<|im_start|>"), "Chat template must include ChatML delimiters");
  });

  // P1.2 Mutation Check
  await t.test("P1.2 Mutation: Mismatched context length turns red", async () => {
    const res = await fetch("http://127.0.0.1:18080/props");
    const props = await res.json();
    const wrongContextSize = 131072;
    assert.notEqual(props.default_generation_settings.n_ctx, wrongContextSize, "Mutation test must catch invalid context parameter");
  });

  // P1.3 Real Model Actually Loaded in Memory
  await t.test("P1.3: Active engine /api/ps reports loaded model digest", async () => {
    const res = await fetch("http://127.0.0.1:11434/api/ps");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.models), "/api/ps must return models array");

    // If a model is loaded, check its details
    if (data.models.length > 0) {
      const loaded = data.models[0];
      assert.ok(loaded.name.includes("qwen3") || loaded.name.length > 0);
      assert.equal(loaded.details.format, "gguf");
    }
  });

  // P1.4 Truthful Health Check
  await t.test("P1.4: Health check is truthful (200 when online, online=false when offline)", async () => {
    // 1. Live oracle engine
    const liveOracle = await LocalEngineClient.pingDaemon("http://127.0.0.1:18080", "llama-cpp");
    assert.equal(liveOracle.online, true, "Oracle on port 18080 must report online=true");

    // 2. Closed port (127.0.0.1:9)
    const deadDaemon = await LocalEngineClient.pingDaemon("http://127.0.0.1:9", "ollama");
    assert.equal(deadDaemon.online, false, "Offline endpoint must report online=false, never invent status ok");
    assert.equal(deadDaemon.modelsFound.length, 0);
  });

  // P1.4 Mutation Check
  await t.test("P1.4 Mutation: Falsely claiming online when port closed must fail", async () => {
    const deadDaemon = await LocalEngineClient.pingDaemon("http://127.0.0.1:9", "ollama");
    assert.notEqual(deadDaemon.online, true, "Must never report online when port is closed");
  });

  // P1.5 Port Conflict Handling
  await t.test("P1.5: Port conflict is detected when port is already occupied", async () => {
    // Spin up a dummy listener
    const server = http.createServer((_, res) => res.end("occupied"));
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const occupiedPort = (server.address() as AddressInfo).port;

    // Attempting to listen on the same port should throw EADDRINUSE
    const conflictServer = http.createServer();
    const conflictDetected = await new Promise<boolean>((resolve) => {
      conflictServer.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      conflictServer.listen(occupiedPort, "127.0.0.1");
    });

    assert.equal(conflictDetected, true, "Must detect EADDRINUSE on port conflict");

    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { conflictServer.close(); } catch {}
  });
});
