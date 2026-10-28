/** Decode NDJSON or SSE without losing split UTF-8 characters or the final line. */
export async function* readStreamRecords(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<any> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  const parse = (raw: string) => {
    const line = raw.trim();
    if (!line || line.startsWith(":") || /^(event|id|retry):/.test(line)) return undefined;
    const value = line.replace(/^data:\s*/, "");
    if (value === "[DONE]") return { done: true };
    const record = JSON.parse(value);
    if (record.error) throw new Error(typeof record.error === "string" ? record.error : record.error.message || "Engine stream failed");
    return record;
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const record = parse(line);
        if (record !== undefined) yield record;
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const record = parse(buffer);
      if (record !== undefined) yield record;
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
