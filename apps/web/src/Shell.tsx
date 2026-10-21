import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PanelRegistry } from './panels/registry.js';
import { PanelErrorBoundary } from './panels/ErrorBoundary.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPanel, type ChatMessage } from './components/ChatPanel.js';
import { ModelsPanel } from './components/ModelsPanel.js';
import { PacksPanel } from './components/PacksPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandPalette, type CommandItem } from './components/CommandPalette.js';
import { ThreadDrawer, type ThreadParameters } from './components/ThreadDrawer.js';
import type { SanctumClient, CapabilityReport, Model, SettingEntry, PackInfo } from './api.js';

export interface ShellProps {
  client: SanctumClient;
  initialCapabilities?: string[];
  initialPlatformAssurance?: string;
}

export const Shell: React.FC<ShellProps> = ({
  client,
  initialCapabilities = ['chat', 'models', 'history', 'settings', 'packs'],
  initialPlatformAssurance = 'not verified',
}) => {
  const [activeView, setActiveView] = useState('chat');
  const [capabilities, setCapabilities] = useState<string[]>(initialCapabilities);
  const [platformAssurance, setPlatformAssurance] = useState<string>(initialPlatformAssurance);
  const [activeModel, setActiveModel] = useState<string>('');
  const [models, setModels] = useState<Model[]>([]);
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [settings, setSettings] = useState<Record<string, SettingEntry>>({});
  const [sessions, setSessions] = useState<{ id: string; title: string; pinned?: boolean }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [threadParams, setThreadParams] = useState<ThreadParameters>({
    systemPrompt: 'You are a helpful, thoughtful, local AI assistant.',
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 2048,
    stream: true,
  });

  // Initialize Panel Registry
  const registry = useMemo(() => {
    const reg = new PanelRegistry();
    reg.register({
      id: 'chat',
      title: 'Chat',
      icon: '💬',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: true,
      component: () => (
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopStreaming={() => setIsStreaming(false)}
          activeModelName={activeModel}
          platformAssurance={platformAssurance}
          isDrawerOpen={isDrawerOpen}
          onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        />
      ),
    });

    reg.register({
      id: 'models',
      title: 'Models',
      icon: '🧠',
      allowedSlots: ['center', 'right'],
      requiredCapabilities: ['models'],
      defaultVisibility: false,
      component: () => (
        <ModelsPanel
          models={models}
          activeModelId={activeModel}
          onSelectModel={setActiveModel}
        />
      ),
    });

    reg.register({
      id: 'packs',
      title: 'Packs',
      icon: '📦',
      allowedSlots: ['center'],
      requiredCapabilities: ['packs'],
      defaultVisibility: false,
      component: () => (
        <PacksPanel
          packs={packs}
          platformAssurance={platformAssurance}
          onLoadPack={handleLoadPack}
          onUnloadPack={handleUnloadPack}
        />
      ),
    });

    reg.register({
      id: 'settings',
      title: 'Settings',
      icon: '⚙️',
      allowedSlots: ['center'],
      requiredCapabilities: ['settings'],
      defaultVisibility: false,
      component: () => (
        <SettingsPanel
          settings={settings}
          platformAssurance={platformAssurance}
          onUpdateSetting={handleUpdateSetting}
        />
      ),
    });

    return reg;
  }, [messages, isStreaming, activeModel, models, packs, settings, platformAssurance, isDrawerOpen]);

  // Load gateway capabilities and metadata
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const report = await client.getCapabilityReport();
        if (active) {
          setCapabilities(report.capabilities);
          setPlatformAssurance(report.platform_assurance);
          setPacks(report.packs || []);
        }
      } catch {
        // Fallback to initial defaults if offline
      }

      try {
        const m = await client.models();
        if (active && m.length > 0) {
          setModels(m);
        }
      } catch {
        // Models offline fallback
      }

      try {
        const s = await client.getSettings();
        if (active) setSettings(s);
      } catch {
        // Settings offline fallback
      }

      try {
        const sess = await client.sessions('', 0);
        if (active && sess.data.length > 0) {
          setSessions(sess.data);
          setActiveSessionId(sess.data[0].id);
        }
      } catch {
        // Sessions offline fallback
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [client]);

  // Command palette keyboard shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const convId = activeSessionId || 'default-session';
      const stream = client.chat(activeModel, [{ role: 'user', content: text }], convId);
      for await (const chunk of stream) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: msg.content || 'Engine response unavailable (offline).' }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [client, activeModel, activeSessionId]);

  const handleLoadPack = useCallback(async (id: string) => {
    try {
      const updated = await client.loadPack(id);
      setPacks((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error('Failed to load pack:', err);
    }
  }, [client]);

  const handleUnloadPack = useCallback(async (id: string) => {
    try {
      const updated = await client.unloadPack(id);
      setPacks((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error('Failed to unload pack:', err);
    }
  }, [client]);

  const handleUpdateSetting = useCallback(async (key: string, value: unknown) => {
    try {
      await client.setSetting(key, value);
      setSettings((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          value,
        },
      }));
    } catch (err) {
      console.error('Failed to save setting:', err);
    }
  }, [client]);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'new-chat',
      title: 'New Conversation',
      category: 'Chat',
      shortcut: 'Ctrl+N',
      onExecute: () => {
        setMessages([]);
        setActiveSessionId(null);
        setActiveView('chat');
      },
    },
    {
      id: 'open-chat',
      title: 'Open Chat View',
      category: 'Navigation',
      onExecute: () => setActiveView('chat'),
    },
    {
      id: 'open-models',
      title: 'Open Models Manager',
      category: 'Navigation',
      onExecute: () => setActiveView('models'),
    },
    {
      id: 'open-packs',
      title: 'Open Packs Browser',
      category: 'Navigation',
      onExecute: () => setActiveView('packs'),
    },
    {
      id: 'open-settings',
      title: 'Open Settings',
      category: 'Navigation',
      onExecute: () => setActiveView('settings'),
    },
  ], []);

  const activePanelDef = registry.get(activeView);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={() => {
            setMessages([]);
            setActiveSessionId(null);
            setActiveView('chat');
          }}
          availableCapabilities={capabilities}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelErrorBoundary panelTitle={activePanelDef?.title || 'Main View'}>
            {activePanelDef ? (
              <activePanelDef.component panelId={activePanelDef.id} isActive={true} />
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                Panel unavailable or lacks required capabilities.
              </div>
            )}
          </PanelErrorBoundary>
        </main>

        {activeView === 'chat' && (
          <ThreadDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            activeModel={activeModel}
            models={models}
            onSelectModel={setActiveModel}
            params={threadParams}
            onUpdateParams={(p) => setThreadParams((prev) => ({ ...prev, ...p }))}
            onDeleteThread={() => {
              setMessages([]);
              setIsDrawerOpen(false);
            }}
          />
        )}
      </div>

      <StatusBar
        isReady={true}
        platformAssurance={platformAssurance}
        activeModelName={activeModel}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
};
