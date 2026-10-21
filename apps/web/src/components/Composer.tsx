import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  activeModelName?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask anything...',
  activeModelName = '',
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !disabled && !isStreaming) {
        onSend(text.trim());
        setText('');
      }
    }
  };

  const handleSendClick = () => {
    if (isStreaming && onStop) {
      onStop();
      return;
    }
    if (text.trim() && !disabled && !isStreaming) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2 shrink-0">
      <div className="rounded-2xl border border-border bg-card shadow-sm p-3 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[44px] max-h-[180px] leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2 border-t border-border/20 mt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {activeModelName ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-medium border border-border/40">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {activeModelName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground text-[11px]">
                No model selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleSendClick}
                className="size-8 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-xs"
                title="Stop generation"
              >
                <div className="size-2.5 rounded-xs bg-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendClick}
                disabled={!text.trim() || disabled}
                className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                title="Send message (Enter)"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
