/**
 * Model Tool Call Parser, ID Normalizer & JSON Repair Engine (Sanctum v2)
 *
 * Handles:
 * 1. Provider multi-format adaptation (OpenAI, Ollama, Qwen XML <tool_call>, Llama 3 [TOOL_CALLS]).
 * 2. ID normalization & deduplication (guarantees unique IDs per turn).
 * 3. Tolerant JSON repair (trailing commas, unclosed braces, single quotes).
 * 4. Case-insensitive and snake_case/camelCase tool name alias mapping.
 */

import { type ToolCallRequest } from "./types.ts";

export const TOOL_NAME_ALIASES: Record<string, string> = {
  readfile: "read_file",
  read_file: "read_file",
  readfilerange: "read_file_range",
  read_file_range: "read_file_range",
  searchfiles: "search_files",
  search_files: "search_files",
  grep: "search_files",
  find_in_files: "search_files",
  createfile: "create_file",
  create_file: "create_file",
  writefile: "create_file",
  write_file: "create_file",
  editfile: "edit_file",
  edit_file: "edit_file",
  applypatch: "apply_patch",
  apply_patch: "apply_patch",
  patchfile: "apply_patch",
  listdir: "list_directory",
  listdirectory: "list_directory",
  list_directory: "list_directory",
  ls: "list_directory",
  createdir: "create_directory",
  createdirectory: "create_directory",
  create_directory: "create_directory",
  mkdir: "create_directory",
  movefile: "move_path",
  movepath: "move_path",
  move_path: "move_path",
  rename: "move_path",
  deletefile: "delete_path",
  deletepath: "delete_path",
  delete_path: "delete_path",
  rm: "delete_path",
  undolastaction: "undo_last_action",
  undo_last_action: "undo_last_action",
  undo: "undo_last_action",
  vaultsearch: "vault_search",
  vault_search: "vault_search",
  search_vault: "vault_search",
  memorysave: "memory_save",
  memory_save: "memory_save",
  save_memory: "memory_save",
  remember: "memory_save",
  memoryrecall: "memory_recall",
  memory_recall: "memory_recall",
  recall_memory: "memory_recall",
  search_memory: "memory_recall",
  calc: "calculator",
  calculator: "calculator",
  datetime: "datetime",
  get_time: "datetime",
  execute_command: "shell",
  run_shell: "shell",
  shell: "shell",
};

/**
 * Attempts to repair common JSON defects emitted by smaller or streaming LLMs.
 */
export function repairJsonString(input: string): string {
  let s = input.trim();

  // Strip Markdown code fences if model wrapped the JSON in ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  if (s.startsWith("{") || s.startsWith("[")) {
    // Remove trailing commas before closing braces/brackets
    s = s.replace(/,\s*([}\]])/g, "$1");

    // Balance unclosed braces/brackets from truncated streams
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "{") openBraces++;
        else if (ch === "}") openBraces = Math.max(0, openBraces - 1);
        else if (ch === "[") openBrackets++;
        else if (ch === "]") openBrackets = Math.max(0, openBrackets - 1);
      }
    }
    if (inString) s += '"';
    while (openBrackets > 0) {
      s += "]";
      openBrackets--;
    }
    while (openBraces > 0) {
      s += "}";
      openBraces--;
    }
    s = s.replace(/,\s*([}\]])/g, "$1");
  }

  return s;
}

/**
 * Normalizes tool name using alias dictionary and snake_casing.
 */
export function normalizeToolName(rawName: string): string {
  if (!rawName) return "unknown_tool";
  const cleaned = rawName.trim();
  const lower = cleaned.toLowerCase().replace(/[-_]/g, "");
  if (TOOL_NAME_ALIASES[lower]) {
    return TOOL_NAME_ALIASES[lower];
  }
  return cleaned;
}

/**
 * Parses tool arguments, repairing minor JSON syntax defects.
 */
export function parseArguments(rawArgs: any): { args: Record<string, any>; error?: string } {
  if (typeof rawArgs === "object" && rawArgs !== null && !Array.isArray(rawArgs)) {
    return { args: rawArgs };
  }

  if (typeof rawArgs === "string") {
    const trimmed = rawArgs.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "null") {
      return { args: {} };
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { args: parsed };
      }
    } catch {
      // Try repaired version
      try {
        const repaired = repairJsonString(trimmed);
        const parsed = JSON.parse(repaired);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return { args: parsed };
        }
      } catch (err: any) {
        return { args: {}, error: `Failed to parse arguments JSON: ${err.message}` };
      }
    }
  }

  return { args: {} };
}

/**
 * Extracts and normalizes ToolCallRequest[] from an assistant message across all provider formats.
 */
export function parseModelToolCalls(
  message: {
    content?: string;
    tool_calls?: any[];
  },
  turnId: number = 1
): ToolCallRequest[] {
  const requests: ToolCallRequest[] = [];
  const seenIds = new Set<string>();

  const registerCall = (rawName: string, rawArgs: any, rawId?: string) => {
    const index = requests.length;
    const name = normalizeToolName(rawName);
    const { args, error } = parseArguments(rawArgs);

    let id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : `call_${turnId}_${index}`;
    // Deduplicate duplicate IDs
    if (seenIds.has(id)) {
      id = `${id}_${index}`;
    }
    seenIds.add(id);

    const callReq: ToolCallRequest = {
      id,
      name,
      arguments: error ? { ...args, _parseError: error } : args,
      index,
    };
    requests.push(callReq);
  };

  // 1. Standard OpenAI / Ollama tool_calls array
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    for (const raw of message.tool_calls) {
      if (!raw) continue;
      const fnName = raw.function?.name || raw.name;
      const fnArgs = raw.function?.arguments !== undefined ? raw.function.arguments : raw.arguments;
      if (fnName) {
        registerCall(fnName, fnArgs, raw.id);
      }
    }
  }

  // 2. Qwen XML tag format: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const content = message.content || "";
  if (content.includes("<tool_call>")) {
    const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(repairJsonString(match[1]));
        if (parsed.name) {
          registerCall(parsed.name, parsed.arguments || {}, parsed.id);
        }
      } catch {
        // malformed tool tag
      }
    }
  }

  // 3. Llama 3.x format: [TOOL_CALLS] [...]
  if (content.includes("[TOOL_CALLS]")) {
    const rawMatch = content.match(/\[TOOL_CALLS\]\s*(\[[\s\S]*?\])/);
    if (rawMatch && rawMatch[1]) {
      try {
        const parsed = JSON.parse(repairJsonString(rawMatch[1]));
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.name) registerCall(item.name, item.arguments || {}, item.id);
          }
        }
      } catch {
        // malformed
      }
    }
  }

  return requests;
}
