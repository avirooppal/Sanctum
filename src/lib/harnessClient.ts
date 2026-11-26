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

export type ToolApprovalResponse =
  | boolean
  | { decision?: "approved" | "denied" | "allow_once" | "allow_session" | "deny" | string; approved?: boolean; scope?: string };

export interface ToolActivity {
  id: string;
  callId?: string;
  name: string;
  arguments: Record<string, any>;
  status: "running" | "success" | "error" | "denied";
  result?: string;
  output?: string;
  error?: string;
}

const uiToHarnessSessionMap = new Map<string, { harnessId: string; lastSeq: number; model: string; mode: string }>();

/**
 * Async-generator adapter that runs ALL UI chat turns through the native C# Agent Harness
 * (/v1/sessions + SSE stream) with live streaming, thinking blocks, tool activity cards,
 * and approval prompts.
 */
export async function* streamHarnessChat(
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  opts: {
    uiSessionId?: string;
    workspace?: string;
    planMode?: boolean;
    ragContext?: string;
    numCtx?: number;
    think?: boolean;
    baseUrl?: string;
    token?: string;
    signal?: AbortSignal;
    onSessionId?: (harnessSessionId: string) => void;
    onActivity?: (activity: ToolActivity) => void;
    onApprovalRequest?: (req: { toolName: string; arguments: Record<string, any> }) => Promise<ToolApprovalResponse>;
  } = {}
): AsyncGenerator<{
  text: string;
  isFinished: boolean;
  metrics: { tps: number; ttftMs: number; totalTokens: number; vramUsedGB: number };
}> {
  const base = (opts.baseUrl || "").replace(/\/+$/, "");
  const authHeaders: Record<string, string> = opts.token ? { Authorization: `Bearer ${opts.token}` } : {};
  const mode = opts.planMode ? "plan" : "build";
  const cacheKey = opts.uiSessionId || `ephemeral-${Date.now()}`;
  let mapping = uiToHarnessSessionMap.get(cacheKey);

  if (!mapping || mapping.model !== modelId || mapping.mode !== mode) {
    let workspace = opts.workspace || "";
    if (!workspace && !base) {
      try {
        const wsRes = await fetch("/api/workspace");
        if (wsRes.ok) {
          const ws = await wsRes.json();
          workspace = ws?.root || "";
        }
      } catch {}
    }
    const createRes = await fetch(`${base}/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        title: `Chat (${modelId})`,
        workspace,
        mode,
        autonomy: "auto_reads",
        model: modelId,
        ...(opts.numCtx ? { numCtx: opts.numCtx } : {}),
        ...(typeof opts.think === "boolean" ? { think: opts.think } : {}),
      }),
    });
    if (!createRes.ok) throw new Error(`Failed to create harness session (${createRes.status})`);
    const created = (await createRes.json()) as HarnessSessionSummary;
    mapping = { harnessId: created.sessionId, lastSeq: created.lastSeq || 0, model: modelId, mode };
    uiToHarnessSessionMap.set(cacheKey, mapping);
  }
  opts.onSessionId?.(mapping.harnessId);

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const promptText = opts.ragContext
    ? `[Context]\n${opts.ragContext}\n\n[User Request]\n${lastUser}`
    : lastUser;

  const msgRes = await fetch(`${base}/v1/sessions/${encodeURIComponent(mapping.harnessId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      content: promptText,
      idempotencyKey: `ui-${crypto.randomUUID()}`,
    }),
  });
  if (!msgRes.ok) {
    const err = await msgRes.json().catch(() => ({}));
    throw new Error(err?.error || `Harness message failed (${msgRes.status})`);
  }
  const started = await msgRes.json();
  const startSeq = Math.max(0, (started.seq || mapping.lastSeq) - 1);

  const res = await fetch(
    `${base}/v1/sessions/${encodeURIComponent(mapping.harnessId)}/events?after=${startSeq}`,
    { headers: authHeaders, signal: opts.signal }
  );
  if (!res.ok || !res.body) {
    throw new Error(`Harness event stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let reasoningBuf = "";
  let contentBuf = "";
  let totalTokens = 0;
  let firstTokenAt = 0;
  const startedAt = Date.now();
  const activeTools = new Map<string, { name: string; arguments: Record<string, any> }>();

  const formatCombined = () => {
    if (reasoningBuf && contentBuf) return `<think>${reasoningBuf}</think>\n\n${contentBuf}`;
    if (reasoningBuf) return `<think>${reasoningBuf}</think>`;
    return contentBuf;
  };

  const makeMetrics = () => {
    const elapsedSec = Math.max(0.05, (Date.now() - startedAt) / 1000);
    return {
      tps: totalTokens > 0 ? Math.round((totalTokens / elapsedSec) * 10) / 10 : 0,
      ttftMs: firstTokenAt ? firstTokenAt - startedAt : 0,
      totalTokens,
      vramUsedGB: 0,
    };
  };

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
      let evt: HarnessProtocolEvent;
      try {
        evt = JSON.parse(raw) as HarnessProtocolEvent;
      } catch {
        continue;
      }
      if (evt.seq > mapping.lastSeq) mapping.lastSeq = evt.seq;

      if (evt.type === "reasoning_delta") {
        if (!firstTokenAt) firstTokenAt = Date.now();
        reasoningBuf += String(evt.payload?.delta || "");
        yield { text: formatCombined(), isFinished: false, metrics: makeMetrics() };
      } else if (evt.type === "message_delta") {
        if (!firstTokenAt) firstTokenAt = Date.now();
        contentBuf += String(evt.payload?.delta || "");
        yield { text: formatCombined(), isFinished: false, metrics: makeMetrics() };
      } else if (evt.type === "context_usage") {
        totalTokens = Number(evt.payload?.totalTokens || totalTokens);
      } else if (evt.type === "tool_call_requested") {
        const callId = String(evt.payload?.callId || `tc-${Date.now()}`);
        const toolName = String(evt.payload?.tool || "tool");
        const toolArgs = (evt.payload?.arguments || {}) as Record<string, any>;
        activeTools.set(callId, { name: toolName, arguments: toolArgs });
        opts.onActivity?.({
          id: callId,
          callId,
          name: toolName,
          arguments: toolArgs,
          status: "running",
        });
      } else if (evt.type === "approval_requested") {
        const approvalId = String(evt.payload?.approvalId || "");
        const callId = String(evt.payload?.callId || "");
        const toolName = String(evt.payload?.tool || "tool");
        const argsSha256 = String(evt.payload?.argsSha256 || "");
        const meta = activeTools.get(callId);
        let approved = false;
        let scope = "once";
        if (opts.onApprovalRequest) {
          const resp = await opts.onApprovalRequest({
            toolName,
            arguments: meta?.arguments || { reason: evt.payload?.reason || "" },
          });
          approved =
            typeof resp === "boolean"
              ? resp
              : Boolean(
                  resp?.approved ||
                    resp?.decision === "approved" ||
                    resp?.decision === "allow_once" ||
                    resp?.decision === "allow_session"
                );
          if (typeof resp === "object" && resp?.scope) {
            scope = String(resp.scope);
          } else if (typeof resp === "object" && resp?.decision === "allow_session") {
            scope = "session";
          }
        }
        if (approvalId) {
          await resolveHarnessApproval(approvalId, {
            approved,
            scope,
            callId,
            argsSha256,
          }).catch(() => {});
        }
      } else if (evt.type === "tool_finished") {
        const callId = String(evt.payload?.callId || "");
        const toolName = String(evt.payload?.tool || activeTools.get(callId)?.name || "tool");
        const ok = Boolean(evt.payload?.ok);
        const outObj = evt.payload?.output;
        const output =
          typeof outObj === "string"
            ? outObj
            : outObj?.inline || outObj?.preview || evt.payload?.error || "";
        opts.onActivity?.({
          id: callId || `tc-${Date.now()}`,
          callId,
          name: toolName,
          arguments: activeTools.get(callId)?.arguments || {},
          status: ok ? "success" : "error",
          output: String(output),
        });
      } else if (evt.type === "error") {
        throw new Error(String(evt.payload?.message || "Harness cloud run failed"));
      } else if (evt.type === "run_finished") {
        totalTokens = Number(evt.payload?.totalTokens || totalTokens);
        yield { text: formatCombined(), isFinished: true, metrics: makeMetrics() };
        return;
      }
    }
  }

  yield { text: formatCombined(), isFinished: true, metrics: makeMetrics() };
}
