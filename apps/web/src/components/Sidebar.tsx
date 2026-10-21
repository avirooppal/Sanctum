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
  pendingMcpCalls?: number;
  isOpen?: boolean;
  onToggleOpen?: () => void;
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
  pendingMcpCalls = 0,
  isOpen = true,
  onToggleOpen,
}) => {
  const [search, setSearch] = useState('');

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter((s) => s.pinned);
  const recentSessions = filteredSessions.filter((s) => !s.pinned);

  if (!isOpen) {
    return (
      <aside className="w-12 h-full flex flex-col items-center py-3 bg-sidebar text-sidebar-foreground border-r border-border/40 select-none shrink-0 z-20">
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          title="Expand sidebar"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <button
          onClick={onNewSession}
          className="mt-3 p-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-xs"
          title="New Chat (Ctrl+N)"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[16rem] h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-border/40 select-none shrink-0 z-20">
      {/* Sidebar Header: Brand Name + Trigger */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border/20">
        <div className="flex items-center gap-2">
          <span className="font-studio font-medium text-base text-foreground tracking-tight">Sanctum</span>
        </div>
        {onToggleOpen && (
          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        )}
      </div>

      {/* NavMain: Core Navigation Actions */}
      <div className="px-2 py-2 space-y-0.5 border-b border-border/20">
        <button
          data-testid="nav-new-chat"
          onClick={() => {
            onNewSession();
            onSelectView('chat');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'chat' && !activeSessionId
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'hover:bg-sidebar-accent text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>New Chat</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-border/40 px-1 py-0.5 rounded">Ctrl+N</span>
        </button>

        <button
          data-testid="nav-hub"
          onClick={() => onSelectView('hub')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'hub' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          <span>Model Hub</span>
        </button>

        <button
          data-testid="nav-assistants"
          onClick={() => onSelectView('assistants')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'assistants' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
          </svg>
          <span>Assistants</span>
        </button>

        <button
          data-testid="nav-mcp"
          onClick={() => onSelectView('mcp')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'mcp' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            <span>MCP Servers</span>
          </div>
          {pendingMcpCalls > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground font-semibold px-1.5 py-0.2 rounded-full">
              {pendingMcpCalls}
            </span>
          )}
        </button>

        <button
          data-testid="nav-providers"
          onClick={() => onSelectView('providers')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'providers' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          <span>Model Providers</span>
        </button>

        <button
          data-testid="nav-settings"
          onClick={() => onSelectView('settings')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'settings' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-border/40 px-1 py-0.5 rounded">Ctrl+,</span>
        </button>
      </div>

      {/* Search Input (Only when sessions exist) */}
      {sessions.length > 0 && (
        <div className="px-3 py-2 border-b border-border/20">
          <div className="relative flex items-center">
            <svg className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border/40 bg-sidebar-foreground/5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Thread List / Chats */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {pinnedSessions.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <svg className="size-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
              <span>Pinned</span>
            </div>
            {pinnedSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  onSelectView('chat');
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  activeSessionId === s.id && activeView === 'chat'
                    ? 'bg-sidebar-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                }`}
              >
                <span className="truncate flex-1 pr-1">{s.title}</span>
                {onPinSession && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinSession(s.id, false);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-primary transition-opacity"
                    title="Unpin"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {recentSessions.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Chats
            </div>
            {recentSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  onSelectView('chat');
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  activeSessionId === s.id && activeView === 'chat'
                    ? 'bg-sidebar-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                }`}
              >
                <span className="truncate flex-1 pr-1">{s.title}</span>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  {onPinSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinSession(s.id, true);
                      }}
                      className="p-0.5 hover:text-primary"
                      title="Pin chat"
                    >
                      📌
                    </button>
                  )}
                  {onDeleteSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      className="p-0.5 hover:text-destructive"
                      title="Delete chat"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
