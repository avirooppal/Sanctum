import React, { useRef, useEffect } from 'react';
import { Composer } from './Composer.js';
import { SafeMarkdown } from '../ui/SafeMarkdown.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: {
    source: string;
    page: number | null;
    quote: string;
  }[];
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming?: () => void;
  activeModelName?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isStreaming = false,
  onSendMessage,
  onStopStreaming,
  activeModelName = 'qwen2.5-coder-7b',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleCopy = (content: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(content);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
      }}
    >
      {/* Thread Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#121824',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Active Model:</span>
          <span
            style={{
              fontSize: '12px',
              padding: '2px 8px',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            {activeModelName}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Egress: <strong style={{ color: '#10b981' }}>BLOCKED</strong> (Local Only)
        </div>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#64748b',
              maxWidth: '400px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: '0 0 8px 0' }}>
              Private Local Intelligence
            </h2>
            <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
              All inference executes directly on this device. No telemetry, no cloud logging, no data egress.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              width: '100%',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: msg.role === 'user' ? '#1e293b' : '#121824',
                border: '1px solid #1e293b',
                color: '#f8fafc',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: msg.role === 'user' ? '#94a3b8' : '#38bdf8',
                  }}
                >
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(msg.content)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px',
                  }}
                  title="Copy message"
                >
                  📋 Copy
                </button>
              </div>

              {msg.role === 'assistant' ? (
                <SafeMarkdown content={msg.content} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    Sources & Citations:
                  </div>
                  {msg.citations.map((cite, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        backgroundColor: '#0b0f17',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        color: '#cbd5e1',
                      }}
                    >
                      <strong>{cite.source}</strong> {cite.page ? `(p. ${cite.page})` : ''}: &ldquo;{cite.quote}&rdquo;
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <Composer
        onSend={onSendMessage}
        onStop={onStopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
};
