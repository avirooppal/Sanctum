import React, { useState, useEffect, useMemo } from 'react';
import type { Message, SanctumClient, Workspace } from '../api.js';
import { parseMarkdownBlocks, sanitizeUrl } from './SafeMarkdown.js';
import { STRINGS } from './strings.js';

export interface CodeArtifact {
  id: string;
  language: string;
  content: string;
  lineCount: number;
  messageIndex: number;
}

export interface LinkArtifact {
  id: string;
  type: 'link' | 'citation';
  label: string;
  url?: string;
  source?: string;
  messageIndex: number;
}

export interface RightRailProps {
  messages: Message[];
  api?: SanctumClient;
  isOpen: boolean;
  onClose: () => void;
  onCitationClick?: (citation: string) => void;
  className?: string;
}

export function RightRail({
  messages,
  api,
  isOpen,
  onClose,
  onCitationClick,
  className = '',
}: RightRailProps) {
  const [activeTab, setActiveTab] = useState<'artifacts' | 'knowledge'>('artifacts');
  const [artifactSubTab, setArtifactSubTab] = useState<'files' | 'links'>('files');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract Code Blocks
  const codeArtifacts = useMemo<CodeArtifact[]>(() => {
    const list: CodeArtifact[] = [];
    messages.forEach((msg, mIdx) => {
      if (msg.role === 'assistant' && msg.content) {
        const blocks = parseMarkdownBlocks(msg.content);
        blocks.forEach((block, bIdx) => {
          if (block.type === 'code') {
            const lang = block.language || 'plaintext';
            const lines = block.content.split('\n').length;
            list.push({
              id: `code-${mIdx}-${bIdx}`,
              language: lang,
              content: block.content,
              lineCount: lines,
              messageIndex: mIdx,
            });
          }
        });
      }
    });
    return list;
  }, [messages]);

  // Extract Links and Citations
  const linkArtifacts = useMemo<LinkArtifact[]>(() => {
    const list: LinkArtifact[] = [];
    messages.forEach((msg, mIdx) => {
      if (msg.content) {
        // Find citations [^1] or [source: ...]
        const citationRegex = /\[\^([0-9]+)\]|\[source:\s*([^\]]+)\]/g;
        let match;
        while ((match = citationRegex.exec(msg.content)) !== null) {
          const label = match[1] || match[2];
          list.push({
            id: `cite-${mIdx}-${match.index}`,
            type: 'citation',
            label: `Source: ${label}`,
            source: label,
            messageIndex: mIdx,
          });
        }

        // Find links [label](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        while ((match = linkRegex.exec(msg.content)) !== null) {
          const label = match[1];
          const rawUrl = match[2];
          const safe = sanitizeUrl(rawUrl);
          if (safe) {
            list.push({
              id: `link-${mIdx}-${match.index}`,
              type: 'link',
              label,
              url: safe,
              messageIndex: mIdx,
            });
          }
        }
      }
    });
    return list;
  }, [messages]);

  // Load Workspaces for Knowledge Tree
  useEffect(() => {
    if (activeTab === 'knowledge' && api) {
      let active = true;
      api.workspaces()
        .then(data => {
          if (active) {
            setWorkspaces(data);
            if (data.length > 0 && !selectedWorkspace) {
              setSelectedWorkspace(data[0].id);
            }
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [activeTab, api, selectedWorkspace]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const downloadBlob = (content: string, filename: string, language: string) => {
    try {
      const ext = language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language === 'json' ? 'json' : language === 'html' ? 'html' : language === 'rust' ? 'rs' : 'txt';
      const safeFilename = filename.includes('.') ? filename : `${filename}.${ext}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Right Rail"
      className={`right-rail w-80 h-full border-l ui-border ui-surface flex flex-col z-10 transition-all ${className}`}
    >
      {/* Top tab header */}
      <div className="flex items-center justify-between border-b ui-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('artifacts')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'artifacts'
                ? 'bg-accent/15 text-accent'
                : 'ui-text-secondary hover:text-foreground'
            }`}
          >
            {STRINGS.rightRail.artifacts}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'knowledge'
                ? 'bg-accent/15 text-accent'
                : 'ui-text-secondary hover:text-foreground'
            }`}
          >
            {STRINGS.rightRail.knowledgeTree}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close right rail"
          title="Close (Ctrl+J)"
          className="p-1 rounded-md text-xs ui-text-secondary hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
        >
          ✕
        </button>
      </div>

      {/* Artifacts Tab */}
      {activeTab === 'artifacts' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-tabs: Files/Code vs Links */}
          <div className="flex border-b ui-border px-3 py-1.5 gap-2 bg-black/2 dark:bg-white/2">
            <button
              type="button"
              onClick={() => setArtifactSubTab('files')}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                artifactSubTab === 'files'
                  ? 'border ui-border font-medium ui-surface text-foreground shadow-2xs'
                  : 'ui-text-secondary hover:text-foreground'
              }`}
            >
              {STRINGS.rightRail.filesCode} ({codeArtifacts.length})
            </button>
            <button
              type="button"
              onClick={() => setArtifactSubTab('links')}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                artifactSubTab === 'links'
                  ? 'border ui-border font-medium ui-surface text-foreground shadow-2xs'
                  : 'ui-text-secondary hover:text-foreground'
              }`}
            >
              {STRINGS.rightRail.links} ({linkArtifacts.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {artifactSubTab === 'files' ? (
              codeArtifacts.length === 0 ? (
                <div className="py-8 text-center text-xs ui-text-secondary">
                  {STRINGS.rightRail.emptyArtifacts}
                </div>
              ) : (
                codeArtifacts.map((art, idx) => (
                  <div
                    key={art.id}
                    className="p-2.5 rounded-lg border ui-border ui-surface space-y-2 group"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-display ui-text-secondary">
                        {art.language} · {art.lineCount} lines
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(art.content, art.id)}
                          aria-label="Copy snippet"
                          className="px-1.5 py-0.5 rounded border ui-border text-[10px] ui-text-secondary hover:text-foreground"
                        >
                          {copiedId === art.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadBlob(art.content, `snippet_${idx + 1}`, art.language)}
                          aria-label="Download snippet"
                          className="px-1.5 py-0.5 rounded border ui-border text-[10px] ui-text-secondary hover:text-foreground"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                    <pre className="text-[11px] font-mono overflow-x-auto p-2 rounded bg-black/5 dark:bg-white/5 max-h-28">
                      <code>{art.content}</code>
                    </pre>
                  </div>
                ))
              )
            ) : linkArtifacts.length === 0 ? (
              <div className="py-8 text-center text-xs ui-text-secondary">
                {STRINGS.rightRail.emptyLinks}
              </div>
            ) : (
              <ul className="space-y-2 text-xs">
                {linkArtifacts.map(item => (
                  <li
                    key={item.id}
                    className="p-2 rounded-lg border ui-border ui-surface flex items-start justify-between gap-2"
                  >
                    {item.type === 'citation' ? (
                      <button
                        type="button"
                        onClick={() => item.source && onCitationClick?.(item.source)}
                        className="text-left font-mono text-accent hover:underline flex items-center gap-1.5"
                      >
                        <span>◈</span> {item.label}
                      </button>
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline break-all"
                      >
                        ↗ {item.label}
                      </a>
                    )}
                    <span className="text-[10px] ui-text-secondary uppercase">
                      {item.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Knowledge Tab: Read-Only Workspace Tree */}
      {activeTab === 'knowledge' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-xs font-semibold text-display ui-text-secondary mb-2">
            Workspaces & Documents
          </div>
          {workspaces.length === 0 ? (
            <div className="py-8 text-center text-xs ui-text-secondary">
              No workspaces available. Ingest documents via Knowledge panel.
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className="rounded-lg border ui-border ui-surface p-2.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span>📁 {ws.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                      Indexed
                    </span>
                  </div>
                  <div className="pl-4 text-[11px] ui-text-secondary space-y-1">
                    <div className="flex items-center justify-between">
                      <span>📄 Ingested collection</span>
                      <span>Ready</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
