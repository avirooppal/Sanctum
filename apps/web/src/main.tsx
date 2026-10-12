import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { SpeechPanel } from './SpeechPanel';
import { MeetingPanel } from './MeetingPanel';

import { SanctumClient, type Message, type Model } from './api';
import { ChatRun } from './chat-run';
import { ChatView } from './ui/ChatView';
import { RightRail } from './ui/RightRail';
import { StatusBar } from './ui/StatusBar';
import { KnowledgePanel } from './KnowledgePanel';
import { HistoryPanel } from './HistoryPanel';
import './ui/knowledge.css';
import { Button, Dialog } from './ui/primitives';
import './ui/primitives.css';
import thirdPartyNotices from '../../../THIRD_PARTY_NOTICES.md?raw';
import './ui/themes.css';
import './ui/fonts.css';
import { AppShell } from './ui/AppShell';
import './ui/shell.css';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { DashboardPanel } from './DashboardPanel';
import { DashboardPage, type DashboardSubpage } from './ui/DashboardPage';
import { SetupWizard } from './SetupWizard';

import { ThemeControls } from './ui/ThemeControls';
import { registerPanel, getRegisteredPanels, filterPanelsByCapabilities } from './ui/PanelRegistry';
import {
  type UserPreferences,
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  enforceContrastGuard,
} from './ui/Customization';
import { themeTokens } from './ui/themes';
import { CommandPalette, type CommandAction } from './ui/CommandPalette';
import { SettingsModal } from './ui/SettingsModal';
import { UndoToastContainer, type ToastItem } from './ui/UndoToast';
import { DesignGallery } from './ui/Gallery';
import { STRINGS } from './ui/strings';

const PROMPT_SUGGESTIONS = [
  { title: 'Explain a technical concept', prompt: 'Explain how local on-device LLMs run without cloud dependencies.' },
  { title: 'Analyze code & find bugs', prompt: 'Review this code for edge cases and security vulnerabilities:\n\n```python\ndef handler(req):\n    pass\n```' },
  { title: 'Summarize notes & documents', prompt: 'Summarize the core takeaways from my notes in bullet points.' },
  { title: 'Draft an architectural proposal', prompt: 'Draft a concise architecture decision record for local-first storage.' },
];

