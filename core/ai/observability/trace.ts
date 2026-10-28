/**
 * Local request tracing (ADR 0105 §4). No network sink exists; records stay in
 * memory and, via an optional sink, in the local trace store. Content is stored
 * as SHA-256 + length unless content capture is explicitly enabled by the owner.
 */

export type SpanStatus = "ok" | "error" | "cancelled";

export interface SpanRecord {
  name: string;
  startMs: number;
  endMs?: number;
  status?: SpanStatus;
  attributes: Record<string, unknown>;
}

export interface ContentRecord {
  label: string;
  sha256: string;
  length: number;
  text?: string;
}

export interface TraceRecord {
  traceId: string;
  name: string;
  createdAt: number; // wall clock ms (for age eviction)
  startMs: number;
  endMs?: number;
  status?: SpanStatus;
  spans: SpanRecord[];
  content: ContentRecord[];
  attributes: Record<string, unknown>;
}

export interface TracerOptions {
  captureContent?: boolean;
  retention?: number; // max traces kept (ADR 0105: default 200, max 2000)
  maxAgeMs?: number; // default 7 days
  clock?: () => number; // wall clock, injectable for tests
  sink?: (record: TraceRecord) => void;
}

const DEFAULT_RETENTION = 200;
const MAX_RETENTION = 2000;
const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

const mono = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function isTraceId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id);
}

export function newTraceId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

export class Span {
  private rec: SpanRecord;
  constructor(rec: SpanRecord) {
    this.rec = rec;
  }
  setAttributes(attrs: Record<string, unknown>): void {
    Object.assign(this.rec.attributes, attrs);
  }
  end(status: SpanStatus = "ok", attrs: Record<string, unknown> = {}): void {
    if (this.rec.endMs !== undefined) return;
    Object.assign(this.rec.attributes, attrs);
    this.rec.status = status;
    this.rec.endMs = mono();
  }
}

export class Trace {
  private rec: TraceRecord;
  private opts: { captureContent: boolean; onEnd: (r: TraceRecord) => void };
  constructor(rec: TraceRecord, opts: { captureContent: boolean; onEnd: (r: TraceRecord) => void }) {
    this.rec = rec;
    this.opts = opts;
  }
  get traceId(): string {
    return this.rec.traceId;
  }
  startSpan(name: string, attributes: Record<string, unknown> = {}): Span {
    const s: SpanRecord = { name, startMs: mono(), attributes: { ...attributes } };
    this.rec.spans.push(s);
    return new Span(s);
  }
  setAttributes(attrs: Record<string, unknown>): void {
    Object.assign(this.rec.attributes, attrs);
  }
  async recordContent(label: string, text: string): Promise<void> {
    const entry: ContentRecord = { label, sha256: await sha256Hex(text), length: text.length };
    if (this.opts.captureContent) entry.text = text;
    this.rec.content.push(entry);
  }
  end(status: SpanStatus = "ok"): void {
    if (this.rec.endMs !== undefined) return;
    this.rec.status = status;
    this.rec.endMs = mono();
    this.opts.onEnd(this.rec);
  }
}

export class Tracer {
  private records = new Map<string, TraceRecord>();
  private opts: Required<Omit<TracerOptions, "sink">> & { sink?: TracerOptions["sink"] };

  constructor(opts: TracerOptions = {}) {
    this.opts = {
      captureContent: opts.captureContent ?? false,
      retention: Math.max(1, Math.min(MAX_RETENTION, opts.retention ?? DEFAULT_RETENTION)),
      maxAgeMs: opts.maxAgeMs ?? SEVEN_DAYS,
      clock: opts.clock ?? (() => Date.now()),
      sink: opts.sink,
    };
  }

  configure(patch: Pick<TracerOptions, "captureContent" | "retention">): void {
    if (patch.captureContent !== undefined) this.opts.captureContent = patch.captureContent;
    if (patch.retention !== undefined) this.opts.retention = Math.max(1, Math.min(MAX_RETENTION, patch.retention));
    this.evict();
  }

  get captureContent(): boolean {
    return this.opts.captureContent;
  }

  startTrace(name: string, attributes: Record<string, unknown> = {}): Trace {
    const rec: TraceRecord = {
      traceId: newTraceId(),
      name,
      createdAt: this.opts.clock(),
      startMs: mono(),
      spans: [],
      content: [],
      attributes: { ...attributes },
    };
    this.records.set(rec.traceId, rec);
    this.evict();
    return new Trace(rec, { captureContent: this.opts.captureContent, onEnd: (r) => this.opts.sink?.(r) });
  }

  get(traceId: string): TraceRecord | undefined {
    return this.records.get(traceId);
  }

  list(): TraceRecord[] {
    return [...this.records.values()];
  }

  clear(): void {
    this.records.clear();
  }

  private evict(): void {
    const cutoff = this.opts.clock() - this.opts.maxAgeMs;
    for (const [id, r] of this.records) if (r.createdAt < cutoff) this.records.delete(id);
    while (this.records.size > this.opts.retention) {
      const oldest = this.records.keys().next().value as string;
      this.records.delete(oldest);
    }
  }
}

/** Process-wide tracer used by the product. Configured from developer.* settings. */
export const globalTracer = new Tracer();
