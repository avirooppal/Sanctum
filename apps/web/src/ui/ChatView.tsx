import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, SanctumClient } from '../api.js';
import { SafeMarkdown } from './SafeMarkdown.js';
import { ChatComposer } from './ChatComposer.js';
import { STRINGS } from './strings.js';

export interface ChatViewProps {
  messages: Message[];
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRetry?: (index: number) => void;
  onDeleteMessage?: (index: number) => void;
  busy: boolean;
  sendOnEnter: boolean;
  messageLayout?: 'bubbles' | 'bubble' | 'document';
  conversationId: string;
  api?: SanctumClient;
  token?: string;
  modelId?: string;
  contextLimit?: number;
  onCitationClick?: (citation: string) => void;
  onAttachmentUploaded?: (documentName: string) => void;
  className?: string;
}

export function ChatView({
  messages,
  prompt,
  setPrompt,
  onSend,
  onStop,
  onRetry,
  onDeleteMessage,
  busy,
  sendOnEnter,
  messageLayout = 'bubble',
  conversationId,
  api,
  token,
  modelId,
  onCitationClick,
  onAttachmentUploaded,
  className = '',
}: ChatViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Auto scroll to bottom when messages update if user is at bottom
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom(false);
    }
  }, [messages, isAtBottom, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setIsAtBottom(atBottom);
  };

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`chat-view flex flex-col h-full relative ${className}`}>
      {/* Transcript container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="app-transcript flex-1 overflow-y-auto px-4 py-6 space-y-6"
        aria-live="polite"
      >
        {!messages.length && (
          <div className="pt-8 pb-4 max-w-[720px] mx-auto">
            <h1 className="text-3xl font-semibold tracking-tight">{STRINGS.chat.starterTitle}</h1>
            <p className="mt-2 text-sm ui-text-secondary leading-relaxed">
              {STRINGS.chat.starterSubtitle}
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const isStreamingThis = busy && i === messages.length - 1 && m.role === 'assistant';

          if (messageLayout === 'document') {
            // Document-style measure unboxed at ~720px
            return (
              <article
                key={i}
                className="max-w-[720px] mx-auto py-3 px-2 group/msg transition-colors"
                data-role={m.role}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-display ui-text-secondary">
                      {isUser ? 'You' : 'Sanctum'}
                    </span>
                    {isStreamingThis && (
                      <span className="flex items-center gap-1 text-xs text-accent">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                        <span className="text-display">Thinking locally…</span>
                      </span>
                    )}
                  </div>

                  {/* Actions: Copy, Retry, Delete */}
                  <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1.5">
                    {m.content && (
                      <button
                        type="button"
                        onClick={() => copyMessage(m.content, i)}
                        aria-label="Copy message"
                        className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-foreground"
                      >
                        {copiedIndex === i ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                    {isUser && onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(i)}
                        disabled={busy}
                        aria-label="Retry prompt"
                        className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-foreground"
                      >
                        Retry
                      </button>
                    )}
                    {onDeleteMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(i)}
                        disabled={busy}
                        aria-label="Delete message"
                        className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {isUser ? (
                  <div className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</div>
                ) : (
                  <div className="leading-relaxed text-sm">
                    {m.content ? (
                      <SafeMarkdown content={m.content} onCitationClick={onCitationClick} />
                    ) : (
                      <span className="text-sm ui-text-secondary italic">Thinking locally…</span>
                    )}
                  </div>
                )}
              </article>
            );
          }

          // Default Bubble layout
          return (
            <article
              key={i}
              className={`group/msg transition-colors ${
                isUser
                  ? 'ui-user-bubble rounded-2xl p-4 ml-8 max-w-[720px] self-end'
                  : 'max-w-[720px] p-4'
              }`}
              data-role={m.role}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-display ui-text-secondary tracking-wider">
                    {isUser ? 'You' : 'Sanctum'}
                  </span>
                  {isStreamingThis && (
                    <span className="flex items-center gap-1.5 text-xs text-accent">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                      <span className="text-display">Thinking locally…</span>
                    </span>
                  )}
                </div>

                {/* Actions: Copy, Retry, Delete */}
                <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1.5">
                  {m.content && (
                    <button
                      type="button"
                      onClick={() => copyMessage(m.content, i)}
                      aria-label="Copy message"
                      className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-foreground"
                    >
                      {copiedIndex === i ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                  {isUser && onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(i)}
                      disabled={busy}
                      aria-label="Retry prompt"
                      className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-foreground"
                    >
                      Retry
                    </button>
                  )}
                  {onDeleteMessage && (
                    <button
                      type="button"
                      onClick={() => onDeleteMessage(i)}
                      disabled={busy}
                      aria-label="Delete message"
                      className="text-xs px-1.5 py-0.5 rounded border ui-border ui-text-secondary hover:text-red-500"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {isUser ? (
                <div className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</div>
              ) : (
                <div className="leading-relaxed text-sm">
                  {m.content ? (
                    <SafeMarkdown content={m.content} onCitationClick={onCitationClick} />
                  ) : (
                    <span className="text-sm ui-text-secondary italic">Thinking locally…</span>
                  )}
                </div>
              )}
            </article>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* "Jump to latest" floating pill when scrolled up */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full ui-surface border ui-border shadow-md text-xs ui-text-secondary hover:text-foreground transition-all flex items-center gap-1.5 z-10"
          aria-label="Jump to latest message"
        >
          <span>↓</span> Jump to latest
        </button>
      )}

      {/* Context usage belongs to the status bar; avoid a duplicate poll. */}
      <div className="px-4 pb-4 bg-background/80 backdrop-blur-xs">
        <ChatComposer
          prompt={prompt}
          setPrompt={setPrompt}
          onSend={onSend}
          onStop={onStop}
          busy={busy}
          sendOnEnter={sendOnEnter}
          api={api}
          token={token}
          conversation={conversationId}
          onAttachmentUploaded={onAttachmentUploaded}
        />
      </div>
    </div>
  );
}
