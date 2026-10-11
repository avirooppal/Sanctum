import React from 'react';

/**
 * Safe markdown renderer for Sanctum chat messages.
 * Treats all input as untrusted:
 * - HTML injection is stripped / escaped
 * - Script execution, event handlers, and data/javascript URIs are blocked
 * - Remote images (<img>) are blocked to prevent tracking/egress
 * - Supports bold, italics, code blocks, inline code, lists, and safe links
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  // Allow safe hash links and relative same-origin paths
  if (trimmed.startsWith('#') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return trimmed;
  }
  // Block javascript:, data:, vbscript:, etc.
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // Malformed url
  }
  return null;
}

export interface MarkdownBlock {
  type: 'code' | 'paragraph' | 'list';
  language?: string;
  content: string;
  items?: string[];
}

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  function flushText() {
    if (textBuffer.length > 0) {
      const joined = textBuffer.join('\n').trim();
      if (joined) {
        blocks.push({ type: 'paragraph', content: joined });
      }
      textBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        flushText();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCode = false;
        blocks.push({
          type: 'code',
          language: codeLang,
          content: codeBuffer.join('\n'),
        });
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCode) {
    // Unclosed code block - treat as code
    blocks.push({
      type: 'code',
      language: codeLang,
      content: codeBuffer.join('\n'),
    });
  } else {
    flushText();
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  // Parse inline elements: `code`, **bold**, *italic*, [link](url)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // Inline code `...`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="ui-inline-code">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **...**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *...*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link [label](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const label = linkMatch[1];
      const safeHref = sanitizeUrl(linkMatch[2]);
      if (safeHref) {
        parts.push(
          <a
            key={key++}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-link"
          >
            {label}
          </a>
        );
      } else {
        parts.push(label);
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Consume literal characters up to next markdown marker
    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      // First character was special but didn't match a token rule
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

export function SafeMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="ui-markdown space-y-3">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <div key={idx} className="ui-code-block rounded-lg p-3 my-2 border ui-border">
              {block.language && (
                <div className="text-[11px] text-display ui-text-secondary mb-1">
                  {block.language}
                </div>
              )}
              <pre className="text-xs overflow-x-auto font-mono">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed whitespace-pre-wrap">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}
