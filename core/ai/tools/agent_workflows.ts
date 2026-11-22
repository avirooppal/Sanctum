/**
 * agent_workflows.ts — Anthropic "Building Effective Agents" Workflows:
 *   - #2 Evaluator-Optimizer Auto-Verify (safe command inference for modified scripts)
 *   - #4 Live Task Checklist (lenient normalization for small local models)
 */

export type ChecklistStatus = "pending" | "in_progress" | "done" | "failed";

export interface ChecklistItem {
  id: string;
  text: string;
  status: ChecklistStatus;
}

const VALID_STATUSES = new Set<ChecklistStatus>(["pending", "in_progress", "done", "failed"]);

function normalizeStatus(raw: unknown): ChecklistStatus {
  const s = String(raw || "pending").trim().toLowerCase();
  if (VALID_STATUSES.has(s as ChecklistStatus)) return s as ChecklistStatus;
  if (s === "completed" || s === "complete" || s === "ok" || s === "x" || s === "true") return "done";
  if (s === "running" || s === "active" || s === "working" || s === "doing") return "in_progress";
  if (s === "error" || s === "fail") return "failed";
  return "pending";
}

/**
 * Normalize checklist input from tool arguments.
 * Leniently accepts:
 *  - Array of { id?, text/title/step, status? }
 *  - Array of strings
 *  - JSON-encoded array string
 *  - Markdown checklist string ("- [x] Create folder\n- [ ] Run script")
 */
export function normalizeChecklistItems(raw: unknown): ChecklistItem[] {
  let source: unknown = raw;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("[")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        // Fall through to markdown line parsing
      }
    }
  }

  const result: ChecklistItem[] = [];

  if (Array.isArray(source)) {
    for (let i = 0; i < Math.min(source.length, 20); i++) {
      const entry = source[i];
      if (typeof entry === "string") {
        const text = entry.trim();
        if (text) result.push({ id: `step-${i + 1}`, text, status: "pending" });
      } else if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const text = String(obj.text ?? obj.title ?? obj.step ?? obj.label ?? "").trim();
        if (!text) continue;
        result.push({
          id: String(obj.id || `step-${i + 1}`),
          text,
          status: normalizeStatus(obj.status ?? (obj.done ? "done" : "pending")),
        });
      }
    }
    return result;
  }

  if (typeof source === "string") {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
      if (result.length >= 20) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      const mdMatch = trimmed.match(/^(?:[-*•]|\d+[.)])\s+\[([ xX~!])\]\s+(.*)$/);
      if (mdMatch) {
        const mark = mdMatch[1].toLowerCase();
        const status: ChecklistStatus =
          mark === "x" ? "done" : mark === "~" ? "in_progress" : mark === "!" ? "failed" : "pending";
        result.push({ id: `step-${result.length + 1}`, text: mdMatch[2].trim(), status });
        continue;
      }
      const plainMatch = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (plainMatch) {
        result.push({ id: `step-${result.length + 1}`, text: plainMatch[1].trim(), status: "pending" });
      }
    }
  }

  return result;
}

const UNSAFE_PATH_CHARS = /[;&|`$<>()\r\n"']/;

/**
 * Infer a safe local verification command for a newly created/edited runnable script.
 * Returns null for non-runnable files (Markdown, JSON, CSS, etc.) or unsafe paths.
 */
export function inferVerifyCommandForFile(relativePath: string): string | null {
  const clean = String(relativePath || "").trim();
  if (!clean || UNSAFE_PATH_CHARS.test(clean) || clean.includes("..")) {
    return null;
  }
  const lower = clean.toLowerCase();
  if (lower.endsWith(".py")) {
    return `python "${clean}"`;
  }
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return `node "${clean}"`;
  }
  if (lower.endsWith(".ts")) {
    return `node --experimental-strip-types "${clean}"`;
  }
  return null;
}
