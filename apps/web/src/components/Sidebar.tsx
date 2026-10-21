import React, { useState } from 'react';

export interface SessionItem {
  id: string;
  title: string;
  pinned?: boolean;
}

export interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession?: (id: string) => void;
  onPinSession?: (id: string, pinned: boolean) => void;
  availableCapabilities: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onPinSession,
  availableCapabilities,
}) => {
  const [search, setSearch] = useState('');
  const caps = new Set(availableCapabilities);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      style={{
        width: '260px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0b0f17',
        borderRight: '1px solid #1e293b',
        color: '#f8fafc',
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            SANCTUM
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              fontWeight: 600,
            }}
          >
            DESKTOP
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          type="button"
          onClick={onNewSession}
          style={{
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            border: '1px solid #334155',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '6px',
          }}
        >
          <span>+</span> New Chat
        </button>

        <button
          type="button"
          onClick={() => onSelectView('chat')}
          style={{
            padding: '8px 12px',
            backgroundColor: activeView === 'chat' ? '#1e293b' : 'transparent',
            color: activeView === 'chat' ? '#f8fafc' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            textAlign: 'left',
            fontSize: '13px',
            fontWeight: activeView === 'chat' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          💬 Chat
        </button>

        {caps.has('models') && (
          <button
            type="button"
            onClick={() => onSelectView('models')}
            style={{
              padding: '8px 12px',
              backgroundColor: activeView === 'models' ? '#1e293b' : 'transparent',
              color: activeView === 'models' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: activeView === 'models' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            🧠 Models
          </button>
        )}

        {caps.has('packs') && (
          <button
            type="button"
            onClick={() => onSelectView('packs')}
            style={{
              padding: '8px 12px',
              backgroundColor: activeView === 'packs' ? '#1e293b' : 'transparent',
              color: activeView === 'packs' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: activeView === 'packs' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            📦 Packs
          </button>
        )}

        {caps.has('settings') && (
          <button
            type="button"
            onClick={() => onSelectView('settings')}
            style={{
              padding: '8px 12px',
              backgroundColor: activeView === 'settings' ? '#1e293b' : 'transparent',
              color: activeView === 'settings' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: activeView === 'settings' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            ⚙️ Settings
          </button>
        )}
      </nav>

      {/* History Search & List */}
      <div style={{ padding: '8px', borderTop: '1px solid #1e293b', flex: 1, overflowY: 'auto' }}>
        <input
          type="text"
          placeholder="Search history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            backgroundColor: '#121824',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            color: '#f8fafc',
            fontSize: '12px',
            boxSizing: 'border-box',
            marginBottom: '8px',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: activeSessionId === session.id ? '#1e293b' : 'transparent',
                color: activeSessionId === session.id ? '#f8fafc' : '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {session.title || 'Untitled Session'}
              </span>
              {session.pinned && <span style={{ fontSize: '11px', marginLeft: '4px' }}>📌</span>}
            </div>
          ))}
          {filteredSessions.length === 0 && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              No conversations
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
