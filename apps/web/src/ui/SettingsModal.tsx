import React, { useState } from 'react';
import { STRINGS } from './strings.js';
import { THEMES } from './themes.js';
import { Button, Dialog } from './primitives.js';
import {
  type UserPreferences,
  type Mode,
  type Density,
  type FontFamily,
  DEFAULT_PREFERENCES,
  DEFAULT_SHORTCUTS,
  validateThemeTokens,
  enforceContrastGuard,
} from './Customization.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
}

const ACCENT_PRESETS = ['#48a87b', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  onResetPreferences,
}: Props) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'layouts' | 'shortcuts' | 'importExport'>('appearance');
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [themeJsonError, setThemeJsonError] = useState('');
  const [shortcutConflict, setShortcutConflict] = useState('');

  if (!isOpen) return null;

  const currentBg = preferences.mode === 'light' ? '#ffffff' : '#0f1412';
  const contrastCheck = enforceContrastGuard(preferences.accentColor, currentBg);

  const handleAccentChange = (hex: string) => {
    const checked = enforceContrastGuard(hex, currentBg);
    onUpdatePreferences({ accentColor: checked.effectiveHex });
  };

  const handleShortcutChange = (actionKey: string, newKey: string) => {
    // Conflict check
    const existing = Object.entries(preferences.shortcuts).find(([k, v]) => v.toLowerCase() === newKey.toLowerCase() && k !== actionKey);
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
      // Apply theme custom tokens
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

  return (
    <Dialog open={isOpen} title={STRINGS.settings.title} onClose={onClose}>
      <div style={{ display: 'flex', gap: '20px', minHeight: '440px' }}>
        {/* Left Navigation */}
        <div style={{ width: '180px', borderRight: '1px solid var(--ui-border, #283832)', paddingRight: '12px' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Button
              variant={activeTab === 'appearance' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('appearance')}
            >
              {STRINGS.settings.appearance}
            </Button>
            <Button
              variant={activeTab === 'layouts' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('layouts')}
            >
              {STRINGS.settings.layouts}
            </Button>
            <Button
              variant={activeTab === 'shortcuts' ? 'primary' : 'quiet'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('shortcuts')}
            >
              {STRINGS.settings.shortcuts}
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
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
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
                    fontSize: '11px',
                    color: contrastCheck.compliant ? 'var(--ui-success, #34d399)' : 'var(--ui-warning, #fbbf24)',
                    fontWeight: 600,
                  }}
                >
                  {contrastCheck.compliant
                    ? `✓ Contrast ratio ${contrastCheck.ratio.toFixed(2)}:1 (${STRINGS.settings.contrastPass})`
                    : `⚠ Contrast ratio adjusted to ${contrastCheck.ratio.toFixed(2)}:1 (${STRINGS.settings.contrastFail})`}
                </div>
              </div>

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
                      {d === 'compact' ? STRINGS.settings.densityCompact : d === 'comfortable' ? STRINGS.settings.densityComfortable : STRINGS.settings.densitySpacious}
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
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>
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
                          fontSize: '11px',
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
                        style={{ fontSize: '11px', padding: '2px 6px' }}
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
                    fontSize: '11px',
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
