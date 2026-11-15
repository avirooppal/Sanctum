export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export interface SanitizedMarkdownResult {
  html: string;
  toc: TocItem[];
  linkedPaths: string[];
}

export function escapeHtml(raw: string): string {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isSafeHref(url: string): boolean {
  const trimmed = String(url || "").trim().replace(/[\u0000-\u001F\s]+/g, "").toLowerCase();
  if (!trimmed) return false;
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  return true;
}

export function isRemoteUrl(url: string): boolean {
  const trimmed = String(url || "").trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("//")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
    if (["127.0.0.1", "localhost", "sanctum.app"].includes(parsed.hostname.toLowerCase())) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 64) || "section"
  );
}

/**
 * Safe, zero-XSS Markdown-to-HTML renderer with TOC extraction and remote-image blocking.
 * Never passes raw HTML tags through; all text is HTML-escaped before inline formatting.
 */
export function renderSanitizedMarkdown(
  markdown: string,
  options?: { allowRemoteImages?: boolean }
): SanitizedMarkdownResult {
  const allowRemoteImages = Boolean(options?.allowRemoteImages);
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const toc: TocItem[] = [];
  const linkedPaths: string[] = [];
  const out: string[] = [];

  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };

  const formatInline = (rawLine: string): string => {
    // 1. Strip raw <script>, <iframe, <object, <embed, <svg, and inline on*= handlers, then escape HTML entities
    const stripped = rawLine
      .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*\/?\s*(?:script|iframe|object|embed|svg|img|style|link|meta)\b[^>]*>/gi, "")
      .replace(/\bon[a-z]+\s*=/gi, "data-blocked-handler=");
    let escaped = escapeHtml(stripped);

    // 2. Inline code `...`
    escaped = escaped.replace(/`([^`]+)`/g, (_m, code) => `<code class="md-inline-code">${code}</code>`);

    // 3. Images ![alt](src)
    escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, rawSrc) => {
      const src = rawSrc.replace(/&amp;/g, "&").trim();
      if (!isSafeHref(src)) {
        return `<span class="md-blocked-img">[Blocked unsafe image URI]</span>`;
      }
      if (isRemoteUrl(src) && !allowRemoteImages) {
        return `<span class="md-blocked-img" data-remote-src="${escapeHtml(src)}">[Remote image blocked: ${alt || src}]</span>`;
      }
      const resolvedSrc = isRemoteUrl(src)
        ? escapeHtml(src)
        : `/api/fs/raw?path=${encodeURIComponent(src)}`;
      return `<img src="${resolvedSrc}" alt="${alt}" class="md-img" loading="lazy" />`;
    });

    // 4. Links [label](href)
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, rawHref) => {
      const href = rawHref.replace(/&amp;/g, "&").trim();
      if (!isSafeHref(href)) {
        return `<span class="md-unsafe-link">${label}</span>`;
      }
      if (!isRemoteUrl(href) && !href.startsWith("#") && !href.startsWith("mailto:")) {
        linkedPaths.push(href);
        return `<a href="#" data-workspace-path="${escapeHtml(href)}" class="md-workspace-link">${label}</a>`;
      }
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="md-ext-link">${label}</a>`;
    });

    // 5. Bold & Italic
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return escaped;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      closeList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const safeLang = escapeHtml(codeLang || "text");
        out.push(
          `<pre class="md-code-block" data-lang="${safeLang}"><code>${escapeHtml(
            codeLines.join("\n")
          )}</code></pre>`
        );
        codeLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const rawHeading = headingMatch[2].trim();
      const id = `${slugifyHeading(rawHeading)}-${toc.length + 1}`;
      toc.push({ level, text: rawHeading, id });
      out.push(`<h${level} id="${id}" class="md-h${level}">${formatInline(rawHeading)}</h${level}>`);
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      closeList();
      out.push("<hr class=\"md-hr\" />");
      continue;
    }

    const ulMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (ulMatch) {
      if (inList !== "ul") {
        closeList();
        inList = "ul";
        out.push('<ul class="md-ul">');
      }
      out.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (olMatch) {
      if (inList !== "ol") {
        closeList();
        inList = "ol";
        out.push('<ol class="md-ol">');
      }
      out.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    if (line.trim().startsWith(">")) {
      closeList();
      const quoteText = line.replace(/^\s*>\s?/, "");
      out.push(`<blockquote class="md-quote">${formatInline(quoteText)}</blockquote>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p class="md-p">${formatInline(line)}</p>`);
  }

  closeList();
  if (inCodeBlock) {
    out.push(
      `<pre class="md-code-block" data-lang="${escapeHtml(codeLang || "text")}"><code>${escapeHtml(
        codeLines.join("\n")
      )}</code></pre>`
    );
  }

  return {
    html: out.join("\n"),
    toc,
    linkedPaths,
  };
}

/**
 * Builds a strictly isolated iframe sandbox configuration for untrusted HTML/SVG previews.
 * NEVER includes 'allow-same-origin', guaranteeing a null origin that cannot read parent window or X-Sanctum-Auth.
 */
export function buildSandboxedPreviewConfig(
  rawContent: string,
  options?: { isSvg?: boolean; allowScripts?: boolean }
): {
  sandbox: "" | "allow-scripts";
  csp: string;
  srcDoc: string;
} {
  const allowScripts = Boolean(options?.allowScripts);
  const isSvg = Boolean(options?.isSvg);
  const sandbox: "" | "allow-scripts" = allowScripts ? "allow-scripts" : "";

  const csp = allowScripts
    ? "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; script-src 'unsafe-inline';"
    : "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";

  const bodyContent = isSvg
    ? `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;background:#121216;">${rawContent}</div>`
    : rawContent;

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  html, body { margin: 0; padding: 12px; font-family: system-ui, -apple-system, sans-serif; background: #141418; color: #f4f4f5; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  return { sandbox, csp, srcDoc };
}

/**
 * Detects candidate workspace file paths mentioned in assistant text.
 */
export function detectCandidateFilePaths(text: string): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  const rx =
    /(?:^|[\s`'":(])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:md|txt|json|yaml|yml|csv|ts|tsx|js|jsx|py|cs|html|htm|css|svg|png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav|pdf|sh|ps1|toml|sql|rs|go|cpp|c|h))(?=$|[\s`'",.:;!#)])/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    const candidate = m[1].trim().replace(/^\.\//, "");
    if (
      candidate &&
      !candidate.startsWith("http") &&
      !candidate.includes("..") &&
      candidate.length <= 160
    ) {
      matches.add(candidate);
    }
  }
  return Array.from(matches);
}
