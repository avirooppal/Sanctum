/**
 * Reality probe post-fix (V0). Confirms truthful reporting:
 * - streamChat throws when engine is unreachable (0 synthetic tokens)
 * - fetchOllamaModels returns empty array when offline (0 invented models)
 */
import { LocalEngineClient } from "../../core/ai/inference/engine.ts";

async function main() {
  const out: Record<string, unknown> = {};

  // (a) engine unreachable
  try {
    const deadChunks = [];
    for await (const c of LocalEngineClient.streamChat("qwen3:1.7b", [{ role: "user", content: "canary-7731 hello" }], {
      endpoint: "http://127.0.0.1:9",
    })) {
      deadChunks.push(c);
    }
    out.engine_unreachable = { error_thrown: false, chunks: deadChunks };
  } catch (err: any) {
    out.engine_unreachable = {
      error_thrown: true,
      message: err.message,
      synthetic_fallback_prevented: true,
    };
  }

  // (b) model listing when offline
  const g = globalThis as any;
  const realFetch = g.fetch;
  g.fetch = async () => {
    throw new Error("offline");
  };
  const models = await LocalEngineClient.fetchOllamaModels("http://127.0.0.1:9");
  out.models_when_offline = {
    count: models.length,
    models,
    synthetic_llama_prevented: models.length === 0,
  };
  g.fetch = realFetch;

  console.log(JSON.stringify(out, null, 2));
}

main();
