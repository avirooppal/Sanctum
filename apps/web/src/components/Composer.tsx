import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask anything (Enter to send, Shift+Enter for new line)...',
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
    if (text.trim() && !disabled && !isStreaming) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#121824',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        style={{
          flex: 1,
          padding: '10px 14px',
          backgroundColor: '#0b0f17',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          color: '#f8fafc',
          fontSize: '14px',
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
          lineHeight: '1.4',
        }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          style={{
            padding: '10px 16px',
            backgroundColor: '#f43f5e',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSendClick}
          disabled={!text.trim() || disabled}
          style={{
            padding: '10px 18px',
            backgroundColor: text.trim() && !disabled ? '#38bdf8' : '#1e293b',
            color: text.trim() && !disabled ? '#0b0f17' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: text.trim() && !disabled ? 'pointer' : 'default',
          }}
        >
          Send
        </button>
      )}
    </div>
  );
};
