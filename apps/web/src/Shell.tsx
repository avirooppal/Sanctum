import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PanelRegistry } from './panels/registry.js';
import { PanelErrorBoundary } from './panels/ErrorBoundary.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPanel, type ChatMessage } from './components/ChatPanel.js';
import { ModelHubPanel, type HardwareInfo } from './components/ModelHubPanel.js';
import { AssistantsPanel } from './components/AssistantsPanel.js';
import { McpPanel, type PendingToolCall } from './components/McpPanel.js';
import { ProvidersPanel } from './components/ProvidersPanel.js';
import { PacksPanel } from './components/PacksPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandPalette, type CommandItem } from './components/CommandPalette.js';
import { ThreadDrawer, type ThreadParameters } from './components/ThreadDrawer.js';
import { ModelComparePanel } from './components/ModelComparePanel.js';
import { SkillsMemoryPanel } from './components/SkillsMemoryPanel.js';
import type {
  SanctumClient,
  CapabilityReport,
  Model,
  SettingEntry,
  PackInfo,
  AssistantProfile,
  McpServer,
  CloudProvider,
  LocalApiServerStatus,
  Skill,
  Memory,
} from './api.js';

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
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [threadParams, setThreadParams] = useState<ThreadParameters>({
    systemPrompt: 'You are a helpful, thoughtful, local AI assistant.',
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 2048,
    stream: true,
  });

  // Phase 1 state
  const [profiles, setProfiles] = useState<AssistantProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [pendingCalls, setPendingCalls] = useState<PendingToolCall[]>([]);
  const [cloudProviders, setCloudProviders] = useState<CloudProvider[]>([]);
  const [localApiStatus, setLocalApiStatus] = useState<LocalApiServerStatus | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  // Initialize gateway data
  useEffect(() => {
    let active = true;
    const load = async () => {
      // Core capability report
      try {
        const report = await client.getCapabilityReport();
        if (active) {
          setCapabilities(report.capabilities);
          setPlatformAssurance(report.platform_assurance);
          setPacks(report.packs || []);
          if (report.hardware) {
            setHardware({
              threads: report.hardware.threads,
              context: report.hardware.context,
              vram_mb: undefined,       // requires separate probe not yet wired
              total_ram_mb: undefined,  // requires separate probe not yet wired
            });
          }
        }
      } catch { /* Gateway offline — keep defaults */ }

      // Models
      try {
        const m = await client.models();
        if (active && m.length > 0) setModels(m);
      } catch { /* Models offline */ }

      // Settings
      try {
        const s = await client.getSettings();
        if (active) setSettings(s);
      } catch { /* Settings offline */ }

      // Sessions
      try {
        const sess = await client.sessions('', 0);
        if (active && sess.data.length > 0) {
          setSessions(sess.data);
          setActiveSessionId(sess.data[0].id);
        }
      } catch { /* Sessions offline */ }

      // Assistant profiles
      try {
        const prof = await client.profiles();
        if (active) setProfiles(prof);
      } catch { /* Profiles offline */ }

      // MCP servers
      try {
        const servers = await client.mcpServers();
        if (active) setMcpServers(servers);
      } catch { /* MCP offline */ }

      // Cloud providers
      try {
        const cp = await client.cloudProviders();
        if (active) setCloudProviders(cp);
      } catch { /* Providers offline */ }

      // Local API status
      try {
        const la = await client.localApiStatus();
        if (active) setLocalApiStatus(la);
      } catch { /* Local API offline */ }

      // Skills
      try {
        const sk = await client.skills();
        if (active) setSkills(sk);
      } catch { /* Skills offline */ }

      // Memories
      try {
        const mem = await client.memories();
        if (active) setMemories(mem);
      } catch { /* Memories offline */ }
    };

    void load();
    return () => { active = false; };
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
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const convId = activeSessionId || 'default-session';
      const stream = client.chat(
        activeModel,
        [{ role: 'user', content: text }],
        convId,
        undefined,
        activeProfileId ?? undefined,
      );
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
  }, [client, activeModel, activeSessionId, activeProfileId]);

  const handleLoadPack = useCallback(async (id: string) => {
    try {
      const updated = await client.loadPack(id);
      setPacks((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) { console.error('Failed to load pack:', err); }
  }, [client]);

  const handleUnloadPack = useCallback(async (id: string) => {
    try {
      const updated = await client.unloadPack(id);
      setPacks((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) { console.error('Failed to unload pack:', err); }
  }, [client]);

  const handleUpdateSetting = useCallback(async (key: string, value: unknown) => {
    try {
      await client.setSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
    } catch (err) { console.error('Failed to save setting:', err); }
  }, [client]);

  // --- Phase 1 handlers ---

  const handleSaveProfile = useCallback(async (p: { id?: string; name: string; system_prompt: string; scope: string }) => {
    const id = await client.saveProfile(p);
    const updated = await client.profiles();
    setProfiles(updated);
    return id;
  }, [client]);

  const handleDeleteProfile = useCallback(async (id: string) => {
    await client.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  }, [client, activeProfileId]);

  const handleImportGguf = useCallback(async (file: File) => {
    await client.importGguf(file);
    const updated = await client.models();
    setModels(updated);
  }, [client]);

  const handleAddMcpServer = useCallback(async (s: { name: string; command: string; args: string[] }) => {
    const server = await client.addMcpServer(s);
    setMcpServers((prev) => [...prev, server]);
  }, [client]);

  const handleRemoveMcpServer = useCallback(async (id: string) => {
    await client.removeMcpServer(id);
    setMcpServers((prev) => prev.filter((s) => s.id !== id));
  }, [client]);

  const handleApproveCall = useCallback(async (callId: string) => {
    await client.respondMcpCall(callId, true);
    setPendingCalls((prev) => prev.filter((c) => c.callId !== callId));
  }, [client]);

  const handleDenyCall = useCallback(async (callId: string) => {
    await client.respondMcpCall(callId, false);
    setPendingCalls((prev) => prev.filter((c) => c.callId !== callId));
  }, [client]);

  const handleSaveProviderKey = useCallback(async (id: string, apiKey: string) => {
    await client.saveProviderKey(id, apiKey);
    setCloudProviders((prev) => prev.map((p) => p.id === id ? { ...p, has_key: true } : p));
  }, [client]);

  const handleRemoveProviderKey = useCallback(async (id: string) => {
    await client.removeProviderKey(id);
    setCloudProviders((prev) => prev.map((p) => p.id === id ? { ...p, has_key: false } : p));
  }, [client]);

  const handleStartLocalApi = useCallback(async (port: number, allowedOrigins: string) => {
    const status = await client.startLocalApi(port, allowedOrigins);
    setLocalApiStatus(status);
  }, [client]);

  const handleStopLocalApi = useCallback(async () => {
    await client.stopLocalApi();
    setLocalApiStatus((prev) => prev ? { ...prev, running: false } : null);
  }, [client]);

  const handleUpdateLocalApiConfig = useCallback(async (port: number, allowedOrigins: string) => {
    await client.updateLocalApiConfig(port, allowedOrigins);
    setLocalApiStatus((prev) => prev ? { ...prev, port, allowed_origins: allowedOrigins } : null);
  }, [client]);

  const handleSaveSkill = useCallback(async (s: { id?: string; name: string; description?: string; content: string; enabled?: boolean }) => {
    await client.saveSkill(s);
    const updated = await client.skills();
    setSkills(updated);
  }, [client]);

  const handleDeleteSkill = useCallback(async (id: string) => {
    await client.deleteSkill(id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, [client]);

  const handleSaveMemory = useCallback(async (m: { id?: string; assistant_id?: string | null; fact: string; category?: string }) => {
    await client.saveMemory(m);
    const updated = await client.memories();
    setMemories(updated);
  }, [client]);

  const handleDeleteMemory = useCallback(async (id: string) => {
    await client.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, [client]);

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
      id: 'assistants',
      title: 'Assistants',
      icon: '🤖',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: false,
      component: () => (
        <AssistantsPanel
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSelectProfile={setActiveProfileId}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
        />
      ),
    });

    reg.register({
      id: 'models',
      title: 'Model Hub',
      icon: '🧠',
      allowedSlots: ['center', 'right'],
      requiredCapabilities: ['models'],
      defaultVisibility: false,
      component: () => (
        <ModelHubPanel
          models={models}
          activeModelId={activeModel}
          hardware={hardware}
          onSelectModel={setActiveModel}
          onImportGguf={handleImportGguf}
        />
      ),
    });

    reg.register({
      id: 'mcp',
      title: 'MCP Servers',
      icon: '🔌',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: false,
      component: () => (
        <McpPanel
          servers={mcpServers}
          onAddServer={handleAddMcpServer}
          onRemoveServer={handleRemoveMcpServer}
          onApproveCall={handleApproveCall}
          onDenyCall={handleDenyCall}
          pendingCalls={pendingCalls}
        />
      ),
    });

    reg.register({
      id: 'providers',
      title: 'Providers',
      icon: '☁️',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: false,
      component: () => (
        <ProvidersPanel
          providers={cloudProviders}
          localApiStatus={localApiStatus}
          onSaveProviderKey={handleSaveProviderKey}
          onRemoveProviderKey={handleRemoveProviderKey}
          onStartLocalApi={handleStartLocalApi}
          onStopLocalApi={handleStopLocalApi}
          onUpdateLocalApiConfig={handleUpdateLocalApiConfig}
        />
      ),
    });

    reg.register({
      id: 'compare',
      title: 'Model Compare',
      icon: '⚖️',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: false,
      component: () => (
        <ModelComparePanel
          client={client}
          models={models}
          platformAssurance={platformAssurance}
        />
      ),
    });

    reg.register({
      id: 'skills',
      title: 'Skills & Memory',
      icon: '🧠',
      allowedSlots: ['center'],
      requiredCapabilities: ['chat'],
      defaultVisibility: false,
      component: () => (
        <SkillsMemoryPanel
          skills={skills}
          memories={memories}
          profiles={profiles}
          onSaveSkill={handleSaveSkill}
          onDeleteSkill={handleDeleteSkill}
          onSaveMemory={handleSaveMemory}
          onDeleteMemory={handleDeleteMemory}
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
  }, [
    messages, isStreaming, activeModel, models, packs, settings, platformAssurance,
    isDrawerOpen, hardware, profiles, activeProfileId, mcpServers, pendingCalls,
    cloudProviders, localApiStatus, skills, memories,
    handleSendMessage, handleLoadPack, handleUnloadPack, handleUpdateSetting,
    handleSaveProfile, handleDeleteProfile, handleImportGguf,
    handleAddMcpServer, handleRemoveMcpServer, handleApproveCall, handleDenyCall,
    handleSaveProviderKey, handleRemoveProviderKey,
    handleStartLocalApi, handleStopLocalApi, handleUpdateLocalApiConfig,
    handleSaveSkill, handleDeleteSkill, handleSaveMemory, handleDeleteMemory,
  ]);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'new-chat',
      title: 'New Conversation',
      category: 'Chat',
      shortcut: 'Ctrl+N',
      onExecute: () => { setMessages([]); setActiveSessionId(null); setActiveView('chat'); },
    },
    { id: 'open-chat', title: 'Open Chat', category: 'Navigation', onExecute: () => setActiveView('chat') },
    { id: 'open-assistants', title: 'Open Assistants', category: 'Navigation', onExecute: () => setActiveView('assistants') },
    { id: 'open-models', title: 'Open Model Hub', category: 'Navigation', onExecute: () => setActiveView('models') },
    { id: 'open-compare', title: 'Open Model Compare', category: 'Navigation', onExecute: () => setActiveView('compare') },
    { id: 'open-skills', title: 'Open Skills & Memory', category: 'Navigation', onExecute: () => setActiveView('skills') },
    { id: 'open-mcp', title: 'Open MCP Servers', category: 'Navigation', onExecute: () => setActiveView('mcp') },
    { id: 'open-providers', title: 'Open Providers', category: 'Navigation', onExecute: () => setActiveView('providers') },
    { id: 'open-packs', title: 'Open Packs', category: 'Navigation', onExecute: () => setActiveView('packs') },
    { id: 'open-settings', title: 'Open Settings', category: 'Navigation', onExecute: () => setActiveView('settings') },
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
          onNewSession={() => { setMessages([]); setActiveSessionId(null); setActiveView('chat'); }}
          availableCapabilities={capabilities}
          pendingMcpCalls={pendingCalls.length}
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
            onDeleteThread={() => { setMessages([]); setIsDrawerOpen(false); }}
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
