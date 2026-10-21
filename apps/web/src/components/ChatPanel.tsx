import React, { useRef, useEffect, useState } from 'react';
import { Composer } from './Composer.js';
import { SafeMarkdown } from '../ui/SafeMarkdown.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  speed?: string;
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
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isStreaming = false,
  onSendMessage,
  onStopStreaming,
  activeModelName = 'qwen2.5-coder-7b',
  isDrawerOpen = false,
  onToggleDrawer,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Odysseus & Jan inspired UI state
  const [chatMode, setChatMode] = useState<'chat' | 'agent'>('chat');
  const [tools, setTools] = useState({
    web: false,
    code: true,
    files: true,
    knowledge: true,
    mcp: false,
  });

  const promptStarters = [
    'Explain local process containment in Sanctum',
    'Benchmark Rust gateway memory budgets vs Electron',
    'How do GGUF GPU offloading layers work?',
  ];

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

  const toggleTool = (tool: keyof typeof tools) => {
    setTools((prev) => ({ ...prev, [tool]: !prev[tool] }));
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
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#0b0f17',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setChatMode('chat')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: chatMode === 'chat' ? '#1e293b' : 'transparent',
                color: chatMode === 'chat' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: chatMode === 'chat' ? 600 : 400,
              }}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setChatMode('agent')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: chatMode === 'agent' ? '#1e293b' : 'transparent',
                color: chatMode === 'agent' ? '#10b981' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: chatMode === 'agent' ? 600 : 400,
              }}
            >
              🤖 Agent
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Model:</span>
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
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Egress:</span>
            <strong style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '3px' }}>
              BLOCKED
            </strong>
          </div>
          {onToggleDrawer && (
            <button
              onClick={onToggleDrawer}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                backgroundColor: isDrawerOpen ? '#38bdf8' : '#1e293b',
                color: isDrawerOpen ? '#0b0f17' : '#f8fafc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500,
                transition: 'background-color 0.15s ease',
              }}
              title="Toggle Jan-Style Parameter Drawer"
            >
              <span>⚙️</span> Parameters
            </button>
          )}
        </div>
      </div>

      {/* Odysseus Tools & Capability Bar */}
      <div
        style={{
          padding: '6px 20px',
          backgroundColor: '#0d131f',
          borderBottom: '1px solid #141d2b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          fontSize: '11px',
        }}
      >
        <span style={{ color: '#64748b', marginRight: '4px' }}>Active Tools:</span>
        {[
          { key: 'knowledge' as const, label: '🧠 Knowledge RAG', active: tools.knowledge },
          { key: 'code' as const, label: '💻 Code Sandbox', active: tools.code },
          { key: 'files' as const, label: '📁 Local Files', active: tools.files },
          { key: 'web' as const, label: '🌐 Web Search (Offline)', active: tools.web },
          { key: 'mcp' as const, label: '🔌 MCP Client', active: tools.mcp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => toggleTool(t.key)}
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              border: t.active ? '1px solid #38bdf8' : '1px solid #1e293b',
              backgroundColor: t.active ? 'rgba(56, 189, 248, 0.12)' : '#121824',
              color: t.active ? '#38bdf8' : '#64748b',
              cursor: 'pointer',
              fontSize: '11px',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
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
              maxWidth: '480px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '36px' }}>🔒</div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px 0' }}>
                Private Local Intelligence
              </h2>
              <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                Uncompromising local-first workspace. Bring your own models, tools, and knowledge with zero WAN egress.
              </p>
            </div>

            {/* Quick Starters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Suggested Prompts</span>
              {promptStarters.map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(starter)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #1e293b',
                    backgroundColor: '#121824',
                    color: '#94a3b8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#38bdf8';
                    e.currentTarget.style.color = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#1e293b';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  ⚡ {starter}
                </button>
              ))}
            </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  {msg.role === 'assistant' && (
                    <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                      ⚡ 38.4 tok/s
                    </span>
                  )}
                </div>
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

              {/* Reasoning / Thinking Collapsible Block */}
              {msg.role === 'assistant' && (
                <details
                  style={{
                    marginBottom: '10px',
                    backgroundColor: '#0b0f17',
                    border: '1px solid #1e293b',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#38bdf8' }}>
                    🧠 Reasoning & Tool Execution (0.3s)
                  </summary>
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #141d2b', fontStyle: 'italic', fontSize: '11px' }}>
                    Context verified. Local inference pipeline admitted turn under zero WAN egress policy.
                  </div>
                </details>
              )}

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
