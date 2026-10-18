import React, { useEffect, useState } from 'react';
import type { SanctumClient, ConversationUsage } from '../api.js';

export interface ContextBarProps {
  api?: SanctumClient;
  conversation: string;
  contextLimit?: number;
  className?: string;
}

export function ContextBar({
  api,
  conversation,
  contextLimit,
  className = '',
}: ContextBarProps) {
  const [usage, setUsage] = useState<ConversationUsage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !conversation) {
      setUsage(null);
      return;
    }

    let active = true;
    setLoading(true);

    api.conversationUsage(conversation)
      .then(res => {
        if (active) {
          setUsage(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUsage({ conversation_id: conversation, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, context_length: contextLimit || 0, has_data: false });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, conversation]);

  if (!usage || !usage.has_data) {
    return (
      <div
        className={`context-bar text-xs ui-text-secondary flex items-center gap-2 px-2 py-1 rounded border ui-border ${className}`}
        aria-label="Context usage"
        title="No token usage data recorded for this conversation yet"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
        <span>Tokens: <strong className="font-mono">Unknown</strong></span>
        {contextLimit ? (
          <span className="text-xs ui-text-secondary">
            (Window: {contextLimit.toLocaleString()})
          </span>
        ) : null}
      </div>
    );
  }

  const percent = contextLimit && contextLimit > 0
    ? Math.min(100, Math.round((usage.total_tokens / contextLimit) * 100))
    : null;

  return (
    <div
      className={`context-bar text-xs ui-text-secondary flex items-center gap-2 px-2.5 py-1 rounded border ui-border ${className}`}
      aria-label="Context usage"
      title={`Prompt: ${usage.prompt_tokens.toLocaleString()} · Completion: ${usage.completion_tokens.toLocaleString()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span>
        Tokens: <strong className="font-mono text-foreground">{usage.total_tokens.toLocaleString()}</strong>
        {contextLimit ? ` / ${contextLimit.toLocaleString()}` : ''}
      </span>
      {percent !== null && (
        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-amber-500' : 'bg-accent'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-mono">{percent}%</span>
        </div>
      )}
    </div>
  );
}
