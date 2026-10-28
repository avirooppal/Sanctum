/**
 * Ollama Client with zero synthetic fallbacks and strict observability contracts (ADR 0105).
 */

import { CallCounters, globalCounters } from "../observability/counters.ts";
import { Trace } from "../observability/trace.ts";
import type { ModelIdentity } from "../observability/inspect.ts";

export class EngineUnavailableError extends Error {
  public readonly endpoint?: string;
  public readonly cause?: unknown;
  constructor(message: string, endpoint?: string, cause?: unknown) {
    super(message);
    this.name = "EngineUnavailableError";
    this.endpoint = endpoint;
    this.cause = cause;
  }
}

export interface OllamaSamplingParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  seed?: number;
  maxTokens?: number;
  stop?: string[];
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
}

export interface OllamaChatPayload {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  options?: Record<string, any>;
  think?: boolean;
}

export interface StreamDeltaEvent {
  type: "delta";
  text: string;
}

export interface StreamDoneEvent {
  type: "done";
  text: string;
  engineModel: string;
  doneReason: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
  };
  timings: {
    totalDurationNs?: number;
    loadDurationNs?: number;
    promptEvalDurationNs?: number;
    evalDurationNs?: number;
  };
}

export type StreamOllamaEvent = StreamDeltaEvent | StreamDoneEvent;

export function buildOllamaChatRequest(req: {
  model: string;
  messages: { role: string; content: string }[];
  params?: OllamaSamplingParams;
  stream?: boolean;
}): OllamaChatPayload {
  const options: Record<string, any> = {};
  const p = req.params || {};

  if (p.temperature !== undefined) options.temperature = p.temperature;
  if (p.topP !== undefined) options.top_p = p.topP;
  if (p.topK !== undefined) options.top_k = p.topK;
  if (p.minP !== undefined) options.min_p = p.minP;
  if (p.repeatPenalty !== undefined) options.repeat_penalty = p.repeatPenalty;
  if (p.seed !== undefined) options.seed = p.seed;
  if (p.maxTokens !== undefined) options.num_predict = p.maxTokens;
  if (p.stop !== undefined) options.stop = p.stop;
  if (p.contextSize !== undefined) options.num_ctx = p.contextSize;
  if (p.gpuLayers !== undefined) options.num_gpu = p.gpuLayers;
  if (p.threads !== undefined) options.num_thread = p.threads;

  const payload: OllamaChatPayload = {
    model: req.model,
    messages: req.messages,
    stream: req.stream !== undefined ? req.stream : true,
  };

  if (Object.keys(options).length > 0) {
    payload.options = options;
  }

  return payload;
}

export function parseModelIdentity(modelName: string, rawShow: any): ModelIdentity {
  const modelfile = rawShow?.modelfile || "";
  const details = rawShow?.details || {};
  const modelInfo = rawShow?.model_info || {};

  let blobPath: string | undefined;
  let blobSha256: string | undefined;

  const fromMatch = modelfile.match(/FROM\s+([^\r\n]+)/);
  if (fromMatch) {
    const rawPath = fromMatch[1].trim();
    blobPath = rawPath;
    const shaMatch = rawPath.match(/sha256-([0-9a-fA-F]+)/) || rawPath.match(/sha256:([0-9a-fA-F]+)/);
    if (shaMatch) {
      blobSha256 = shaMatch[1];
    }
  }

  let trainedCtx: number | undefined;
  for (const [k, v] of Object.entries(modelInfo)) {
    if (k.endsWith(".context_length") && typeof v === "number") {
      trainedCtx = v;
      break;
    }
  }

  return {
    engine: "ollama",
    model: modelName,
    blobPath,
    blobSha256,
    family: details.family,
    parameterSize: details.parameter_size,
    quantization: details.quantization_level,
    format: details.format,
    trainedContextLength: trainedCtx,
  };
}

export async function* streamOllamaChat(
  endpoint: string,
  req: {
    model: string;
    messages: { role: string; content: string }[];
    params?: OllamaSamplingParams;
  },
  context: {
    counters?: CallCounters;
    trace?: Trace;
    signal?: AbortSignal;
  } = {}
): AsyncGenerator<StreamOllamaEvent> {
  const counters = context.counters || globalCounters;
  counters.increment("chat");

  const reqSpan = context.trace?.startSpan("engine.request", {
    endpoint,
    model: req.model,
  });

  const body = buildOllamaChatRequest(req);
  const targetUrl = endpoint.replace(/\/$/, "") + "/api/chat";

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: context.signal,
    });
  } catch (err: any) {
    reqSpan?.end("error", { error: err?.message });
    throw new EngineUnavailableError(
      `Failed to connect to local engine at ${targetUrl}: ${err?.message}`,
      targetUrl,
      err
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    reqSpan?.end("error", { statusCode: response.status, body: errorText });
    throw new Error(`Engine returned HTTP ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    reqSpan?.end("error", { message: "No response body returned" });
    throw new EngineUnavailableError("Engine returned empty response body", targetUrl);
  }

  reqSpan?.end("ok", { statusCode: response.status });
  const streamSpan = context.trace?.startSpan("engine.stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let finalEvent: StreamDoneEvent | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let data: any;
        try {
          data = JSON.parse(trimmed);
        } catch {
          // If invalid or truncated chunk, keep going
          continue;
        }

        const delta = data.message?.content;
        if (delta) {
          accumulatedText += delta;
          yield {
            type: "delta",
            text: delta,
          };
        }

        if (data.done) {
          finalEvent = {
            type: "done",
            text: accumulatedText,
            engineModel: data.model || req.model,
            doneReason: data.done_reason || "stop",
            usage: {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
            },
            timings: {
              totalDurationNs: data.total_duration,
              loadDurationNs: data.load_duration,
              promptEvalDurationNs: data.prompt_eval_duration,
              evalDurationNs: data.eval_duration,
            },
          };
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer.trim());
        const delta = data.message?.content;
        if (delta) {
          accumulatedText += delta;
          yield { type: "delta", text: delta };
        }
        if (data.done && !finalEvent) {
          finalEvent = {
            type: "done",
            text: accumulatedText,
            engineModel: data.model || req.model,
            doneReason: data.done_reason || "stop",
            usage: {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
            },
            timings: {
              totalDurationNs: data.total_duration,
              loadDurationNs: data.load_duration,
              promptEvalDurationNs: data.prompt_eval_duration,
              evalDurationNs: data.eval_duration,
            },
          };
        }
      } catch {}
    }

    if (finalEvent) {
      streamSpan?.end("ok", {
        promptTokens: finalEvent.usage.promptTokens,
        completionTokens: finalEvent.usage.completionTokens,
      });
      yield finalEvent;
    } else {
      streamSpan?.end("ok", { tokens: accumulatedText.length });
      yield {
        type: "done",
        text: accumulatedText,
        engineModel: req.model,
        doneReason: "stop",
        usage: {},
        timings: {},
      };
    }
  } catch (err: any) {
    streamSpan?.end("error", { error: err?.message });
    throw err;
  } finally {
    reader.releaseLock();
  }
}
