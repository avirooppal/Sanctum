/**
 * Unified Cloud Provider Adapters (ADR 0105 / Pipeline P9).
 * Provides format translation, parameter mapping, and streaming parsers for
 * OpenAI, Anthropic, and Azure OpenAI, with mandatory Egress Broker consent gating.
 */
import { CloudEgressBroker, globalEgressBroker } from "./egress_broker.ts";
import { CloudCredentialsManager, globalCredentialsManager } from "./credentials.ts";
import type { CallCounters } from "../observability/counters.ts";

export interface CloudChatOptions {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CloudStreamEvent {
  type: "delta" | "done" | "error";
  text?: string;
  usage?: { promptTokens: number; completionTokens: number };
  error?: string;
}

export abstract class BaseCloudAdapter {
  protected broker: CloudEgressBroker;
  protected credentials: CloudCredentialsManager;

  constructor(broker?: CloudEgressBroker, credentials?: CloudCredentialsManager) {
    this.broker = broker || globalEgressBroker;
    this.credentials = credentials || globalCredentialsManager;
  }

  public abstract streamChat(
    baseUrl: string,
    req: CloudChatOptions,
    options?: { threadId?: string; counters?: CallCounters; signal?: AbortSignal }
  ): AsyncIterable<CloudStreamEvent>;
}

export class OpenAICloudAdapter extends BaseCloudAdapter {
  public async *streamChat(
    baseUrl: string,
    req: CloudChatOptions,
    options?: { threadId?: string; counters?: CallCounters; signal?: AbortSignal }
  ): AsyncIterable<CloudStreamEvent> {
    const targetUrl = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    // 1. Mandatory consent gate check before network activity
    this.broker.assertEgressAllowed(targetUrl, { threadId: options?.threadId, isCloudThread: true });

    // 2. Resolve credentials safely
    const apiKey = this.credentials.resolveKey("openai");

    if (options?.counters) {
      options.counters.increment("cloud");
    }

    const payload = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      yield { type: "error", error: `OpenAI error ${res.status}: ${errText}` };
      return;
    }

    if (!res.body) {
      yield { type: "error", error: "Empty response body from OpenAI endpoint" };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            yield { type: "done", usage: { promptTokens, completionTokens } };
            return;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || promptTokens;
              completionTokens = parsed.usage.completion_tokens || completionTokens;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: "delta", text: delta };
            }
          } catch {}
        }
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      reader.releaseLock();
    }
  }
}

export class AnthropicCloudAdapter extends BaseCloudAdapter {
  public async *streamChat(
    baseUrl: string,
    req: CloudChatOptions,
    options?: { threadId?: string; counters?: CallCounters; signal?: AbortSignal }
  ): AsyncIterable<CloudStreamEvent> {
    const targetUrl = `${baseUrl.replace(/\/+$/, "")}/messages`;

    // 1. Mandatory consent gate
    this.broker.assertEgressAllowed(targetUrl, { threadId: options?.threadId, isCloudThread: true });

    // 2. Resolve credentials safely
    const apiKey = this.credentials.resolveKey("anthropic");

    if (options?.counters) {
      options.counters.increment("cloud");
    }

    // Separate system message for Anthropic format
    const systemMsg = req.messages.find((m) => m.role === "system")?.content;
    const nonSystem = req.messages.filter((m) => m.role !== "system");

    const payload: Record<string, any> = {
      model: req.model,
      messages: nonSystem,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      stream: true,
    };
    if (systemMsg) payload.system = systemMsg;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      yield { type: "error", error: `Anthropic error ${res.status}: ${errText}` };
      return;
    }

    if (!res.body) {
      yield { type: "error", error: "Empty response body from Anthropic endpoint" };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === "message_start") {
              promptTokens = parsed.message?.usage?.input_tokens || 0;
            } else if (parsed.type === "content_block_delta") {
              const delta = parsed.delta?.text;
              if (delta) yield { type: "delta", text: delta };
            } else if (parsed.type === "message_delta") {
              completionTokens = parsed.usage?.output_tokens || completionTokens;
            } else if (parsed.type === "message_stop") {
              yield { type: "done", usage: { promptTokens, completionTokens } };
              return;
            }
          } catch {}
        }
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      reader.releaseLock();
    }
  }
}
