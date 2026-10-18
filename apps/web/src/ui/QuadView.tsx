import React, { useState, useEffect } from 'react';
import { STRINGS } from './strings.js';
import type { Message } from '../api.js';

export interface PaneState {
  id: string;
  title: string;
  messages: Message[];
  status: string;
  waitingState?: {
    reason: string;
    countdown: number;
  };
}

interface QuadViewProps {
  panes: PaneState[];
  onSendMessage: (paneIndex: number, text: string) => void;
  activePaneIndex?: number;
  onSelectPane?: (paneIndex: number) => void;
}

export function QuadView({
  panes,
  onSendMessage,
  activePaneIndex = 0,
  onSelectPane,
}: QuadViewProps) {
  const [inputs, setInputs] = useState<string[]>(['', '', '', '']);

  // Handle countdowns for waiting states
  useEffect(() => {
    const timer = setInterval(() => {
      // Countdown tick handled by parent or local state
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function handleSend(index: number) {
    const text = inputs[index].trim();
    if (!text) return;
    onSendMessage(index, text);
    setInputs(prev => {
      const copy = [...prev];
      copy[index] = '';
      return copy;
    });
  }

  return (
    <div
      className="quad-view-container"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '8px',
        height: '100%',
        width: '100%',
        padding: '8px',
        boxSizing: 'border-box',
        background: 'var(--ui-surface-raised, #121815)',
      }}
    >
      {panes.slice(0, 4).map((pane, index) => {
        const isActive = activePaneIndex === index;
        const isWaiting = Boolean(pane.waitingState && pane.waitingState.countdown > 0);

        return (
          <div
            key={pane.id || index}
            className={`quad-pane ${isActive ? 'active' : ''}`}
            onClick={() => onSelectPane?.(index)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--ui-surface, #18221e)',
              border: isActive
                ? '1px solid var(--ui-accent, #48a87b)'
                : '1px solid var(--ui-border, #283832)',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: '32px',
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--ui-border, #283832)',
                background: 'var(--ui-surface-raised, #141c18)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--ui-text-secondary, #8ba196)',
              }}
            >
              <span>{pane.title || STRINGS.tabs.quadPane.replace('{index}', String(index + 1))}</span>
              {pane.status && (
                <span style={{ fontSize: '12px', color: 'var(--ui-accent, #48a87b)' }}>
                  {pane.status}
                </span>
              )}
            </div>

            {/* Waiting Overlay when under admission limits or 503 Retry-After */}
            {isWaiting && pane.waitingState && (
              <div
                className="admission-waiting-banner"
                role="status"
                aria-live="polite"
                style={{
                  background: 'rgba(234, 88, 12, 0.15)',
                  borderBottom: '1px solid rgba(234, 88, 12, 0.4)',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#fb923c',
                }}
              >
                <span className="spinner" style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>
                  {`${pane.waitingState.reason || STRINGS.tabs.waitingState} (${pane.waitingState.countdown}s)`}
                </span>
              </div>
            )}

            {/* Messages */}
            <div
              className="quad-messages"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              {pane.messages.length === 0 ? (
                <div
                  style={{
                    color: 'var(--ui-text-muted, #5f7568)',
                    fontStyle: 'italic',
                    margin: 'auto',
                    textAlign: 'center',
                  }}
                >
                  {STRINGS.chat.starterSubtitle}
                </div>
              ) : (
                pane.messages.map((m, mIdx) => (
                  <div
                    key={mIdx}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background:
                        m.role === 'user'
                          ? 'var(--ui-user-bubble, #23342b)'
                          : 'var(--ui-card, #1c2822)',
                      color: 'var(--ui-text-primary, #ffffff)',
                    }}
                  >
                    {m.content}
                  </div>
                ))
              )}
            </div>

            {/* Pane Input */}
            <div
              style={{
                padding: '6px 8px',
                borderTop: '1px solid var(--ui-border, #283832)',
                display: 'flex',
                gap: '6px',
              }}
            >
              <input
                type="text"
                value={inputs[index]}
                placeholder={STRINGS.composer.placeholder}
                disabled={isWaiting}
                onChange={e => {
                  const val = e.target.value;
                  setInputs(prev => {
                    const copy = [...prev];
                    copy[index] = val;
                    return copy;
                  });
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend(index);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'var(--ui-surface, #18221e)',
                  border: '1px solid var(--ui-border, #283832)',
                  borderRadius: '4px',
                  color: 'var(--ui-text-primary, #ffffff)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                disabled={isWaiting || !inputs[index].trim()}
                onClick={() => handleSend(index)}
                style={{
                  background: 'var(--ui-accent, #48a87b)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '4px 10px',
                  cursor: isWaiting ? 'not-allowed' : 'pointer',
                  opacity: isWaiting || !inputs[index].trim() ? 0.6 : 1,
                }}
              >
                ↵
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
