import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { SpeechPanel } from './SpeechPanel';
import { MeetingPanel } from './MeetingPanel';

import { SanctumClient, type Message, type Model } from './api';
import { ChatRun } from './chat-run';
import { loadWorkspace } from './workspace-bootstrap';
import {userError} from './runtime-truth';
import { ChatView } from './ui/ChatView';
import { RightRail } from './ui/RightRail';
import { StatusBar } from './ui/StatusBar';
import { KnowledgePanel } from './KnowledgePanel';
import { HistoryPanel } from './HistoryPanel';
import './ui/knowledge.css';
import { Button, Dialog } from './ui/primitives';
import './ui/primitives.css';
import {UnlockScreen} from './ui/UnlockScreen';
import './ui/unlock.css';
import './ui/themes.css';
import './ui/fonts.css';
import { AppShell } from './ui/AppShell';
import './ui/shell.css';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { DashboardPage, type DashboardSubpage } from './ui/DashboardPage';
import { SetupWizard } from './SetupWizard';

import { ThemeControls } from './ui/ThemeControls';
import { registerPanel, getRegisteredPanels, filterPanelsByCapabilities } from './ui/PanelRegistry';
import {
  type UserPreferences,
  DEFAULT_PREFERENCES,
  sanitizePreferences,
} from './ui/Customization';
import { themeTokens,accentTokens } from './ui/themes';
import { CommandPalette, type CommandAction } from './ui/CommandPalette';
import { SettingsModal } from './ui/SettingsModal';
import { UndoToastContainer, type ToastItem } from './ui/UndoToast';
import { STRINGS } from './ui/strings';

const PROMPT_SUGGESTIONS = [
  { title: 'Explain a technical concept', prompt: 'Explain how local on-device LLMs run without cloud dependencies.' },
  { title: 'Analyze code & find bugs', prompt: 'Review this code for edge cases and security vulnerabilities:\n\n```python\ndef handler(req):\n    pass\n```' },
  { title: 'Summarize notes & documents', prompt: 'Summarize the core takeaways from my notes in bullet points.' },
  { title: 'Draft an architectural proposal', prompt: 'Draft a concise architecture decision record for local-first storage.' },
];

