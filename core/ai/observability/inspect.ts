/**
 * "Inspect request" records (ADR 0105 §4). One record per assistant message,
 * holding exactly what was sent to the engine and what came back.
 */
import type { PromptMessage, PromptSection } from "../prompts/assemble.ts";

export interface ModelIdentity {
  engine: "ollama" | "llama-server" | "cloud";
  engineVersion?: string;
  model: string;
  blobPath?: string;
  blobSha256?: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  format?: string;
  trainedContextLength?: number;
  loadedContextLength?: number;
}

export interface SectionAccount {
  kind: PromptSection["kind"];
  label: string;
  messageIndex: number;
  chars: number;
  tokens?: number; // only when an engine tokenizer counted it
}

export interface InspectRecord {
  traceId: string;
  messageId: string;
  createdAt: string;
  endpoint: string; // host:port only, never credentials
  identity: ModelIdentity | null;
  identityError?: string;
  requestBody: unknown; // exact JSON body sent (secrets redacted)
  messages: PromptMessage[];
  sections: SectionAccount[];
  renderedPrompt?: { text: string; source: string } | null; // only when an engine exposes the rendered template
  renderedPromptNote?: string;
  response?: {
    text: string;
    doneReason?: string;
    engineModel?: string;
    usage?: { promptTokens?: number; completionTokens?: number };
    timings?: Record<string, number | undefined>;
  };
  error?: { code: string; message: string };
  contentCaptured: boolean;
}

const SECRET_KEY = /^(authorization|x-api-key|api-key|api_key|apikey|x-goog-api-key|proxy-authorization|password|secret|token|access_token)$/i;

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "***" : redactSecrets(v);
    }
    return out as T;
  }
  return value;
}

export function buildSectionAccounting(sections: PromptSection[]): SectionAccount[] {
  return sections.map((s) => ({ kind: s.kind, label: s.label, messageIndex: s.messageIndex, chars: s.text.length }));
}

/** In-memory store of inspect records for the UI (bounded like traces). */
export class InspectStore {
  private records = new Map<string, InspectRecord>();
  private listeners = new Set<() => void>();
  private cap: number;
  constructor(cap: number = 200) {
    this.cap = cap;
  }
  put(r: InspectRecord): void {
    this.records.delete(r.messageId);
    this.records.set(r.messageId, r);
    while (this.records.size > this.cap) this.records.delete(this.records.keys().next().value as string);
    this.listeners.forEach((l) => l());
  }
  byMessage(messageId: string): InspectRecord | undefined {
    return this.records.get(messageId);
  }
  byTrace(traceId: string): InspectRecord | undefined {
    for (const r of this.records.values()) if (r.traceId === traceId) return r;
    return undefined;
  }
  list(): InspectRecord[] {
    return [...this.records.values()];
  }
  setCap(cap: number): void {
    this.cap = Math.max(1, cap);
  }
  clear(): void {
    this.records.clear();
    this.listeners.forEach((l) => l());
  }
  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const globalInspectStore = new InspectStore();
