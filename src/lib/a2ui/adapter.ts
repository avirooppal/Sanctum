/**
 * Version-pinned A2UI v0.9.1 UI Adapter (single module isolating protocol version).
 * Zero network calls, no dynamic code execution, zero remote asset loading.
 */

export const A2UI_PINNED_VERSION = "0.9.1";
export const A2UI_MAX_COMPONENTS = 50;
export const A2UI_MAX_DEPTH = 8;
export const A2UI_MAX_STRING_LEN = 4096;
export const A2UI_AUTO_VALIDITY_THRESHOLD = 0.70;
export const A2UI_MAX_CONSECUTIVE_FAILURES = 3;

export type RichRepliesMode = "off" | "auto" | "always";

export const SANCTUM_A2UI_CATALOG = [
  "Column",
  "Row",
  "Card",
  "Text",
  "Button",
  "TextField",
  "Checkbox",
  "Select",
  "Table",
  "FileCard",
  "DiffSummary",
  "TodoList",
  "CodeBlock",
  "Citations",
  "TerminalOutput",
] as const;

export type SanctumA2uiComponentType = (typeof SANCTUM_A2UI_CATALOG)[number];
const ALLOWED_SET = new Set<string>(SANCTUM_A2UI_CATALOG);

export interface A2uiComponentNode {
  id: string;
  type: SanctumA2uiComponentType;
  props: Record<string, any>;
}

export interface A2uiSurfacePayload {
  a2uiVersion: string;
  surfaceId: string;
  summaryText?: string;
  components: A2uiComponentNode[];
  dataModel?: Record<string, any>;
}

export interface A2uiValidationResult {
  ok: boolean;
  code: string;
  error?: string;
  surface?: A2uiSurfacePayload;
  markdownFallback: string;
}

const UNSAFE_SCHEME = /(?:javascript:|vbscript:|file:\/\/|data:text\/html)/i;
const UNSAFE_HTML = /<\s*script\b|on(?:error|load|click|mouseover)\s*=/i;

export function shouldEnableRichReplies(
  mode: RichRepliesMode,
  measuredValidityRate: number | null | undefined,
  consecutiveFailures: number
): { enabled: boolean; reason: string } {
  if (consecutiveFailures >= A2UI_MAX_CONSECUTIVE_FAILURES) {
    return { enabled: false, reason: `Auto-disabled after ${consecutiveFailures} consecutive A2UI failures.` };
  }
  if (mode === "off") return { enabled: false, reason: "Rich replies disabled in settings." };
  if (mode === "always") return { enabled: true, reason: "Rich replies forced Always." };
  if (typeof measuredValidityRate === "number" && measuredValidityRate >= A2UI_AUTO_VALIDITY_THRESHOLD) {
    return { enabled: true, reason: `Auto enabled (measured validity ${Math.round(measuredValidityRate * 100)}%).` };
  }
  return { enabled: false, reason: "Auto disabled: model has not reached >=70% measured A2UI validity on this machine." };
}

export function buildCompactA2uiPromptBlock(): string {
  return [
    `[Rich Replies (A2UI v${A2UI_PINNED_VERSION})]:`,
    `When a form, comparison table, todo list, file card, diff summary, code block, or citations clearly help, call render_ui alongside a 1-2 sentence text answer. Use plain markdown otherwise.`,
    `Allowed types: ${SANCTUM_A2UI_CATALOG.join(", ")}. Never emit HTML, scripts, remote images, password fields, or approval prompts.`,
  ].join("\n");
}

function checkDepthAndStrings(val: any, depth: number): string | null {
  if (depth > A2UI_MAX_DEPTH) return "max_depth_exceeded";
  if (typeof val === "string") {
    if (val.length > A2UI_MAX_STRING_LEN) return "string_too_long";
    if (UNSAFE_SCHEME.test(val) || UNSAFE_HTML.test(val)) return "unsafe_content";
    return null;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      const e = checkDepthAndStrings(item, depth + 1);
      if (e) return e;
    }
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (
        typeof v === "string" &&
        ["src", "image", "avatar", "font", "media"].includes(k.toLowerCase()) &&
        /^https?:\/\//i.test(v)
      ) {
        return "remote_media_blocked";
      }
      const e = checkDepthAndStrings(v, depth + 1);
      if (e) return e;
    }
  }
  return null;
}

