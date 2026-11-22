/**
 * context_compactor.ts — Automatic Context Compaction for long-horizon local agent runs.
 *
 * Prevents Ollama from silently truncating early context (system rules, initial goals,
 * or Page 1 of attached documents) when multi-step tool outputs approach num_ctx.
 * Runs deterministically with zero extra LLM latency.
 */

export interface CompactableMessage {
  role: string;
  content: string;
  tool_name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
  thinking?: string;
  images?: string[];
  [key: string]: any;
}

export interface CompactionOptions {
  maxContextTokens: number;
  thresholdRatio?: number;
  keepRecentMessages?: number;
}

export interface CompactionResult<T extends CompactableMessage> {
  messages: T[];
  compacted: boolean;
  droppedCount: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
}

export function estimateMessageTokens(msg: CompactableMessage): number {
  let chars = (msg.content || "").length + (msg.thinking || "").length;
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    try {
      chars += JSON.stringify(msg.tool_calls).length;
    } catch {
      chars += 200;
    }
  }
  return Math.ceil(chars / 3.8) + 8;
}

export function estimateHistoryTokens(messages: CompactableMessage[]): number {
  let total = 0;
  for (const m of messages) total += estimateMessageTokens(m);
  return total;
}

function extractMentionedPaths(text: string): string[] {
  const matches = text.match(/\b[a-zA-Z0-9_./\\-]+\.(?:py|ts|tsx|js|jsx|mjs|json|md|pdf|csv|txt|cs|html|css|yml|yaml)\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function buildCompactSummary(middle: CompactableMessage[], maxSummaryChars: number): string {
  const userGoals: string[] = [];
  const toolEvents: string[] = [];
  const touchedFiles = new Set<string>();

  for (const m of middle) {
    const body = String(m.content || "").trim();
    for (const p of extractMentionedPaths(body)) touchedFiles.add(p);

    if (m.role === "user" && body) {
      userGoals.push(`- User: ${body.replace(/\s+/g, " ").slice(0, 180)}`);
    } else if (m.role === "tool") {
      const name = m.tool_name || "tool";
      const firstLine = body.split("\n").find((l) => l.trim().length > 0) || "(empty)";
      toolEvents.push(`- ${name}: ${firstLine.trim().slice(0, 140)}`);
    } else if (m.role === "assistant") {
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        const names = m.tool_calls
          .map((tc: any) => {
            const fn = tc?.function?.name || "tool";
            const p = tc?.function?.arguments?.path;
            if (typeof p === "string") touchedFiles.add(p);
            return p ? `${fn}(${p})` : fn;
          })
          .join(", ");
        toolEvents.push(`- Assistant called: ${names}`);
      } else if (body) {
        toolEvents.push(`- Assistant: ${body.replace(/\s+/g, " ").slice(0, 150)}`);
      }
    }
  }

  const sections: string[] = [
    `[Compacted Earlier Conversation — ${middle.length} earlier messages compressed to fit local context window]`,
  ];

  if (touchedFiles.size > 0) {
    sections.push(`Files referenced: ${Array.from(touchedFiles).slice(0, 15).join(", ")}`);
  }
  if (userGoals.length > 0) {
    sections.push(`Earlier user requests:\n${userGoals.slice(-6).join("\n")}`);
  }
  if (toolEvents.length > 0) {
    sections.push(`Earlier tool & assistant milestones:\n${toolEvents.slice(-10).join("\n")}`);
  }

  const combined = sections.join("\n\n");
  if (combined.length <= maxSummaryChars) return combined;
  return combined.slice(0, maxSummaryChars) + "\n[... summary trimmed ...]";
}

/**
 * Automatically compact older middle messages when estimated tokens cross thresholdRatio * maxContextTokens.
 * Always preserves leading system messages and the most recent `keepRecentMessages` messages verbatim.
 */
export function compactConversationHistory<T extends CompactableMessage>(
  messages: T[],
  options: CompactionOptions
): CompactionResult<T> {
  const maxTokens = Math.max(1024, options.maxContextTokens || 8192);
  const thresholdRatio = options.thresholdRatio ?? 0.7;
  const keepRecent = Math.max(2, options.keepRecentMessages ?? 6);
  const triggerTokens = Math.floor(maxTokens * thresholdRatio);

  const before = estimateHistoryTokens(messages);
  if (before <= triggerTokens || messages.length <= keepRecent + 1) {
    return {
      messages,
      compacted: false,
      droppedCount: 0,
      estimatedTokensBefore: before,
      estimatedTokensAfter: before,
    };
  }

  // Partition into leading system messages, compressible middle, and preserved recent tail
  let firstNonSystem = 0;
  while (firstNonSystem < messages.length && messages[firstNonSystem].role === "system") {
    firstNonSystem++;
  }

  const leadingSystems = messages.slice(0, firstNonSystem);
  const tailStart = Math.max(firstNonSystem, messages.length - keepRecent);
  const middle = messages.slice(firstNonSystem, tailStart);
  const recent = messages.slice(tailStart);

  if (middle.length === 0) {
    return {
      messages,
      compacted: false,
      droppedCount: 0,
      estimatedTokensBefore: before,
      estimatedTokensAfter: before,
    };
  }

  const maxSummaryChars = Math.min(2800, Math.floor(maxTokens * 0.15 * 3.8));
  const summaryText = buildCompactSummary(middle, maxSummaryChars);
  const summaryMsg = {
    role: "system",
    content: summaryText,
  } as T;

  const compactedList = [...leadingSystems, summaryMsg, ...recent];
  const after = estimateHistoryTokens(compactedList);

  return {
    messages: compactedList,
    compacted: true,
    droppedCount: middle.length,
    estimatedTokensBefore: before,
    estimatedTokensAfter: after,
  };
}
