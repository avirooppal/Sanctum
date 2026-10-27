/**
 * Baseline reality probe (V0). Runs the PRE-FIX engine client against
 * (a) a closed loopback port and (b) the real local Ollama engine, and prints
 * what the product would show. Output is evidence, not a test.
 *
 * Usage: node --experimental-strip-types tools/pipeline/baseline_probe.ts
 */
import { LocalEngineClient } from "../../core/ai/inference/engine.ts";

async function main() {
  // (a) engine unreachable: nothing listens on 127.0.0.1:9 (discard port, closed on Windows)
  const out: Record<string, unknown> = {};
  const deadChunks = [];
  for await (const c of LocalEngineClient.streamChat("qwen3:1.7b", [{ role: "user", content: "canary-7731 hello" }], {
    endpoint: "http://127.0.0.1:9",
  })) {
    deadChunks.push(c);
  }
  out.engine_unreachable = deadChunks;

  // (b) model listing when no endpoint answers
  const g = globalThis as any;
  const realFetch = g.fetch;
  g.fetch = async () => {
    throw new Error("offline");
  };
  out.models_when_offline = await LocalEngineClient.fetchOllamaModels("http://127.0.0.1:9");
  g.fetch = realFetch;

  console.log(JSON.stringify(out, null, 2));
}

main();
