import React, { useState } from 'react';
import type { SettingEntry } from '../api.js';

export interface SettingsPanelProps {
  settings: Record<string, SettingEntry>;
  platformAssurance?: string;
  onUpdateSetting?: (key: string, value: unknown) => void;
  onExportSettings?: () => void;
  onImportSettings?: (jsonString: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  platformAssurance = 'not verified',
  onUpdateSetting,
  onExportSettings,
  onImportSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'models' | 'privacy'>('general');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const themeVal = (settings['ui.theme']?.value as string) || 'dark';
  const scaleVal = (settings['ui.scale_factor']?.value as number) || 1.0;
  const motionVal = (settings['ui.reduced_motion']?.value as boolean) || false;
  const defaultModel = (settings['models.default']?.value as string) || 'qwen2.5-coder-7b';
  const egressEnabled = (settings['network.egress_enabled']?.value as boolean) || false;

  const handleImportSubmit = () => {
    if (importText.trim() && onImportSettings) {
      onImportSettings(importText.trim());
      setShowImport(false);
      setImportText('');
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        padding: '24px',
        overflowY: 'auto',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Settings & Configuration</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          Typed application settings. Changes persist locally to disk.
        </p>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', marginBottom: '24px' }}>
          {(['general', 'models', 'privacy'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? '#38bdf8' : 'transparent'}`,
                color: activeTab === tab ? '#f8fafc' : '#94a3b8',
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: '14px',
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>Interface Theme</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['dark', 'light', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateSetting?.('ui.theme', mode)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: themeVal === mode ? '#38bdf8' : '#1e293b',
                      color: themeVal === mode ? '#0b0f17' : '#f8fafc',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>UI Scaling Multiplier</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{scaleVal.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.85}
                max={1.5}
                step={0.05}
                value={scaleVal}
                onChange={(e) => onUpdateSetting?.('ui.scale_factor', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Reduced Motion</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Disable animated transitions and smooth scrolling</div>
              </div>
              <input
                type="checkbox"
                checked={motionVal}
                onChange={(e) => onUpdateSetting?.('ui.reduced_motion', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Default Model Identifier</div>
              <input
                type="text"
                value={defaultModel}
                onChange={(e) => onUpdateSetting?.('models.default', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0b0f17',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Platform Assurance Tier</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                Kernel namespace and process isolation verified by live supervisor probes.
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  backgroundColor: platformAssurance.includes('verified kernel') ? '#064e3b' : '#334155',
                  color: platformAssurance.includes('verified kernel') ? '#6ee7b7' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {platformAssurance}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Global Egress Kill Switch</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>When disabled, network requests outside localhost are hard-denied</div>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: egressEnabled ? '#7f1d1d' : '#064e3b',
                  color: egressEnabled ? '#fca5a5' : '#6ee7b7',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {egressEnabled ? 'EGRESS ALLOWED' : 'OFFLINE ONLY'}
              </span>
            </div>
          </div>
        )}

        {/* Backup / Export / Import */}
        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #1e293b', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onExportSettings}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export Configuration
          </button>
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Import Configuration
          </button>
        </div>

        {showImport && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Paste Configuration JSON</h4>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"ui.theme": "dark", ...}'
              style={{
                width: '100%',
                backgroundColor: '#0b0f17',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                boxSizing: 'border-box',
                marginBottom: '8px',
              }}
            />
            <button
              type="button"
              onClick={handleImportSubmit}
              style={{
                padding: '6px 14px',
                backgroundColor: '#38bdf8',
                color: '#0b0f17',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Apply Imported Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
