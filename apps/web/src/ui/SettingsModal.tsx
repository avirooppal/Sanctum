import {userError} from '../runtime-truth.js';
import React, { useState, useEffect } from 'react';
import { STRINGS } from './strings.js';
import { THEMES } from './themes.js';
import { Button, Dialog } from './primitives.js';
import {
  type UserPreferences,
  type Mode,
  type Density,
  type FontFamily,
  type MessageLayout,
  type ContentWidth,
  type AnimationLevel,
  DEFAULT_PREFERENCES,
  DEFAULT_SHORTCUTS,
  validateThemeTokens,
  enforceContrastGuard,
} from './Customization.js';
import { type AssistantProfile, type SanctumClient,type Model } from '../api.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
  api?: SanctumClient;
  token?: string;
  conversationId?: string | null;
  messages?: Array<{ role: string; content: string }>;
  models?: Model[];
  capabilities?:string[];
  activeProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
  onPurgeComplete?: () => void;
  thirdPartyNoticesText?: string;
}

const ACCENT_PRESETS = ['#48a87b', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

type TabKey = 'appearance' | 'layouts' | 'shortcuts' | 'profiles' | 'models' | 'data' | 'licenses' | 'importExport';

export function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  api,
  token,
  conversationId,
  messages = [],
  models = [],
  capabilities=[],
  activeProfileId,
  onSelectProfile,
  onPurgeComplete,
  thirdPartyNoticesText,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [themeJsonError, setThemeJsonError] = useState('');
  const [shortcutConflict, setShortcutConflict] = useState('');

  // Profiles State
  const [profilesList, setProfilesList] = useState<AssistantProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    name: string;
    system_prompt: string;
    scope: 'global' | 'profile';
  } | null>(null);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileBusy,setProfileBusy]=useState(false);
  const [profileLoadState,setProfileLoadState]=useState<'idle'|'loading'|'ready'|'failed'>('idle');

  // Data / Purge State
  const [purgeInput, setPurgeInput] = useState('');
  const [purgeInProgress, setPurgeInProgress] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');

  // Read-only definitions load explicitly with cancellation and honest empty state.
  useEffect(() => {
    if(!isOpen||!api||!token||activeTab!=='profiles')return;
    const controller=new AbortController();
    setProfileLoadState('loading');setProfileMsg('');setProfilesList([]);
    api.profiles(controller.signal).then(result=>{
      if(!controller.signal.aborted){setProfilesList(result);setProfileLoadState('ready');}
    }).catch(failure=>{
      if(!controller.signal.aborted){setProfileLoadState('failed');setProfileMsg(userError(failure));}
    });
    return ()=>controller.abort();
  },[isOpen,activeTab,api,token]);

  if (!isOpen) return null;

  const currentBg = preferences.mode === 'light' ? '#ffffff' : '#0f1412';
  const contrastCheck = enforceContrastGuard(preferences.accentColor, currentBg);

  const handleAccentChange = (hex: string) => {
    const checked = enforceContrastGuard(hex, currentBg);
    onUpdatePreferences({ accentColor: checked.effectiveHex });
  };

  const handleShortcutChange = (actionKey: string, newKey: string) => {
    const existing = Object.entries(preferences.shortcuts).find(
      ([k, v]) => v.toLowerCase() === newKey.toLowerCase() && k !== actionKey
    );
    if (existing) {
      setShortcutConflict(`Shortcut '${newKey}' is already assigned to '${existing[0]}'`);
      return;
    }
    setShortcutConflict('');
    onUpdatePreferences({
      shortcuts: { ...preferences.shortcuts, [actionKey]: newKey },
    });
  };

  const handleImportTheme = () => {
    try {
      const parsed = JSON.parse(themeJsonInput);
      const res = validateThemeTokens(parsed);
      if (!res.valid) {
        setThemeJsonError(res.error || 'Invalid theme');
        return;
      }
      setThemeJsonError('');
      onUpdatePreferences({ theme: res.theme!.id });
    } catch {
      setThemeJsonError('Invalid JSON format');
    }
  };

  const handleExportPreferences = () => {
    const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanctum-preferences-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportConversationMarkdown = () => {
    if (!messages || messages.length === 0) {
      alert('No messages in active conversation to export.');
      return;
    }
    const lines = [
      `# Sanctum Conversation Export`,
      `- **Session ID**: \`${conversationId || 'unnamed'}\``,
      `- **Export Date**: ${new Date().toISOString()}`,
      `- **Turns**: ${messages.length}`,
      '',
    ];
    for (const msg of messages) {
      lines.push(`## ${msg.role.toUpperCase()}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId || 'export'}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile || !api || profileBusy) return;
    if (!editingProfile.name.trim()) {
      setProfileMsg('Profile name is required');
      return;
    }
    setProfileBusy(true);
    try {
      const profId = editingProfile.id || crypto.randomUUID();
      await api.saveProfile({
        id: profId,
        name: editingProfile.name.trim(),
        system_prompt: editingProfile.system_prompt,
        scope: editingProfile.scope,
      });
      const updated = await api.profiles();
      setProfilesList(updated);setProfileLoadState('ready');
      setEditingProfile(null);
      setProfileMsg('Profile saved successfully.');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg(userError(err));
    } finally {setProfileBusy(false);}
  };

  const handleDeleteProfile = async (id: string) => {
    if (!api || profileBusy) return;
    setProfileBusy(true);
    try {
      await api.deleteProfile(id);
      const updated = await api.profiles();
      setProfilesList(updated);setProfileLoadState('ready');
      if (activeProfileId === id && onSelectProfile) {
        onSelectProfile(null);
      }
      setProfileMsg('Profile deleted.');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg(userError(err));
    } finally {setProfileBusy(false);}
  };

  const handleFullPurge = async () => {
    if (purgeInput.trim() !== STRINGS.settings.purgeConfirmRequired) return;
    if (!api) return;
    setPurgeInProgress(true);
    setPurgeMsg(STRINGS.settings.purging);
    try {
      await api.fullPurge(STRINGS.settings.purgeConfirmRequired);
      setPurgeMsg(STRINGS.settings.purgeSuccess);
      setPurgeInput('');
      if (onPurgeComplete) onPurgeComplete();
      setTimeout(() => {
        setPurgeInProgress(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setPurgeInProgress(false);
      setPurgeMsg(`Purge failed: ${err.message || 'Server error'}`);
    }
  };

  return (
    <Dialog open={isOpen} title={STRINGS.settings.title} onClose={onClose}>
      <div style={{ display: 'flex', gap: '20px', minHeight: '460px', maxHeight: '70vh' }}>
        {/* Left Navigation */}
        <div style={{ width: '190px', borderRight: '1px solid var(--ui-border, #283832)', paddingRight: '12px' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Button
              variant={activeTab === 'appearance' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('appearance')}
            >
              {STRINGS.settings.appearance}
            </Button>
            {capabilities.includes('layouts')&&<Button
              variant={activeTab === 'layouts' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('layouts')}
            >
              {STRINGS.settings.layouts}
            </Button>}
            {capabilities.includes('shortcut_customization')&&<Button
              variant={activeTab === 'shortcuts' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('shortcuts')}
            >
              {STRINGS.settings.shortcuts}
            </Button>}
            <Button
              variant={activeTab === 'profiles' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('profiles')}
            >
              {STRINGS.settings.profiles}
            </Button>
            <Button
              variant={activeTab === 'models' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('models')}
            >
              {STRINGS.settings.models}
            </Button>
            <Button
              variant={activeTab === 'data' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('data')}
            >
              {STRINGS.settings.data}
            </Button>
            <Button
              variant={activeTab === 'licenses' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('licenses')}
            >
              {STRINGS.settings.licenses}
            </Button>
            <Button
              variant={activeTab === 'importExport' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('importExport')}
            >
              Import / Export
            </Button>
          </nav>
        </div>

        {/* Right Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Mode & Theme */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Mode &amp; Color Theme
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {(['dark', 'light', 'system'] as Mode[]).map(m => (
                    <Button
                      key={m}
                      variant={preferences.mode === m ? 'primary' : 'outline'}
                      onClick={() => onUpdatePreferences({ mode: m })}
                    >
                      {m.toUpperCase()}
                    </Button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {THEMES.map(t => (
                    <Button
                      key={t.id}
                      variant={preferences.theme === t.id ? 'primary' : 'outline'}
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                      onClick={() => onUpdatePreferences({ theme: t.id })}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Accent Color with WCAG AA Guard */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Accent Color &amp; WCAG AA Contrast Guard
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {ACCENT_PRESETS.map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handleAccentChange(hex)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: hex,
                        border: preferences.accentColor === hex ? '2px solid #ffffff' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                      aria-label={`Select accent ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={preferences.accentColor}
                    onChange={e => handleAccentChange(e.target.value)}
                    style={{ width: '32px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
                    aria-label="Custom accent color"
                  />
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: contrastCheck.compliant ? 'var(--ui-success, #34d399)' : 'var(--ui-warning, #fbbf24)',
                    fontWeight: 600,
                  }}
                >
                  {contrastCheck.compliant
                    ? `✓ Contrast ratio ${contrastCheck.ratio.toFixed(2)}:1 (${STRINGS.settings.contrastPass})`
                    : `⚠ Contrast ratio adjusted to ${contrastCheck.ratio.toFixed(2)}:1 (${STRINGS.settings.contrastFail})`}
                </div>
              </div>

              {capabilities.includes('advanced_appearance')&&<>
              {/* Density */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.density}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['compact', 'comfortable', 'spacious'] as Density[]).map(d => (
                    <Button
                      key={d}
                      variant={preferences.density === d ? 'primary' : 'outline'}
                      onClick={() => onUpdatePreferences({ density: d })}
                    >
                      {d === 'compact'
                        ? STRINGS.settings.densityCompact
                        : d === 'comfortable'
                        ? STRINGS.settings.densityComfortable
                        : STRINGS.settings.densitySpacious}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Font Choice & Scale */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.typography} &amp; Scale ({preferences.fontSizeScale}%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {(['archivo', 'spectral', 'system'] as FontFamily[]).map(f => (
                    <Button
                      key={f}
                      variant={preferences.fontFamily === f ? 'primary' : 'outline'}
                      onClick={() => onUpdatePreferences({ fontFamily: f })}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
                <input
                  type="range"
                  min="90"
                  max="125"
                  step="5"
                  value={preferences.fontSizeScale}
                  onChange={e => onUpdatePreferences({ fontSizeScale: Number(e.target.value) })}
                  style={{ width: '220px' }}
                  aria-label="Font size scale"
                />
              </div>

              </>}

              {/* Message Layout (Bubbles vs Document Measure) */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.messageLayout}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant={preferences.messageLayout === 'bubbles' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ messageLayout: 'bubbles' })}
                  >
                    {STRINGS.settings.bubblesLayout}
                  </Button>
                  <Button
                    variant={preferences.messageLayout === 'document' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ messageLayout: 'document' })}
                  >
                    {STRINGS.settings.documentLayout}
                  </Button>
                </div>
              </div>

              {capabilities.includes('advanced_appearance')&&<>
              {/* Content Measure / Width */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.contentWidth}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['narrow', 'normal', 'wide'] as ContentWidth[]).map(w => (
                    <Button
                      key={w}
                      variant={preferences.contentWidth === w ? 'primary' : 'outline'}
                      onClick={() => onUpdatePreferences({ contentWidth: w })}
                    >
                      {w === 'narrow' ? STRINGS.settings.widthNarrow : w === 'normal' ? STRINGS.settings.widthNormal : STRINGS.settings.widthWide}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Code Theme */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.codeTheme}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['match', 'dark', 'light'] as const).map(ct => (
                    <Button
                      key={ct}
                      variant={preferences.codeTheme === ct ? 'primary' : 'outline'}
                      onClick={() => onUpdatePreferences({ codeTheme: ct })}
                    >
                      {ct.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Motion Level */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.motion}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant={preferences.animationLevel === 'full' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ animationLevel: 'full' })}
                  >
                    {STRINGS.settings.motionFull}
                  </Button>
                  <Button
                    variant={preferences.animationLevel === 'reduced' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ animationLevel: 'reduced' })}
                  >
                    {STRINGS.settings.motionReduced}
                  </Button>
                </div>
              </div>

              </>}

              {/* Enter vs Shift+Enter send behavior */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Composer Send Behavior
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant={preferences.sendOnEnter ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ sendOnEnter: true })}
                  >
                    Enter to send (Shift+Enter for newline)
                  </Button>
                  <Button
                    variant={!preferences.sendOnEnter ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ sendOnEnter: false })}
                  >
                    Shift+Enter to send (Enter for newline)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layouts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Workspace Layout Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {preferences.savedLayouts.map(layout => (
                    <Button
                      key={layout.id}
                      variant={preferences.activeLayout === layout.id ? 'primary' : 'outline'}
                      style={{ padding: '12px', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => onUpdatePreferences({ activeLayout: layout.id })}
                    >
                      <span style={{ fontWeight: 600 }}>{layout.name}</span>
                      <span style={{ fontSize: '12px', opacity: 0.7 }}>
                        Left: {layout.slots.left} • Center: {layout.slots.center} • Right: {layout.slots.right}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Sidebar Dock Position
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant={preferences.sidebarSide === 'left' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ sidebarSide: 'left' })}
                  >
                    Left Side (Default)
                  </Button>
                  <Button
                    variant={preferences.sidebarSide === 'right' ? 'primary' : 'outline'}
                    onClick={() => onUpdatePreferences({ sidebarSide: 'right' })}
                  >
                    Right Side
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Keyboard Shortcuts</div>
              {shortcutConflict && (
                <div style={{ fontSize: '12px', color: 'var(--ui-danger, #f87171)' }}>{shortcutConflict}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(preferences.shortcuts).map(([action, key]) => (
                  <div
                    key={action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      background: 'var(--ui-surface, #151c19)',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                      {action.replace(/_/g, ' ')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={key}
                        onChange={e => handleShortcutChange(action, e.target.value)}
                        style={{
                          width: '100px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          padding: '4px 6px',
                          borderRadius: '3px',
                          border: '1px solid var(--ui-border, #283832)',
                          background: 'var(--ui-background, #0f1412)',
                          color: 'var(--ui-text-primary, #e8efe9)',
                        }}
                      />
                      <Button
                        variant="quiet"
                        style={{ fontSize: '12px', padding: '2px 6px' }}
                        onClick={() => handleShortcutChange(action, DEFAULT_SHORTCUTS[action] || '')}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{STRINGS.settings.profiles}</span>
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditingProfile({
                      id: '',
                      name: '',
                      system_prompt: '',
                      scope: 'global',
                    })
                  }
                >
                  + {STRINGS.settings.newProfile}
                </Button>
              </div>

              {!onSelectProfile && <p>Saved prompt definitions are not applied to chat automatically.</p>}
              {profileBusy && <p role="status">Saving profile change…</p>}
              {profileMsg && (
                <div style={{ fontSize: '12px', color: 'var(--ui-primary, #48a87b)' }}>{profileMsg}</div>
              )}

              {/* Profiles List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profileLoadState!=='ready' ? <p>{profileLoadState==='loading'?'Loading saved definitions…':'Saved definitions are unknown. Reopen this tab to check again.'}</p> : profilesList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--ui-text-secondary, #9fb3a4)' }}>
                    {STRINGS.settings.noProfiles}
                  </p>
                ) : (
                  profilesList.map(prof => (
                    <div
                      key={prof.id}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--ui-surface, #151c19)',
                        borderRadius: '6px',
                        border:
                          activeProfileId === prof.id
                            ? '1px solid var(--ui-primary, #48a87b)'
                            : '1px solid var(--ui-border, #283832)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>
                          {prof.name}{' '}
                          <span
                            style={{
                              fontSize: '12px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'var(--ui-border, #283832)',
                              marginLeft: '6px',
                            }}
                          >
                            {prof.scope}
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {onSelectProfile && (
                            <Button
                              variant={activeProfileId === prof.id ? 'primary' : 'quiet'}
                              style={{ fontSize: '12px', padding: '2px 8px' }}
                              onClick={() => onSelectProfile(activeProfileId === prof.id ? null : prof.id)}
                            >
                              {activeProfileId === prof.id ? 'Active' : 'Apply'}
                            </Button>
                          )}
                          <Button
                            variant="quiet"
                            style={{ fontSize: '12px', padding: '2px 8px' }}
                            onClick={() =>
                              setEditingProfile({
                                id: prof.id,
                                name: prof.name,
                                system_prompt: prof.system_prompt,
                                scope: prof.scope as 'global' | 'profile',
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            variant="quiet"
                            style={{ fontSize: '12px', padding: '2px 8px', color: 'var(--ui-danger, #f87171)' }}
                            disabled={profileBusy} onClick={() => handleDeleteProfile(prof.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--ui-text-secondary, #9fb3a4)',
                          margin: 0,
                          fontFamily: 'monospace',
                          maxHeight: '40px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {prof.system_prompt || '(Empty prompt)'}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Editing Form */}
              {editingProfile && (
                <div
                  style={{
                    borderTop: '1px solid var(--ui-border, #283832)',
                    paddingTop: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Profile Name</label>
                  <input
                    type="text"
                    aria-label="Profile name" value={editingProfile.name}
                    onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    placeholder="e.g. Code Specialist"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--ui-border, #283832)',
                      background: 'var(--ui-background, #0f1412)',
                      color: 'var(--ui-text-primary, #e8efe9)',
                    }}
                  />

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Scope</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant={editingProfile.scope === 'global' ? 'primary' : 'outline'}
                      onClick={() => setEditingProfile({ ...editingProfile, scope: 'global' })}
                    >
                      {STRINGS.settings.profileScopeGlobal}
                    </Button>
                    <Button
                      variant={editingProfile.scope === 'profile' ? 'primary' : 'outline'}
                      onClick={() => setEditingProfile({ ...editingProfile, scope: 'profile' })}
                    >
                      {STRINGS.settings.profileScopeConversation}
                    </Button>
                  </div>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>System Prompt</label>
                  <textarea
                    rows={4}
                    aria-label="Profile system prompt" value={editingProfile.system_prompt}
                    onChange={e => setEditingProfile({ ...editingProfile, system_prompt: e.target.value })}
                    placeholder="Enter instructions for the model..."
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--ui-border, #283832)',
                      background: 'var(--ui-background, #0f1412)',
                      color: 'var(--ui-text-primary, #e8efe9)',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button variant="quiet" onClick={() => setEditingProfile(null)}>
                      Cancel
                    </Button>
                    <Button variant="primary" disabled={profileBusy} onClick={handleSaveProfile}>
                      {STRINGS.settings.saveProfile}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'models' && (
            <section aria-label="Configured model registry" className="space-y-4">
              <h2>Configured models</h2>
              <p>Model roles and fit estimates are unavailable until the runtime reports them.</p>
              {models.map(model=><article key={model.id} className="border ui-border rounded p-3">
                <h3>{model.id}</h3><p>Capabilities: {model.capabilities.join(', ')}</p>
                <p>License: {model.license??'Unknown'}</p>
                <p>Context: {model.context_length??'Unknown'}; fit / speed: Unknown</p>
              </article>)}
            </section>
          )}

          {activeTab === 'data' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.exportMarkdown}
                </label>
                <p style={{ fontSize: '12px', color: 'var(--ui-text-secondary, #9fb3a4)', margin: '0 0 10px' }}>
                  Export the active session transcript as a clean, standardized Markdown document with roles and timestamps.
                </p>
                <Button variant="outline" onClick={handleExportConversationMarkdown}>
                  {STRINGS.settings.exportMarkdown}
                </Button>
              </div>

              {/* Full Purge Section */}
              {capabilities.includes('full_purge')&&<div
                style={{
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--ui-danger, #f87171)',
                  background: 'rgba(239, 68, 68, 0.05)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui-danger, #f87171)', marginBottom: '6px' }}>
                  {STRINGS.settings.fullPurge}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--ui-text-secondary, #9fb3a4)', margin: '0 0 10px' }}>
                  {STRINGS.settings.purgeWarning}
                </p>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {STRINGS.settings.purgeConfirmPrompt}
                </label>
                <input
                  type="text"
                  value={purgeInput}
                  onChange={e => setPurgeInput(e.target.value)}
                  placeholder={STRINGS.settings.purgeConfirmRequired}
                  disabled={purgeInProgress}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--ui-border, #283832)',
                    background: 'var(--ui-background, #0f1412)',
                    color: 'var(--ui-text-primary, #e8efe9)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}
                />
                {purgeMsg && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: purgeMsg.includes('failed') ? 'var(--ui-danger, #f87171)' : 'var(--ui-primary, #48a87b)',
                      marginBottom: '10px',
                    }}
                  >
                    {purgeMsg}
                  </div>
                )}
                <Button
                  variant="outline"
                  style={{
                    borderColor: 'var(--ui-danger, #f87171)',
                    color: 'var(--ui-danger, #f87171)',
                    opacity: purgeInput.trim() === STRINGS.settings.purgeConfirmRequired ? 1 : 0.5,
                  }}
                  disabled={purgeInput.trim() !== STRINGS.settings.purgeConfirmRequired || purgeInProgress}
                  onClick={handleFullPurge}
                >
                  {purgeInProgress ? STRINGS.settings.purging : STRINGS.settings.purgeAction}
                </Button>
              </div>}
            </div>
          )}

          {activeTab === 'licenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{STRINGS.settings.licenses}</span>
              <p style={{ fontSize: '12px', color: 'var(--ui-text-secondary, #9fb3a4)', margin: 0 }}>
                Every bundled component, font, and dependency has been verified for permissive licensing (MIT, Apache 2.0, OFL).
              </p>
              <pre
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--ui-border, #283832)',
                  background: 'var(--ui-background, #0f1412)',
                  color: 'var(--ui-text-primary, #e8efe9)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {thirdPartyNoticesText || 'Licensed under MIT and OFL.'}
              </pre>
            </div>
          )}

          {activeTab === 'importExport' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Export UI Preferences
                </label>
                <p style={{ fontSize: '12px', color: 'var(--ui-text-secondary, #9fb3a4)', margin: '0 0 8px' }}>
                  Export all theme, density, layout, and shortcut preferences as a local JSON file.
                </p>
                <Button variant="outline" onClick={handleExportPreferences}>
                  {STRINGS.settings.exportJson}
                </Button>
              </div>

              {capabilities.includes('custom_themes')&&<>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Import Custom JSON Theme
                </label>
                <textarea
                  rows={6}
                  value={themeJsonInput}
                  onChange={e => setThemeJsonInput(e.target.value)}
                  placeholder={`{\n  "id": "my_custom_theme",\n  "name": "My Custom Theme",\n  "colors": {\n    "background": "#1a1a2e",\n    "foreground": "#e8efe9",\n    "card": "#151c19",\n    "primary": "#48a87b",\n    "border": "#283832"\n  }\n}`}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '8px',
                    border: '1px solid var(--ui-border, #283832)',
                    borderRadius: '4px',
                    background: 'var(--ui-background, #0f1412)',
                    color: 'var(--ui-text-primary, #e8efe9)',
                    marginBottom: '8px',
                  }}
                />
                {themeJsonError && (
                  <div style={{ fontSize: '12px', color: 'var(--ui-danger, #f87171)', marginBottom: '8px' }}>
                    {themeJsonError}
                  </div>
                )}
                <Button variant="primary" onClick={handleImportTheme}>
                  {STRINGS.settings.importTheme}
                </Button>
              </div>

              </>}

              <div style={{ borderTop: '1px solid var(--ui-border, #283832)', paddingTop: '12px' }}>
                <Button
                  variant="outline"
                  style={{ borderColor: 'var(--ui-danger, #f87171)', color: 'var(--ui-danger, #f87171)' }}
                  onClick={onResetPreferences}
                >
                  {STRINGS.settings.resetDefaults}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
