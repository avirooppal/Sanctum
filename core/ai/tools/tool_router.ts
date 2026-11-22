/**
 * tool_router.ts — Anthropic "Building Effective Agents" ACI & Dynamic Tool Routing.
 *
 * 1. Dynamic Tool Routing: Filters the 30+ workspace tools down to the minimal relevant
 *    subset (typically 6–8 tools) per turn so small/medium local models (1.7B–8B) achieve
 *    higher tool-calling accuracy and lower prompt token overhead.
 * 2. Poka-Yoke ACI Helpers: Adds self-correcting recovery hints on tool errors and applies
 *    head+tail output budgeting so large tool outputs never silently overflow num_ctx.
 */

export interface ToolDefLike {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface ToolRoutingContext {
  userPrompt: string;
  planMode?: boolean;
  recentToolNames?: string[];
  hasAttachedDocs?: boolean;
}

const CORE_FILE_TOOLS = new Set([
  "list_directory",
  "read_file",
  "create_file",
  "edit_file",
  "create_directory",
  "search_files",
  "run_command",
  "present_file",
  "set_checklist",
]);

const PLAN_MODE_TOOLS = new Set([
  "list_directory",
  "read_file",
  "read_file_range",
  "search_files",
  "create_file",
  "edit_file",
  "present_file",
]);

const ADVANCED_FILE_TOOLS = new Set([
  "read_file_range",
  "apply_patch",
  "move_path",
  "delete_path",
  "undo_last_action",
]);

const BACKGROUND_AND_LOG_TOOLS = new Set([
  "start_background",
  "read_background_output",
  "stop_background",
  "read_logs",
]);

const KNOWLEDGE_AND_UTILITY_TOOLS = new Set([
  "vault_search",
  "memory_save",
  "memory_recall",
  "calculator",
  "datetime",
]);

const BROWSER_INTENT_RE =
  /\b(https?:\/\/|www\.|browse|browser|website|webpage|web page|open\s+site|scrape|click|screenshot|google|search\s+the\s+web|url|online|internet)\b/i;

const ADVANCED_FILE_INTENT_RE =
  /\b(delete|remove|rm\b|rename|move|mv\b|undo|revert|rollback|patch|diff|lines?\s+\d+|range)\b/i;

const BACKGROUND_LOG_INTENT_RE =
  /\b(background|daemon|dev\s*server|start\s+server|stop\s+server|logs?|audit|crash|stack\s*trace)\b/i;

const KNOWLEDGE_UTILITY_INTENT_RE =
  /\b(remember|memory|recall|vault|document|pdf|calc|calculate|math|date|time|today|now)\b/i;

const ACTION_TOOL_INTENT_RE =
  /\b(create|make|write|edit|update|modify|fix|refactor|patch|delete|remove|rename|move|list|show\s+files|read\s+file|open\s+file|search\s+files|find\s+files|run|execute|compile|build|test|debug|install|check\s+logs|inspect\s+workspace|checklist)\b.*\b(file|folder|dir|directory|project|workspace|code|script|app|test|log|logs|command|terminal|checklist|[a-z0-9_-]+\.(?:py|js|ts|tsx|jsx|json|md|txt|html|css|sh|ps1|cs|go|rs|cpp|c|java))\b|\b(run|execute)\s+([a-z0-9_./\\-]+\.(?:py|js|ts|mjs|sh|ps1)|the\s+(?:code|script|file|tests?))\b|\b(list\s+(?:the\s+)?(?:files|folder|directory|workspace)|what\s+files\s+are)\b/i;

export interface AutoActivationContext {
  planMode?: boolean;
  noProjectMode?: boolean;
  hasAttachedDocs?: boolean;
  recentToolNames?: string[];
}

/**
 * Smart automatic activation: decides whether a prompt needs the agent tool loop
 * or can run directly as fast, zero-overhead chat.
 */
export function shouldActivateAgentTools(
  userPrompt: string,
  ctx: AutoActivationContext = {}
): boolean {
  if (ctx.planMode) return true;
  const prompt = (userPrompt || "").trim();
  if (!prompt) return false;

  // Browser, logs, or explicit memory/math tool intents work even in No Project mode
  if (BROWSER_INTENT_RE.test(prompt)) return true;
  if (BACKGROUND_LOG_INTENT_RE.test(prompt)) return true;
  if (/\b(remember\s+that|save\s+to\s+memory|recall\s+my|calculate\s+\d)\b/i.test(prompt)) return true;

  // If user explicitly chose "No Project", never auto-activate local filesystem tools
  if (ctx.noProjectMode) return false;

  // Pure Q&A on an attached PDF/document without file-editing verbs stays fast direct chat
  if (ctx.hasAttachedDocs && !ACTION_TOOL_INTENT_RE.test(prompt)) return false;

  if (ACTION_TOOL_INTENT_RE.test(prompt)) return true;
  if (ADVANCED_FILE_INTENT_RE.test(prompt) && /\b(file|folder|dir|workspace|\.[a-z]{1,4}\b)/i.test(prompt)) {
    return true;
  }

  // Continue tool mode seamlessly if the immediately preceding turn used tools and user gives a follow-up action
  if (
    Array.isArray(ctx.recentToolNames) &&
    ctx.recentToolNames.length > 0 &&
    /\b(run\s+it|fix\s+it|test\s+it|try\s+again|show\s+me|update\s+it|check\s+it|now\s+run|re-?run)\b/i.test(prompt)
  ) {
    return true;
  }

  return false;
}

/**
 * Dynamically select the minimal relevant subset of tools for a turn.
 * External MCP tools (`mcp__*`) and tools already invoked earlier in the thread are preserved.
 */
export function selectToolsForPrompt<T extends ToolDefLike>(
  allTools: T[],
  ctx: ToolRoutingContext
): T[] {
  const prompt = (ctx.userPrompt || "").trim();
  const allowed = new Set<string>();

  if (ctx.planMode) {
    for (const name of PLAN_MODE_TOOLS) allowed.add(name);
  } else {
    for (const name of CORE_FILE_TOOLS) allowed.add(name);

    if (ADVANCED_FILE_INTENT_RE.test(prompt)) {
      for (const name of ADVANCED_FILE_TOOLS) allowed.add(name);
    }

    if (BACKGROUND_LOG_INTENT_RE.test(prompt)) {
      for (const name of BACKGROUND_AND_LOG_TOOLS) allowed.add(name);
    }

    if (BROWSER_INTENT_RE.test(prompt)) {
      for (const t of allTools) {
        if (t.function.name.startsWith("browser_")) allowed.add(t.function.name);
      }
    }

    if (ctx.hasAttachedDocs || KNOWLEDGE_UTILITY_INTENT_RE.test(prompt)) {
      for (const name of KNOWLEDGE_AND_UTILITY_TOOLS) allowed.add(name);
    }
  }

  // Keep continuity for tools already used in the active conversation
  if (Array.isArray(ctx.recentToolNames)) {
    for (const name of ctx.recentToolNames) {
      if (!ctx.planMode || PLAN_MODE_TOOLS.has(name) || name.startsWith("mcp__")) {
        allowed.add(name);
      }
    }
  }

  // Always preserve explicitly connected external MCP tools
  for (const t of allTools) {
    if (t.function.name.startsWith("mcp__")) {
      allowed.add(t.function.name);
    }
  }

  const filtered = allTools.filter((t) => allowed.has(t.function.name));
  return filtered.length > 0 ? filtered : allTools;
}

/**
 * Budget a tool output string to prevent silent num_ctx truncation on local models.
 * Keeps head + tail so both the beginning (headers/imports) and end (errors/totals) survive.
 */
export function budgetToolOutput(
  output: string,
  maxChars = 8000,
  toolName?: string
): string {
  if (!output || output.length <= maxChars) return output;
  const headChars = Math.floor(maxChars * 0.6);
  const tailChars = Math.floor(maxChars * 0.3);
  const omitted = output.length - headChars - tailChars;
  const hint =
    toolName === "read_file"
      ? "Use read_file_range(path, start_line, end_line) or search_files to inspect specific sections."
      : "Filter or narrow the query/command to inspect specific lines.";
  return `${output.slice(0, headChars)}\n\n[... truncated ${omitted} chars to fit local context window. ${hint} ...]\n\n${output.slice(output.length - tailChars)}`;
}

/**
 * Append a concrete Poka-Yoke recovery hint to common tool errors so small local models
 * self-correct on the next round instead of hallucinating or looping.
 */
export function formatPokaYokeError(toolName: string, rawError: string): string {
  const err = (rawError || "Tool call failed.").trim();
  const lower = err.toLowerCase();

  if (toolName === "edit_file" && (lower.includes("not found") || lower.includes("unique") || lower.includes("match"))) {
    return `${err}\nRecovery hint: Call read_file on this path first to inspect the exact current text, then retry edit_file with an exact unique old_text match.`;
  }

  if (toolName === "create_file" && (lower.includes("exist") || lower.includes("overwrite"))) {
    return `${err}\nRecovery hint: This file already exists. Call read_file to inspect it and use edit_file to modify its contents.`;
  }

  if (
    (toolName === "read_file" || toolName === "read_file_range" || toolName === "delete_path" || toolName === "move_path") &&
    (lower.includes("not found") || lower.includes("enoent") || lower.includes("does not exist"))
  ) {
    return `${err}\nRecovery hint: Call list_directory({ path: "." }) or search_files to check the exact relative file path.`;
  }

  if (toolName === "run_command" && (lower.includes("exit code") || lower.includes("stderr") || lower.includes("error"))) {
    return `${err}\nRecovery hint: Read STDERR carefully, fix the issue in the source file with edit_file, and re-run.`;
  }

  return err;
}
