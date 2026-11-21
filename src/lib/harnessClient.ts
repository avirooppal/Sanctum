/**
 * Protocol v1 thin client speaking to the host-side Sanctum Harness (/v1/*).
 * Used by both the main workspace window and quick-launch popup.
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

export async function listHarnessTools(): Promise<any[]> {
  const res = await fetch("/v1/tools");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.tools) ? data.tools : [];
}

export async function listHarnessAgents(): Promise<any[]> {
  const res = await fetch("/v1/agents");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.agents) ? data.agents : [];
}

export async function listHarnessRules(): Promise<any[]> {
  const res = await fetch("/v1/rules");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.rules) ? data.rules : [];
}

export async function listHarnessMcpServers(): Promise<any[]> {
  const res = await fetch("/v1/mcp/servers");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.servers) ? data.servers : [];
}

export async function listHarnessSchedules(): Promise<any[]> {
  const res = await fetch("/v1/schedules");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.jobs) ? data.jobs : [];
}

export async function getHarnessSessionContext(sessionId: string): Promise<any | null> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}/context`);
  if (!res.ok) return null;
  return res.json();
}

export async function compactHarnessSession(sessionId: string, keepRecentMessages = 2): Promise<any> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}/compact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keepRecentMessages }),
  });
  if (!res.ok) throw new Error(`Compaction failed (${res.status})`);
  return res.json();
}

export async function discoverHarnessExtensions(workspace: string): Promise<any | null> {
  const res = await fetch(`/v1/extensions?workspace=${encodeURIComponent(workspace)}`);
  if (!res.ok) return null;
  return res.json();
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
