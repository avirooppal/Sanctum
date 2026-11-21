/**
 * TEMPORARY PHASE 1c UI ADAPTER — SCHEDULED FOR REMOVAL IN PHASE 5.
 * Thin Protocol v1 client speaking to the host-side Sanctum Harness (/v1/*).
 * During Phases 1c–4, the host session store is the source of truth whenever /v1/hello is reachable.
 */

export interface HarnessSessionSummary {
  sessionId: string;
  title: string;
  workspace: string;
  mode: "plan" | "build";
  autonomy: "ask_all" | "auto_reads" | "full_auto";
  model: string;
  parentSessionId?: string;
  forkAfterSeq?: number;
  lastSeq: number;
  activeRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HarnessProtocolEvent {
  v: number;
  seq: number;
  ts: string;
  sessionId: string;
  runId?: string;
  type: string;
  payload: Record<string, any>;
}

export async function probeHarness(): Promise<{ available: boolean; protocolVersion?: number }> {
  if (typeof window === "undefined") return { available: false };
  try {
    const res = await fetch("/v1/hello", { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { available: false };
    const data = await res.json();
    return { available: data?.protocolVersion === 1, protocolVersion: data?.protocolVersion };
  } catch {
    return { available: false };
  }
}

export async function listHarnessSessions(): Promise<HarnessSessionSummary[]> {
  const res = await fetch("/v1/sessions");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function getHarnessSession(
  sessionId: string
): Promise<{ session: HarnessSessionSummary; events: HarnessProtocolEvent[] } | null> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createHarnessSession(params: {
  title?: string;
  workspace?: string;
  mode?: "plan" | "build";
  autonomy?: "ask_all" | "auto_reads";
  model?: string;
}): Promise<HarnessSessionSummary> {
  const res = await fetch("/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create harness session (${res.status})`);
  return res.json();
}

export async function sendHarnessMessage(
  sessionId: string,
  content: string,
  idempotencyKey?: string
): Promise<{ sessionId: string; runId: string; seq: number; status: string }> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      idempotencyKey: idempotencyKey || `ui-${crypto.randomUUID()}`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Harness message failed (${res.status})`);
  }
  return res.json();
}

export async function interruptHarnessRun(sessionId: string): Promise<void> {
  await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}/interrupt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `intr-${crypto.randomUUID()}` }),
  }).catch(() => {});
}

export async function resolveHarnessApproval(
  approvalId: string,
  payload: { approved: boolean; scope?: string; callId?: string; argsSha256?: string }
): Promise<Response> {
  return fetch(`/v1/approvals/${encodeURIComponent(approvalId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function streamHarnessEvents(
  sessionId: string,
  afterSeq: number,
  signal: AbortSignal,
  onEvent: (evt: HarnessProtocolEvent) => void
): Promise<void> {
  const res = await fetch(
    `/v1/sessions/${encodeURIComponent(sessionId)}/events?after=${Math.max(0, afterSeq)}`,
    { signal }
  );
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        const evt = JSON.parse(raw) as HarnessProtocolEvent;
        onEvent(evt);
        if (evt.type === "run_finished") return;
      } catch {}
    }
  }
}
