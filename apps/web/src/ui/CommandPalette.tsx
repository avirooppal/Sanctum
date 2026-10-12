import React, { useState, useEffect, useRef } from 'react';
import { STRINGS } from './strings.js';

export interface CommandAction {
  id: string;
  category: string;
  title: string;
  shortcut?: string;
  onSelect: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

function fuzzyMatch(text: string, pattern: string): { matched: boolean; score: number } {
  if (!pattern) return { matched: true, score: 0 };
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase().trim();
  if (lowerText.includes(lowerPattern)) {
    return { matched: true, score: 100 - lowerText.indexOf(lowerPattern) };
  }
  let patternIdx = 0;
  let score = 0;
  for (let i = 0; i < lowerText.length && patternIdx < lowerPattern.length; i++) {
    if (lowerText[i] === lowerPattern[patternIdx]) {
      patternIdx++;
      score += 10;
    }
  }
  return { matched: patternIdx === lowerPattern.length, score };
}

export function CommandPalette({ isOpen, onClose, actions }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = actions
    .map(a => {
      const titleMatch = fuzzyMatch(a.title, query);
      const catMatch = fuzzyMatch(a.category, query);
      const matched = titleMatch.matched || catMatch.matched;
      const score = Math.max(titleMatch.score, catMatch.score);
      return { action: a, matched, score };
    })
    .filter(item => item.matched)
    .sort((a, b) => b.score - a.score)
    .map(item => item.action);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].onSelect();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--ui-z-modal, 40)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="ui-card"
        style={{
          width: 'min(580px, calc(100vw - 32px))',
          padding: 0,
          background: 'var(--ui-surface-raised, #1c2622)',
          border: '1px solid var(--ui-border, #283832)',
          boxShadow: 'var(--ui-shadow-lg, 0 10px 25px rgba(0,0,0,0.5))',
          borderRadius: 'var(--ui-radius-lg, 12px)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui-border, #283832)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={STRINGS.commandPalette.searchPlaceholder}
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ui-text-primary, #e8efe9)',
              fontSize: '15px',
            }}
          />
        </div>

        <ul
          id="command-palette-list"
          role="listbox"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '8px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--ui-text-tertiary, #758b7b)',
                fontSize: '13px',
              }}
            >
              No matching commands
            </li>
          ) : (
            filtered.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  key={action.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    action.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--ui-radius-sm, 4px)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isSelected ? 'var(--ui-accent, #48a87b)' : 'transparent',
                    color: isSelected ? 'var(--ui-text-on-accent, #0f1412)' : 'var(--ui-text-primary, #e8efe9)',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        marginRight: '8px',
                        opacity: 0.7,
                        fontWeight: 600,
                      }}
                    >
                      {action.category}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{action.title}</span>
                  </div>
                  {action.shortcut && (
                    <span
                      style={{
                        fontSize: '11px',
                        opacity: 0.75,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: 'rgba(0,0,0,0.15)',
                      }}
                    >
                      {action.shortcut}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
