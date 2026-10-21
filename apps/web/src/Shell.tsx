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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [showFirstLaunchConsent, setShowFirstLaunchConsent] = useState(false);
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
              vram_mb: undefined,
              total_ram_mb: undefined,
            });
          }
        }
      } catch { /* Gateway offline — keep defaults */ }

      // Models
      try {
        const m = await client.models();
        if (active && m.length > 0) {
          setModels(m);
          setActiveModel(m[0].id);
        }
      } catch { /* Models offline */ }

      // Settings
      try {
        const s = await client.getSettings();
        if (active) setSettings(s);
      } catch { /* Settings offline */ }

      // Sessions
      try {
        const sess = await client.sessions('', 0);
        if (active) {
          setSessions(sess.data.map((s) => ({ id: s.id, title: s.title || `Chat ${s.id.slice(0, 8)}`, pinned: false })));
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

      // Skills & Memories
      try {
        const [sk, mem] = await Promise.all([client.skills(), client.memories()]);
        if (active) {
          setSkills(sk);
          setMemories(mem);
        }
      } catch { /* Skills offline */ }
    };

    void load();
    return () => { active = false; };
  }, [client]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setMessages([]);
        setActiveSessionId(null);
        setActiveView('chat');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', speed: '' };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const startTime = performance.now();
      let tokenCount = 0;

      try {
        const stream = client.chat(
          activeModel || 'default',
          [{ role: 'user', content: text }],
          activeSessionId || 'default',
          undefined,
          threadParams.systemPrompt
        );

        for await (const chunk of stream) {
          tokenCount++;
          const elapsedSec = (performance.now() - startTime) / 1000;
          const speed = elapsedSec > 0 ? `${(tokenCount / elapsedSec).toFixed(1)} tok/s` : '';

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk, speed } : m
            )
          );
        }
      } catch (err: unknown) {
        const errorText = err instanceof Error ? err.message : 'Inference error';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + `\n\n*[Error: ${errorText}]*` } : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [client, activeModel, threadParams, activeSessionId]
  );

  const handleStopStreaming = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const handleImportGguf = async (file: File) => {
    const newModel = await client.importGguf(file);
    setModels((prev) => [...prev, newModel]);
    setActiveModel(newModel.id);
  };

  const handleUpdateSetting = async (key: string, value: unknown) => {
    await client.setSetting(key, value);
    const updated = await client.getSettings();
    setSettings(updated);
  };

  const handleLoadPack = async (packId: string) => {
    const updated = await client.loadPack(packId);
    setPacks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleUnloadPack = async (packId: string) => {
    const updated = await client.unloadPack(packId);
    setPacks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Phase 1 Handlers
  const handleSaveProfile = async (profile: { id?: string; name: string; system_prompt: string; scope: string }) => {
    const savedId = await client.saveProfile(profile);
    const prof = await client.profiles();
    setProfiles(prof);
    return savedId;
  };

  const handleDeleteProfile = async (id: string) => {
    await client.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  };

  const handleAddMcpServer = async (server: { name: string; command: string; args: string[] }) => {
    const added = await client.addMcpServer(server);
    setMcpServers((prev) => [...prev, added]);
  };

  const handleRemoveMcpServer = async (id: string) => {
    await client.removeMcpServer(id);
    setMcpServers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleApproveCall = async (callId: string) => {
    await client.respondMcpCall(callId, true);
    setPendingCalls((prev) => prev.filter((c) => c.callId !== callId));
  };

  const handleDenyCall = async (callId: string) => {
    await client.respondMcpCall(callId, false);
    setPendingCalls((prev) => prev.filter((c) => c.callId !== callId));
  };

  const handleSaveProviderKey = async (provider: string, apiKey: string) => {
    await client.saveProviderKey(provider, apiKey);
    setCloudProviders((prev) =>
      prev.map((p) => (p.id === provider ? { ...p, configured: true, error: undefined } : p))
    );
  };

  const handleRemoveProviderKey = async (provider: string) => {
    await client.removeProviderKey(provider);
    setCloudProviders((prev) =>
      prev.map((p) => (p.id === provider ? { ...p, configured: false } : p))
    );
  };

  const handleStartLocalApi = async (port: number, allowedOrigins: string) => {
    const res = await client.startLocalApi(port, allowedOrigins);
    setLocalApiStatus(res);
  };

  const handleStopLocalApi = async () => {
    await client.stopLocalApi();
    setLocalApiStatus((prev) => (prev ? { ...prev, running: false } : null));
  };

  const handleUpdateLocalApiConfig = async (port: number, allowedOrigins: string) => {
    await client.updateLocalApiConfig(port, allowedOrigins);
    setLocalApiStatus((prev) => (prev ? { ...prev, port, allowed_origins: allowedOrigins } : null));
  };

  const handleSaveSkill = async (skill: { id?: string; name: string; description?: string; content: string; enabled?: boolean }) => {
    await client.saveSkill(skill);
    const refreshed = await client.skills();
    setSkills(refreshed);
  };

  const handleDeleteSkill = async (id: string) => {
    await client.deleteSkill(id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveMemory = async (memory: { id?: string; assistant_id?: string | null; fact: string; category?: string }) => {
    await client.saveMemory(memory);
    const refreshed = await client.memories();
    setMemories(refreshed);
  };

  const handleDeleteMemory = async (id: string) => {
    await client.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  // Register standard panels into PanelRegistry
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
          onStopStreaming={handleStopStreaming}
          activeModelName={activeModel}
          availableModels={models}
          onSelectModel={setActiveModel}
          isDrawerOpen={isDrawerOpen}
          onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
          onNewChat={() => {
            setMessages([]);
            setActiveSessionId(null);
            setActiveView('chat');
          }}
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
      id: 'hub',
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
      title: 'Extension Packs',
      icon: '📦',
      allowedSlots: ['center'],
      requiredCapabilities: ['packs'],
      defaultVisibility: false,
      component: () => (
        <PacksPanel
          packs={packs}
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
          onUpdateSetting={handleUpdateSetting}
        />
      ),
    });

    return reg;
  }, [
    messages,
    isStreaming,
    activeModel,
    models,
    packs,
    settings,
    platformAssurance,
    isDrawerOpen,
    profiles,
    activeProfileId,
    mcpServers,
    pendingCalls,
    cloudProviders,
    localApiStatus,
    skills,
    memories,
    hardware,
  ]);

  const activePanelDef = registry.get(activeView);

  const commands: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'new-chat',
        title: 'New Chat',
        category: 'Chat',
        shortcut: 'Ctrl+N',
        onExecute: () => {
          setMessages([]);
          setActiveSessionId(null);
          setActiveView('chat');
        },
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        category: 'View',
        shortcut: 'Ctrl+B',
        onExecute: () => setIsSidebarOpen((prev) => !prev),
      },
      {
        id: 'view-chat',
        title: 'Go to Chat',
        category: 'Navigation',
        onExecute: () => setActiveView('chat'),
      },
      {
        id: 'view-hub',
        title: 'Go to Model Hub',
        category: 'Navigation',
        onExecute: () => setActiveView('hub'),
      },
      {
        id: 'view-assistants',
        title: 'Go to Assistants',
        category: 'Navigation',
        onExecute: () => setActiveView('assistants'),
      },
      {
        id: 'view-mcp',
        title: 'Go to MCP Servers',
        category: 'Navigation',
        onExecute: () => setActiveView('mcp'),
      },
      {
        id: 'view-providers',
        title: 'Go to Model Providers',
        category: 'Navigation',
        onExecute: () => setActiveView('providers'),
      },
      {
        id: 'view-compare',
        title: 'Go to Model Compare Arena',
        category: 'Navigation',
        onExecute: () => setActiveView('compare'),
      },
      {
        id: 'view-skills',
        title: 'Go to Skills & Memory Ledger',
        category: 'Navigation',
        onExecute: () => setActiveView('skills'),
      },
      {
        id: 'view-settings',
        title: 'Go to Settings',
        category: 'Navigation',
        onExecute: () => setActiveView('settings'),
      },
    ];
  }, []);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar: Copied exactly from Jan left sidebar structure */}
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
        pendingMcpCalls={pendingCalls.length}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Surface Inset (SidebarInset in upstream) */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-background">
        <PanelErrorBoundary panelTitle={activePanelDef?.title || 'Main View'}>
          {activePanelDef ? (
            <activePanelDef.component panelId={activePanelDef.id} isActive={true} />
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Panel unavailable or lacks required capabilities.
            </div>
          )}
        </PanelErrorBoundary>
      </main>

      {/* Collapsible Parameters Drawer (Right Drawer in upstream) */}
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

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* First-Launch Model Acquisition Consent Dialog (Permitted Deviation #4) */}
      {showFirstLaunchConsent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 text-foreground">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold">Download Default Model</h3>
              <button
                onClick={() => setShowFirstLaunchConsent(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sanctum requires explicit confirmation before initiating network connections.
              <br />
              <br />
              <strong>Host:</strong> huggingface.co
              <br />
              <strong>Model:</strong> Llama-3.2-1B-Instruct-GGUF (~1.3 GB)
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => {
                  setShowFirstLaunchConsent(false);
                  setActiveView('hub');
                }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
              >
                Import Local GGUF
              </button>
              <button
                onClick={() => setShowFirstLaunchConsent(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowFirstLaunchConsent(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs"
              >
                Confirm Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