function App() {
  const [token, setToken] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [modelObjects, setModelObjects] = useState<Model[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState('');
  const [showWizard, setShowWizard] = useState(() => typeof window !== 'undefined' && window.location.search.includes('wizard=1'));
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatRun = useMemo(() => new ChatRun(), []);
  useEffect(() => () => chatRun.stop(), [chatRun]);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<string>(crypto.randomUUID());
  const [historyRevision, setHistoryRevision] = useState(0);

  // Overlays & Routing
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [route, setRoute] = useState<'workspace' | 'dashboard'>('workspace');
  const [dashboardSubpage, setDashboardSubpage] = useState<DashboardSubpage>('status');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(false);

  useEffect(() => {
    const syncRouteFromHash = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash.startsWith('#/dashboard')) {
        setRoute('dashboard');
        const parts = hash.split('/');
        const sub = parts[2] as DashboardSubpage;
        if (['status', 'models', 'sessions', 'resources', 'config', 'licenses'].includes(sub)) {
          setDashboardSubpage(sub);
        } else {
          setDashboardSubpage('status');
        }
      } else {
        setRoute('workspace');
      }
    };

    syncRouteFromHash();
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', syncRouteFromHash);
      return () => window.removeEventListener('hashchange', syncRouteFromHash);
    }
  }, []);

  const navigateToDashboard = (subpage: DashboardSubpage = 'status') => {
    if (typeof window !== 'undefined') {
      window.location.hash = `#/dashboard/${subpage}`;
    } else {
      setRoute('dashboard');
      setDashboardSubpage(subpage);
    }
  };

  const navigateToWorkspace = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    } else {
      setRoute('workspace');
    }
  };

  // Preferences & Capabilities
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [capabilities, setCapabilities] = useState<string[]>(['chat', 'models', 'history', 'dashboard', 'preferences', 'knowledge', 'speech']);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lastDeletedSession, setLastDeletedSession] = useState<{ id: string; title?: string } | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const api = useMemo(() => new SanctumClient(token), [token]);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    setHistoryRevision(n => n + 1);
  }

  // Load capabilities & server preferences on authentication
  useEffect(() => {
    if (!token) return;
    api.capabilities()
      .then(res => {
        if (res.capabilities) setCapabilities(res.capabilities);
      })
      .catch(() => {});

    api.preferences()
      .then(serverPrefs => {
        if (serverPrefs) {
          const { preferences: sanitized } = sanitizePreferences(serverPrefs);
          setPreferences(sanitized);
        }
      })
      .catch(() => {});

    api.models()
      .then(async data => {
        setModelObjects(data);
        const textModels = data.filter(m => m.capabilities.includes('text')).map(m => m.id);
        setModels(textModels);
        setModel(textModels[0] || '');
        await refresh();
      })
      .catch(e => {
        setError(e.message);
        setToken('');
      });
  }, [token]);

  // Apply theme tokens to root element
  useEffect(() => {
    const effectiveMode = preferences.mode === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preferences.mode;
    try {
      const tokens = themeTokens(preferences.theme, effectiveMode);
      const root = document.documentElement;
      for (const [key, val] of Object.entries(tokens)) {
        root.style.setProperty(key, val);
      }
      // Apply accent override if custom
      if (preferences.accentColor) {
        const bg = tokens['--ui-background'] || '#0f1412';
        const checked = enforceContrastGuard(preferences.accentColor, bg);
        root.style.setProperty('--ui-accent', checked.effectiveHex);
      }
    } catch {
      // Fallback safely to sanctum theme
    }
  }, [preferences.theme, preferences.mode, preferences.accentColor]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(open => !open);
        return;
      }
      // Settings (Ctrl+,)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(open => !open);
        return;
      }
      // New conversation (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        setConversation(crypto.randomUUID());
        setMessages([]);
        setError('');
        return;
      }
      // Focus composer (Ctrl+/)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        composerRef.current?.focus();
        return;
      }
      // Toggle Right Rail (Ctrl+J or Cmd+J)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setRightRailOpen(open => !open);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updatePreferences = (updated: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updated };
      if (token) {
        api.savePreferences(next as any).catch(() => {});
      }
      return next;
    });
  };

  const handleSessionDeleted = (id: string) => {
    setLastDeletedSession({ id });
    const toastId = crypto.randomUUID();
    setToasts(prev => [
      ...prev,
      {
        id: toastId,
        message: STRINGS.toast.sessionDeleted,
        durationMs: 5000,
        onUndo: () => {
          // Undo restoration
          refresh();
        },
      },
    ]);
    if (id === conversation) {
      setConversation(crypto.randomUUID());
      setMessages([]);
    }
  };

  async function handleSlashCommand(input: string): Promise<boolean> {
    const trimmed = input.trim();
    if (trimmed === '/help') {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: '/help' },
        {
          role: 'assistant',
          content:
            '**Available Slash Commands:**\n- `/help` - Show available local commands\n- `/clear` - Clear messages in current session\n- `/stop` - Stop current generation\n- `/info` - Show active model and privacy invariants',
        },
      ]);
      setPrompt('');
      return true;
    }
    if (trimmed === '/clear') {
      setMessages([]);
      setPrompt('');
      setChatStatus('Conversation cleared.');
      return true;
    }
    if (trimmed === '/stop') {
      if (busy || chatRun.active) {
        chatRun.stop();
        setChatStatus('Generation stopped.');
      }
      setPrompt('');
      return true;
    }
    if (trimmed === '/info') {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: '/info' },
        {
          role: 'assistant',
          content: `**Sanctum Active Runtime Info**\n- **Model**: \`${model || 'none'}\` (Local on-device inference)\n- **Privacy**: ${STRINGS.app.privacyVerified}\n- **Storage**: Local session turns, zero telemetry`,
        },
      ]);
      setPrompt('');
      return true;
    }
    return false;
  }

  async function send(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const input = prompt.trim();
    if (!input || busy || chatRun.active) return;
    setError('');
    setChatStatus('');
    if (input.startsWith('/')) {
      const handled = await handleSlashCommand(input);
      if (handled) return;
    }
    setBusy(true);
    const next: Message[] = [...messages, { role: 'user', content: prompt }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setPrompt('');
    let answer = '';
    try {
      const result = await chatRun.start(
        signal => api.chat(model, next, conversation, signal, activeProfileId || undefined),
        delta => {
          answer += delta;
          setMessages([...next, { role: 'assistant', content: answer }]);
        }
      );
      if (result === 'stopped') setChatStatus('Generation stopped. Partial text is not guaranteed to be saved.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
    }
  }

  async function load(id: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const turns = await api.turns(id);
      const all: Message[] = [];
      for (const turn of turns) {
        const request = JSON.parse(turn.request);
        const last = request.messages.filter((m: Message) => m.role === 'user').at(-1);
        if (last) all.push(last);
        let answer = '';
        if (turn.streaming) {
          for (const line of turn.response.split('\n')) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              const event = JSON.parse(line.slice(6));
              answer += event.choices?.[0]?.delta?.content || '';
            }
          }
        } else answer = JSON.parse(turn.response).choices?.[0]?.message?.content || '';
        all.push({ role: 'assistant', content: answer });
      }
      setConversation(id);
      setMessages(all);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const commandActions: CommandAction[] = useMemo(() => [
    {
      id: 'new_chat',
      category: 'Session',
      title: STRINGS.navigation.newChat,
      shortcut: 'Ctrl+N',
      onSelect: () => {
        setConversation(crypto.randomUUID());
        setMessages([]);
      },
    },
    {
      id: 'clear',
      category: 'Session',
      title: 'Clear Conversation',
      onSelect: () => setMessages([]),
    },
    {
      id: 'stop_generation',
      category: 'Session',
      title: 'Stop Generation',
      shortcut: 'Escape',
      onSelect: () => {
        if (chatRun.active) chatRun.stop();
      },
    },
    {
      id: 'settings',
      category: 'Preferences',
      title: STRINGS.navigation.settings,
      shortcut: 'Ctrl+,',
      onSelect: () => setSettingsOpen(true),
    },
    {
      id: 'settings_profiles',
      category: 'Preferences',
      title: 'Open Assistant Profiles',
      onSelect: () => setSettingsOpen(true),
    },
    {
      id: 'settings_models',
      category: 'Preferences',
      title: 'Open Model Role Allocations',
      onSelect: () => setSettingsOpen(true),
    },
    {
      id: 'toggle_mode',
      category: 'Appearance',
      title: `Toggle Theme Mode (Current: ${preferences.mode})`,
      onSelect: () => {
        updatePreferences({
          mode: preferences.mode === 'dark' ? 'light' : 'dark',
        });
      },
    },
    {
      id: 'theme_sanctum',
      category: 'Theme',
      title: 'Switch Theme: Sanctum (Default)',
      onSelect: () => updatePreferences({ theme: 'sanctum' }),
    },
    {
      id: 'theme_nord',
      category: 'Theme',
      title: 'Switch Theme: Nord',
      onSelect: () => updatePreferences({ theme: 'nord' }),
    },
    {
      id: 'theme_solarized_dark',
      category: 'Theme',
      title: 'Switch Theme: Solarized Dark',
      onSelect: () => updatePreferences({ theme: 'solarized-dark' }),
    },
    {
      id: 'theme_solarized_light',
      category: 'Theme',
      title: 'Switch Theme: Solarized Light',
      onSelect: () => updatePreferences({ theme: 'solarized-light' }),
    },
    {
      id: 'theme_gruvbox',
      category: 'Theme',
      title: 'Switch Theme: Gruvbox',
      onSelect: () => updatePreferences({ theme: 'gruvbox' }),
    },
    {
      id: 'theme_tokyo_night',
      category: 'Theme',
      title: 'Switch Theme: Tokyo Night',
      onSelect: () => updatePreferences({ theme: 'tokyo-night' }),
    },
    {
      id: 'theme_catppuccin',
      category: 'Theme',
      title: 'Switch Theme: Catppuccin Mocha',
      onSelect: () => updatePreferences({ theme: 'catppuccin-mocha' }),
    },
    {
      id: 'layout_default',
      category: 'Layout',
      title: 'Apply Layout: Default',
      onSelect: () => updatePreferences({ activeLayout: 'default' }),
    },
    {
      id: 'layout_focus',
      category: 'Layout',
      title: 'Apply Layout: Focus Mode',
      onSelect: () => updatePreferences({ activeLayout: 'focus' }),
    },
    {
      id: 'layout_quad',
      category: 'Layout',
      title: 'Apply Layout: Quad Panes',
      onSelect: () => updatePreferences({ activeLayout: 'quad' }),
    },
    {
      id: 'layout_console',
      category: 'Layout',
      title: 'Apply Layout: Console View',
      onSelect: () => updatePreferences({ activeLayout: 'console' }),
    },
    {
      id: 'toggle_right_rail',
      category: 'Layout',
      title: STRINGS.shell.toggleRightRail,
      shortcut: 'Ctrl+J',
      onSelect: () => setRightRailOpen(open => !open),
    },
    {
      id: 'dashboard',
      category: 'Navigation',
      title: STRINGS.navigation.dashboard,
      onSelect: () => navigateToDashboard('status'),
    },
    {
      id: 'dashboard_models',
      category: 'Navigation',
      title: 'Dashboard: Models',
      onSelect: () => navigateToDashboard('models'),
    },
    {
      id: 'dashboard_sessions',
      category: 'Navigation',
      title: 'Dashboard: Sessions',
      onSelect: () => navigateToDashboard('sessions'),
    },
    {
      id: 'dashboard_resources',
      category: 'Navigation',
      title: 'Dashboard: Resources',
      onSelect: () => navigateToDashboard('resources'),
    },
    {
      id: 'dashboard_config',
      category: 'Navigation',
      title: 'Dashboard: Config',
      onSelect: () => navigateToDashboard('config'),
    },
    {
      id: 'dashboard_licenses',
      category: 'Navigation',
      title: 'Dashboard: Licenses',
      onSelect: () => navigateToDashboard('licenses'),
    },
    {
      id: 'knowledge',
      category: 'Navigation',
      title: STRINGS.navigation.knowledge,
      onSelect: () => setKnowledgeOpen(true),
    },
    {
      id: 'licenses',
      category: 'Navigation',
      title: 'Third-Party Notices & Licenses',
      onSelect: () => setLicensesOpen(true),
    },
  ], [preferences.mode]);

  if (route === 'dashboard') {
    return (
      <div data-density={preferences.density} style={{ fontSize: `${preferences.fontSizeScale}%` }}>
        <DashboardPage
          token={token}
          activeSubpage={dashboardSubpage}
          onNavigateSubpage={navigateToDashboard}
          onBackToWorkspace={navigateToWorkspace}
          api={api}
          thirdPartyNoticesText={thirdPartyNotices}
          activeModel={model}
        />
        <CommandPalette
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          actions={commandActions}
        />
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onResetPreferences={() => updatePreferences(DEFAULT_PREFERENCES)}
          api={api}
          token={token}
          conversationId={conversation}
          messages={messages}
          models={modelObjects}
          activeProfileId={activeProfileId}
          onSelectProfile={id => setActiveProfileId(id)}
          onPurgeComplete={() => {
            setConversation(crypto.randomUUID());
            setMessages([]);
            refresh();
          }}
          thirdPartyNoticesText={thirdPartyNotices}
        />
      </div>
    );
  }

  return (
    <div data-density={preferences.density} style={{ fontSize: `${preferences.fontSizeScale}%` }}>
      <AppShell
        sidebar={
          <>
            <div className="text-2xl tracking-tight font-semibold ui-wordmark">◈ Sanctum</div>
            <p className="text-xs ui-text-secondary mt-2 text-display tracking-[.18em]">
              A private place to think
            </p>
            <button
              disabled={busy}
              className="mt-10 border ui-border rounded-lg px-4 py-3 text-left ui-hover"
              onClick={() => {
                setConversation(crypto.randomUUID());
                setMessages([]);
                setError('');
              }}
            >
              ＋ {STRINGS.navigation.newChat}
            </button>
            <p className="mt-9 mb-3 text-xs text-display tracking-wider ui-text-secondary">
              Your conversations
            </p>
            {token && (
              <HistoryPanel
                api={api}
                current={conversation}
                busy={busy}
                revision={historyRevision}
                onLoad={load}
                onDeleted={handleSessionDeleted}
              />
            )}
            <div className="mt-auto pt-10 text-xs ui-text-secondary leading-6">
              ● Local models only<br />
              Cloud connections disabled<br />
              <div className="flex flex-wrap gap-2 my-2">
                {token && capabilities.includes('dashboard') && (
                  <Button variant="outline" onClick={() => navigateToDashboard('status')}>
                    Dashboard
                  </Button>
                )}
                {token && capabilities.includes('knowledge') && (
                  <Button variant="outline" onClick={() => setKnowledgeOpen(true)}>
                    Knowledge
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                  Preferences
                </Button>
                <Button variant="outline" onClick={() => setLicensesOpen(true)}>
                  Licenses
                </Button>
              </div>
              <ThemeControls />
            </div>
          </>
        }

        header={
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm ui-text-secondary">Your workspace / Chat</span>
              {token && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  live
                </span>
              )}
            </div>
            {model && (
              <div className="flex items-center gap-2">
                <select
                  aria-label="Model"
                  className="ui-surface rounded-lg border ui-border p-2 text-sm"
                  value={model}
                  disabled={busy}
                  onChange={e => setModel(e.target.value)}
                >
                  {models.map(id => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
                <span
                  className="text-[11px] px-2 py-0.5 rounded border ui-border text-display ui-text-secondary"
                  title="Runs on device with verified open license"
                >
                  On-Device · Local
                </span>
              </div>
            )}
            {token && (
              <button
                type="button"
                onClick={() => setRightRailOpen(o => !o)}
                aria-label="Toggle right rail"
                title={STRINGS.shell.toggleRightRail}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ui-border transition-colors flex items-center gap-1.5 ${
                  rightRailOpen
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'ui-surface ui-text-secondary hover:text-foreground'
                }`}
              >
                <span>◨</span> <span className="hidden md:inline">Artifacts</span>
              </button>
            )}
          </>
        }
        rightRail={
          token ? (
            <RightRail
              messages={messages}
              api={api}
              isOpen={rightRailOpen}
              onClose={() => setRightRailOpen(false)}
              onCitationClick={() => setKnowledgeOpen(true)}
            />
          ) : undefined
        }
        statusBar={
          token ? (
            <StatusBar
              api={api}
              conversation={conversation}
              activeModel={model}
              models={modelObjects}
              onSelectModel={setModel}
            />
          ) : undefined
        }
      >
        {token && <MeetingPanel token={token} />}

        {!token ? (
          showWizard ? (
            <div className="m-auto w-full max-w-2xl py-6">
              <SetupWizard
                onComplete={(t, initialPrompt) => {
                  setToken(t);
                  setShowWizard(false);
                  if (initialPrompt) setPrompt(initialPrompt);
                }}
                defaultToken={keyInput}
              />
              <div className="text-center mt-4">
                <button
                  className="text-xs ui-text-secondary underline hover:opacity-80"
                  onClick={() => setShowWizard(false)}
                >
                  Or enter existing access key directly
                </button>
              </div>
            </div>
          ) : (
            <section className="m-auto w-full max-w-md">
              <div className="text-5xl ui-text-accent mb-6">◈</div>
              <h1 className="text-3xl font-semibold mb-3">Welcome to your Sanctum.</h1>
              <p className="ui-text-secondary mb-6 leading-relaxed">
                Local AI that runs 100% on your device with zero cloud telemetry.
              </p>
              <div className="mb-6 p-4 rounded-xl border ui-border bg-neutral-500/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-display ui-text-secondary">
                    First-Time Setup
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border ui-border text-display">
                    Hermes Style
                  </span>
                </div>
                <p className="text-xs ui-text-secondary mb-3">
                  New here? Follow the interactive setup walkthrough to check local compute, configure models, and launch.
                </p>
                <Button className="w-full" onClick={() => setShowWizard(true)}>
                  Start Setup Walkthrough →
                </Button>
              </div>
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t ui-border"></div>
                </div>
                <span className="relative ui-surface px-2 text-xs ui-text-secondary text-display">
                  Or Existing Key
                </span>
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setToken(keyInput.trim());
                  setKeyInput('');
                }}
              >
                <label className="block text-sm mb-2" htmlFor="key">
                  Local access key
                </label>
                <input
                  id="key"
                  type="password"
                  autoComplete="off"
                  required
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  className="w-full ui-surface p-3 rounded-lg border ui-border"
                  placeholder="Paste local.token"
                />
                <button className="mt-4 ui-primary text-white rounded-lg py-3 px-5 w-full">
                  Open workspace
                </button>
              </form>
            </section>
          )
        ) : (
          <ChatView
            messages={messages}
            prompt={prompt}
            setPrompt={setPrompt}
            onSend={send}
            onStop={() => {
              if (busy || chatRun.active) {
                chatRun.stop();
                setChatStatus('Generation stopped.');
              }
            }}
            onRetry={index => {
              const userMsg = messages[index];
              if (userMsg && userMsg.role === 'user') {
                setPrompt(userMsg.content);
              }
            }}
            onDeleteMessage={index => {
              setMessages(prev => prev.filter((_, i) => i !== index));
            }}
            busy={busy}
            sendOnEnter={preferences.sendOnEnter}
            messageLayout={preferences.messageLayout}
            conversationId={conversation}
            api={api}
            token={token}
            modelId={model}
            contextLimit={modelObjects.find(m => m.id === model)?.context_length}
            onCitationClick={() => setKnowledgeOpen(true)}
            onAttachmentUploaded={() => refresh()}
          />
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 text-red-800 p-4 my-3">
            {error}
          </p>
        )}
      </AppShell>

      {/* Global Overlays */}
      <Dialog open={knowledgeOpen} title="Knowledge" onClose={() => setKnowledgeOpen(false)}>
        {knowledgeOpen && <KnowledgePanel api={api} />}
      </Dialog>
      <Dialog open={licensesOpen} title="Licenses" onClose={() => setLicensesOpen(false)}>
        <pre className="ui-licenses">{thirdPartyNotices}</pre>
      </Dialog>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        onResetPreferences={() => updatePreferences(DEFAULT_PREFERENCES)}
        api={api}
        token={token}
        conversationId={conversation}
        messages={messages}
        models={modelObjects}
        activeProfileId={activeProfileId}
        onSelectProfile={id => setActiveProfileId(id)}
        onPurgeComplete={() => {
          setConversation(crypto.randomUUID());
          setMessages([]);
          refresh();
        }}
        thirdPartyNoticesText={thirdPartyNotices}
      />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={commandActions}
      />
      <UndoToastContainer
        toasts={toasts}
        onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))}
      />
    </div>
  );
}

// In-repo gallery detection
const isGalleryRoute = typeof window !== 'undefined' && window.location.search.includes('gallery=1');

if (isGalleryRoute) {
  createRoot(document.getElementById('root')!).render(<DesignGallery />);
} else {
  createRoot(document.getElementById('root')!).render(<App />);
}
