"use client";

import React, { useState, useMemo } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/70 bg-zinc-950/90 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wider text-[10px]">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[12.5px] leading-relaxed font-mono text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/** Parse inline Markdown tokens: `code`, ***bold italic***, **bold**, *italic*, ~~strike~~, [text](url). */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined tokenizer ordered by specificity
  const tokenRegex =
    /(`[^`\n]+`|\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md border border-border/50 bg-muted/70 px-1.5 py-0.5 font-mono text-[0.86em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("***") && token.endsWith("***")) {
      nodes.push(
        <strong key={key} className="font-semibold italic text-foreground">
          {renderInline(token.slice(3, -3), key)}
        </strong>
      );
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(token.slice(2, -2), key)}
        </strong>
      );
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(
        <del key={key} className="line-through text-muted-foreground">
          {renderInline(token.slice(2, -2), key)}
        </del>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), key)}
        </em>
      );
    } else if (match[2] && match[3]) {
      nodes.push(
        <a
          key={key}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary transition-colors"
        >
          {match[2]}
        </a>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length >= 1 && cells.every((c) => /^\s*:?-{3,}:?\s*$/.test(c));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(markdown: string): React.ReactNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block (```lang ... ```) — also handles unclosed fences while streaming
    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++;
      }
      blocks.push(<CodeBlock key={`b-${blockKey++}`} language={lang} code={codeLines.join("\n")} />);
      continue;
    }

    // Display math block ($$ ... $$)
    if (trimmed === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === "$$") i++;
      blocks.push(
        <pre
          key={`b-${blockKey++}`}
          className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 px-4 py-3 font-mono text-xs text-foreground"
        >
          {mathLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`b-${blockKey++}`} className="my-4 border-border/60" />);
      i++;
      continue;
    }

    // Headings (# to ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const key = `b-${blockKey++}`;
      const sizeClass =
        level === 1
          ? "text-lg font-bold mt-5 mb-2"
          : level === 2
          ? "text-base font-bold mt-4 mb-2"
          : level === 3
          ? "text-[15px] font-semibold mt-4 mb-1.5"
          : "text-sm font-semibold mt-3 mb-1";
      blocks.push(
        <div key={key} role="heading" aria-level={level} className={cn("tracking-tight text-foreground", sizeClass)}>
          {renderInline(headingText, key)}
        </div>
      );
      i++;
      continue;
    }

    // GFM Table
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const key = `b-${blockKey++}`;
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                {headers.map((h, hi) => (
                  <th key={`${key}-h-${hi}`} className="border-b border-border/60 px-3 py-2 font-semibold">
                    {renderInline(h, `${key}-h-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row, ri) => (
                <tr key={`${key}-r-${ri}`} className="hover:bg-muted/20">
                  {headers.map((_, ci) => (
                    <td key={`${key}-r-${ri}-c-${ci}`} className="px-3 py-2 text-foreground/90 align-top">
                      {renderInline(row[ci] ?? "", `${key}-r-${ri}-c-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const key = `b-${blockKey++}`;
      blocks.push(
        <blockquote
          key={key}
          className="my-3 border-l-2 border-primary/60 bg-muted/25 rounded-r-lg pl-3.5 pr-3 py-2 text-sm text-foreground/85 space-y-1"
        >
          {quoteLines.map((ql, qi) => (
            <p key={`${key}-q-${qi}`}>{renderInline(ql, `${key}-q-${qi}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Lists (ordered 1. or unordered - / * / •, supporting nested indentation)
    const listMatch = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      const listItems: { indent: number; ordered: boolean; marker: string; text: string }[] = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
        if (!lm) break;
        const indentSpaces = lm[1].replace(/\t/g, "  ").length;
        const isOrd = /^\d+[.)]$/.test(lm[2]);
        listItems.push({
          indent: Math.min(3, Math.floor(indentSpaces / 2)),
          ordered: isOrd,
          marker: lm[2],
          text: lm[3],
        });
        i++;
      }
      const key = `b-${blockKey++}`;
      blocks.push(
        <ul key={key} className="my-2 space-y-1.5">
          {listItems.map((item, li) => (
            <li
              key={`${key}-li-${li}`}
              className="flex items-start gap-2 text-sm leading-7 text-foreground/95"
              style={{ paddingLeft: `${item.indent * 18}px` }}
            >
              <span className="shrink-0 select-none text-muted-foreground font-medium min-w-[1.1rem] text-right">
                {item.ordered ? item.marker : "•"}
              </span>
              <span className="min-w-0 flex-1">{renderInline(item.text, `${key}-li-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Standard Paragraph (collect consecutive non-block lines)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const ct = cur.trim();
      if (
        !ct ||
        ct.startsWith("```") ||
        ct === "$$" ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(ct) ||
        /^#{1,6}\s+/.test(ct) ||
        ct.startsWith(">") ||
        /^(\s*)([-*•]|\d+[.)])\s+/.test(cur) ||
        (ct.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }
    const key = `b-${blockKey++}`;
    blocks.push(
      <p key={key} className="my-2 text-sm leading-7 text-foreground/95">
        {paraLines.map((pl, pi) => (
          <React.Fragment key={`${key}-p-${pi}`}>
            {pi > 0 && <br />}
            {renderInline(pl, `${key}-p-${pi}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return blocks;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(
  ({ content, className }) => {
    const rendered = useMemo(() => parseBlocks(content), [content]);
    return (
      <div className={cn("min-w-0 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
        {rendered}
      </div>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";
