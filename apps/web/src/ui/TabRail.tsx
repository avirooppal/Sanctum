import React, { useEffect } from 'react';
import { STRINGS } from './strings.js';

export interface TabItem {
  id: string;
  title: string;
}

interface TabRailProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export function TabRail({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: TabRailProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length <= 1) return;
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        onSelectTab(tabs[nextIndex].id);
      } else if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (tabs.length > 0) {
          onCloseTab(activeTabId);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, onSelectTab, onCloseTab]);

  return (
    <nav
      className="tab-rail"
      aria-label="Open sessions"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--ui-surface-raised, #161e1b)',
        borderBottom: '1px solid var(--ui-border, #283832)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        height: '38px',
        padding: '0 8px',
        gap: '4px',
      }}
    >
      <div
        className="tab-list"
        role="tablist"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flex: 1,
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTab(tab.id);
                }
              }}
              className={`session-tab ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                background: isActive ? 'var(--ui-surface, #1e2924)' : 'transparent',
                color: isActive ? 'var(--ui-text-primary, #ffffff)' : 'var(--ui-text-secondary, #8ba196)',
                border: isActive ? '1px solid var(--ui-border, #283832)' : '1px solid transparent',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.title || STRINGS.chat.starterTitle}
              </span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    opacity: 0.7,
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={STRINGS.tabs.newTab}
        onClick={onNewTab}
        style={{
          background: 'transparent',
          border: '1px dashed var(--ui-border, #283832)',
          color: 'var(--ui-text-secondary, #8ba196)',
          borderRadius: '4px',
          width: '26px',
          height: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        +
      </button>
    </nav>
  );
}