function App() {
  const [token, setToken] = useState('');
  const [authorized,setAuthorized]=useState(false);
  const [thirdPartyNotices,setNotices]=useState(STRINGS.notices.loading as string);
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
  const [preferences, setPreferences] = useState<UserPreferences>({...DEFAULT_PREFERENCES,mode:'system'});
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const api = useMemo(() => new SanctumClient(token), [token]);

  async function refresh() {
    setHistoryRevision(n => n + 1);
  }

  // Load capabilities & server preferences on authentication
  useEffect(() => {
    if (!token) return;
    const controller=new AbortController();
    setAuthorized(false);setCapabilities([]);setModels([]);setModelObjects([]);
    async function bootstrap() {
      try {
        await document.fonts.load('12px "JetBrains Mono"');
        await document.fonts.ready;
        const loaded=await loadWorkspace(api,controller.signal);
        if(loaded.preferences) {
          const restored=sanitizePreferences(loaded.preferences);
          setPreferences(restored.preferences);
          if(restored.wasRecovered)setToasts(previous=>[...previous,{id:crypto.randomUUID(),message:STRINGS.toast.preferencesRecovered,durationMs:5000}]);
        }
        const data=loaded.models;
        setModelObjects(data);
        const textModels = data.filter(m => m.capabilities.includes('text')).map(m => m.id);
        setModels(textModels);
        setModel(textModels[0] || '');
        setCapabilities(loaded.capabilities.capabilities);
        await refresh();
        setAuthorized(true);
      } catch(e) {
        if(controller.signal.aborted)return;
        setError(userError(e));
        setToken('');
      }
    }
    void bootstrap();
    return ()=>controller.abort();
  }, [token]);

  // Apply theme tokens to root element
  useEffect(() => {
    const system=window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme() {
    const effectiveMode = preferences.mode === 'system'
      ? (system.matches ? 'dark' : 'light')
      : preferences.mode;
    try {
      const base = themeTokens(preferences.theme, effectiveMode);
      const tokens = preferences.accentColor ? accentTokens(base,preferences.accentColor) : base;
      const root = document.documentElement;
      root.dataset.theme=preferences.theme;root.dataset.mode=effectiveMode;
      for (const [key, val] of Object.entries(tokens)) {
        root.style.setProperty(key, val);
      }

    } catch {
      // Fallback safely to sanctum theme
    }
    }
    applyTheme();system.addEventListener('change',applyTheme);
    return ()=>system.removeEventListener('change',applyTheme);
  }, [preferences.theme, preferences.mode, preferences.accentColor]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if(!token||!authorized)return;
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
        document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')?.focus();
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
  }, [token,authorized]);

  const updatePreferences = (updated: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updated };
      if (token) {
        api.savePreferences(next as any).catch(failure=>setError(userError(failure)));
      }
      return next;
    });
  };

  const handleSessionDeleted = (id: string) => {
    const toastId = crypto.randomUUID();
    setToasts(prev => [
      ...prev,
      {
        id: toastId,
        message: STRINGS.toast.sessionDeleted,
        durationMs: 5000,
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
          content: `**Sanctum Active Runtime Info**\n- **Model**: \`${model || 'none'}\` (Local on-device inference)\n- **Privacy**: ${STRINGS.app.privacyVerified}\n- **Storage**: Local session turns; inspect startup checks separately`,
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
      setError(userError(e));
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
      setError(userError(e));
    } finally {
      setBusy(false);
    }
  }

  const commandActions: CommandAction[] = [
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
      onSelect: () => updatePreferences({ theme: 'solarized',mode:'dark' }),
    },
    {
      id: 'theme_solarized_light',
      category: 'Theme',
      title: 'Switch Theme: Solarized Light',
      onSelect: () => updatePreferences({ theme: 'solarized',mode:'light' }),
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
      onSelect: () => updatePreferences({ theme: 'catppuccin' }),
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
  ].filter(action=>{
    if(action.id.startsWith('layout_'))return false;
    if(['theme_nord','theme_gruvbox','theme_tokyo_night','settings_profiles','settings_models'].includes(action.id))return false;
    if(action.id.startsWith('dashboard')&&!capabilities.includes('dashboard'))return false;
    if(action.id==='knowledge'&&!capabilities.includes('knowledge'))return false;
    return true;
  });

  useEffect(()=>{
    if(!authorized||!(licensesOpen||settingsOpen||(route==='dashboard'&&dashboardSubpage==='licenses')))return;
    let active=true;
    import('../../../THIRD_PARTY_NOTICES.md?raw').then(module=>{if(active)setNotices(module.default);})
      .catch(()=>{if(active)setNotices(STRINGS.notices.error);});
    return ()=>{active=false;};
  },[authorized,licensesOpen,settingsOpen,route,dashboardSubpage]);

  if(!token||!authorized)return <UnlockScreen value={keyInput} busy={!!token&&!authorized}
    error={error} onChange={setKeyInput}
    onUnlock={()=>{setError('');setToken(keyInput.trim());setKeyInput('');}}
    onReview={()=>{setError('');setShowWizard(true);}}
    onBack={()=>{setError('');setShowWizard(false);}}
    wizard={showWizard?<SetupWizard defaultToken={keyInput} onComplete={(key,initialPrompt)=>{
      setToken(key);setShowWizard(false);if(initialPrompt)setPrompt(initialPrompt);
    }}/>:undefined}/>;

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
          capabilities={capabilities}
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
            {token && capabilities.includes('history') && (
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
              <span>Review live startup checks in the status bar.</span><br />
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
              <ThemeControls value={{theme:preferences.theme,mode:preferences.mode}} onChange={updatePreferences}/>
            </div>
          </>
        }

        header={
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm ui-text-secondary">Chat</span>
              {token && capabilities.includes('chat') && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
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
                  className="text-xs px-2 py-0.5 rounded border ui-border text-display ui-text-secondary"
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
          token && capabilities.includes('chat') ? (
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
          token && capabilities.includes('chat') ? (
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
        {token && capabilities.includes('knowledge') && <MeetingPanel token={token} />}

        {capabilities.includes('chat') ? (
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
        ) : <p role="status">Checking local runtime…</p>}

        {token && capabilities.includes('speech') && <SpeechPanel token={token}
          answer={messages.filter(message => message.role === 'assistant').at(-1)?.content ?? ''}
          conversation={conversation} onTranscript={text => setPrompt(text)} />}
        {chatStatus && <p role="status">{chatStatus}</p>}
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
        capabilities={capabilities}
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

// Developer component samples remain separate from the owner application.
createRoot(document.getElementById('root')!).render(<App />);
