import React, { useState } from 'react';
import { Button, Dialog } from './primitives.js';
import { THEMES, themeTokens } from './themes.js';
import { SafeMarkdown } from './SafeMarkdown.js';
import { STRINGS } from './strings.js';
import { enforceContrastGuard } from './Customization.js';

export function DesignGallery() {
  const [selectedTheme, setSelectedTheme] = useState('sanctum');
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [dialogOpen, setDialogOpen] = useState(false);

  const tokens = themeTokens(selectedTheme, mode);

  return (
    <div
      className="design-gallery-container"
      data-density={density}
      style={{
        ...tokens,
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'var(--ui-background)',
        color: 'var(--ui-text-primary)',
        minHeight: '100vh',
        fontFamily: 'Archivo, sans-serif',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid var(--ui-border)',
          paddingBottom: '16px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Sanctum Design Gallery</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ui-text-secondary)' }}>
            Component &amp; Primitive Catalog across states, densities, and verified themes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedTheme}
            onChange={e => setSelectedTheme(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--ui-border)',
              background: 'var(--ui-surface)',
              color: 'var(--ui-text-primary)',
            }}
            aria-label="Theme selector"
          >
            {THEMES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
          >
            {mode === 'dark' ? '☀ Light' : '🌙 Dark'}
          </Button>

          <select
            value={density}
            onChange={e => setDensity(e.target.value as any)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--ui-border)',
              background: 'var(--ui-surface)',
              color: 'var(--ui-text-primary)',
            }}
            aria-label="Density selector"
          >
            <option value="compact">Compact (85%)</option>
            <option value="comfortable">Comfortable (100%)</option>
            <option value="spacious">Spacious (115%)</option>
          </select>
        </div>
      </header>

      {/* Layer 2: Primitives */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--ui-border)', paddingBottom: '6px' }}>
          Layer 2: Primitives &amp; States
        </h2>

        {/* Buttons */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', marginBottom: '8px' }}>Button Variants &amp; States</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <Button variant="primary">Primary Accent</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="quiet">Quiet Ghost</Button>
            <Button style={{ background: 'var(--ui-danger, #f87171)', color: '#0f1412' }}>Danger Action</Button>
            <Button disabled>Disabled State</Button>
            <Button onClick={() => setDialogOpen(true)}>Open Modal Dialog</Button>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', marginBottom: '8px' }}>Input Controls &amp; States</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Default text input"
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                minWidth: '220px',
              }}
            />
            <input
              type="text"
              disabled
              value="Disabled input"
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-disabled)',
                opacity: 0.6,
                minWidth: '220px',
              }}
            />
          </div>
        </div>

        {/* Cards & Elevated Surfaces */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="ui-card" style={{ background: 'var(--ui-surface)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Base Surface Card</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ui-text-secondary)' }}>
              Standard content card for lists, sessions, and chat messages.
            </p>
          </div>
          <div className="ui-card" style={{ background: 'var(--ui-surface-raised, #1c2622)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Raised Elevated Card</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ui-text-secondary)' }}>
              Higher elevation for tooltips, modals, inspector drawers, and toasts.
            </p>
          </div>
        </div>
      </section>

      {/* Layer 3: Composites */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--ui-border)', paddingBottom: '6px' }}>
          Layer 3: Composites &amp; Chat Elements
        </h2>

        {/* Message Turns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {/* User Turn */}
          <div style={{ alignSelf: 'flex-end', maxWidth: '75%' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px 12px 2px 12px',
                background: 'var(--ui-user-bubble, var(--ui-accent))',
                color: 'var(--ui-text-on-accent)',
                fontSize: '14px',
              }}
            >
              How does Sanctum preserve privacy during document indexing?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ui-text-secondary)', textAlign: 'right', marginTop: '4px' }}>
              You • Just now
            </div>
          </div>

          {/* Assistant Turn */}
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div
              className="ui-card"
              style={{
                borderRadius: '12px 12px 12px 2px',
                background: 'var(--ui-surface)',
                border: '1px solid var(--ui-border)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui-accent)' }}>
                  Sanctum Assistant (Qwen 2.5 7B)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ui-text-secondary)' }}>
                  26.4 tok/s • Egress 0 PASS
                </span>
              </div>

              <SafeMarkdown
                content={`Sanctum enforces strict zero-egress containment:\n\n- Documents are parsed offline via local parsers.\n- Vectors are embedded using \`sqlite-vec\` on **127.0.0.1**.\n- No data leaves your machine.\n\n\`\`\`python\ndef on_device_rag():\n    return "100% Local"\n\`\`\``}
              />

              {/* Inline Citation Chip */}
              <div style={{ marginTop: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'var(--ui-surface-raised, #1c2622)',
                    border: '1px solid var(--ui-accent)',
                    fontSize: '12px',
                    color: 'var(--ui-accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  📄 [Doc 1: privacy_model.pdf #Chunk 2]
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Status Items */}
        <div>
          <h3 style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', marginBottom: '8px' }}>System Status Items</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'var(--ui-surface-raised, #1c2622)',
                border: '1px solid var(--ui-success, #34d399)',
                color: 'var(--ui-success, #34d399)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ● On-device only • 0 Egress
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'var(--ui-surface-raised, #1c2622)',
                border: '1px solid var(--ui-border)',
                color: 'var(--ui-text-secondary)',
                fontSize: '12px',
              }}
            >
              RAM: 4.8 GB / 16 GB (Profile Balanced)
            </span>
          </div>
        </div>
      </section>

      {/* Modal Dialog Demo */}
      <Dialog open={dialogOpen} title="Sample Modal Dialog" onClose={() => setDialogOpen(false)}>
        <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
          This dialog traps focus, supports Escape dismissal, and restores origin focus.
        </p>
        <Button variant="primary" onClick={() => setDialogOpen(false)}>
          Close Dialog
        </Button>
      </Dialog>
    </div>
  );
}