export function validateA2uiSurfaceClient(raw: unknown): A2uiValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: "invalid_payload", error: "Surface payload is not an object.", markdownFallback: "" };
  }
  const obj = raw as Record<string, any>;
  const ver = String(obj.a2uiVersion || A2UI_PINNED_VERSION);
  if (ver !== A2UI_PINNED_VERSION) {
    return {
      ok: false,
      code: "unsupported_version",
      error: `Unsupported A2UI version '${ver}'`,
      markdownFallback: flattenA2uiToMarkdown(obj),
    };
  }
  if (typeof obj.surfaceId !== "string" || !obj.surfaceId.trim()) {
    return { ok: false, code: "invalid_surface_id", error: "Missing surfaceId", markdownFallback: flattenA2uiToMarkdown(obj) };
  }
  if (!Array.isArray(obj.components) || obj.components.length === 0) {
    return { ok: false, code: "empty_components", error: "Empty components array", markdownFallback: flattenA2uiToMarkdown(obj) };
  }
  if (obj.components.length > A2UI_MAX_COMPONENTS) {
    return { ok: false, code: "too_many_components", error: "Component count cap exceeded", markdownFallback: flattenA2uiToMarkdown(obj) };
  }

  const depthErr = checkDepthAndStrings(obj, 0);
  if (depthErr) {
    return { ok: false, code: depthErr, error: `Validation failed: ${depthErr}`, markdownFallback: "" };
  }

  for (const c of obj.components) {
    if (!c || typeof c !== "object" || typeof c.id !== "string" || !ALLOWED_SET.has(String(c.type))) {
      return {
        ok: false,
        code: "disallowed_component",
        error: `Unknown or disallowed component '${c?.type}'`,
        markdownFallback: flattenA2uiToMarkdown(obj),
      };
    }
    if (c.type === "TextField") {
      const it = String(c.props?.inputType || c.props?.type || "").toLowerCase();
      if (it === "password" || c.props?.secret === true) {
        return { ok: false, code: "disallowed_secret_field", error: "Password fields are forbidden.", markdownFallback: "" };
      }
    }
  }

  const surface: A2uiSurfacePayload = {
    a2uiVersion: ver,
    surfaceId: obj.surfaceId.trim(),
    summaryText: typeof obj.summaryText === "string" ? obj.summaryText : "",
    components: obj.components,
    dataModel: obj.dataModel && typeof obj.dataModel === "object" ? obj.dataModel : undefined,
  };
  return { ok: true, code: "ok", surface, markdownFallback: flattenA2uiToMarkdown(surface) };
}

export function flattenA2uiToMarkdown(surface: Record<string, any>): string {
  if (!surface || typeof surface !== "object") return "";
  const lines: string[] = [];
  if (typeof surface.summaryText === "string" && surface.summaryText.trim()) {
    lines.push(surface.summaryText.trim(), "");
  }
  const comps = Array.isArray(surface.components) ? surface.components : [];
  for (const c of comps) {
    const p = c?.props || {};
    switch (c?.type) {
      case "Text":
        if (p.text || p.content) lines.push(String(p.text || p.content));
        break;
      case "Button":
        lines.push(`[${String(p.label || "Action")}]`);
        break;
      case "TextField":
        lines.push(`- **${String(p.label || "Field")}**: ${String(p.value || p.placeholder || "")}`);
        break;
      case "Table":
        if (Array.isArray(p.columns) && p.columns.length > 0) {
          lines.push(`| ${p.columns.join(" | ")} |`);
          lines.push(`| ${p.columns.map(() => "---").join(" | ")} |`);
          if (Array.isArray(p.rows)) {
            for (const row of p.rows) {
              if (Array.isArray(row)) lines.push(`| ${row.join(" | ")} |`);
            }
          }
        }
        break;
      case "TodoList":
        if (Array.isArray(p.items)) {
          for (const it of p.items) {
            const done = it?.done === true || String(it?.status || "").toLowerCase() === "done";
            lines.push(`- [${done ? "x" : " "}] ${String(it?.title || "")}`);
          }
        }
        break;
      case "FileCard":
        lines.push(`- File: \`${String(p.path || "")}\`${p.description ? ` — ${String(p.description)}` : ""}`);
        break;
      case "DiffSummary":
        lines.push(`- Diff \`${String(p.path || "")}\` (+${Number(p.added || 0)} -${Number(p.removed || 0)})`);
        break;
      case "CodeBlock":
        lines.push("```" + String(p.language || ""), String(p.code || ""), "```");
        break;
      case "TerminalOutput":
        lines.push("```text", String(p.output || ""), "```");
        break;
      case "Citations":
        if (Array.isArray(p.sources)) {
          for (const s of p.sources) {
            lines.push(`- Source: \`${String(s?.path || "")}\` ${String(s?.excerpt || "")}`);
          }
        }
        break;
    }
  }
  return lines.join("\n").trim();
}
