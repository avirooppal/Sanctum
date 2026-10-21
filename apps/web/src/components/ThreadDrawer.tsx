import React from 'react';
import { type Model } from '../api.js';

export interface ThreadParameters {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  stream: boolean;
}

export interface ThreadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: string;
  models: Model[];
  onSelectModel: (id: string) => void;
  params: ThreadParameters;
  onUpdateParams: (newParams: Partial<ThreadParameters>) => void;
  onDeleteThread?: () => void;
  onExportThread?: () => void;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  isOpen,
  onClose,
  activeModel,
  models,
  onSelectModel,
  params,
  onUpdateParams,
  onDeleteThread,
  onExportThread,
}) => {
  if (!isOpen) return null;

  return (
    <aside
      style={{
        width: '300px',
        background: '#121824',
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '16px',
        gap: '20px',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Thread Settings</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
          }}
          aria-label="Close parameters drawer"
        >
          ✕
        </button>
      </div>

      {/* Model Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#94a3b8' }}>Model</label>
        <select
          value={activeModel}
          onChange={(e) => onSelectModel(e.target.value)}
          style={{
            background: '#0b0f17',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            padding: '8px 10px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        >
          {models.length > 0 ? (
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))
          ) : (
            <option value={activeModel}>{activeModel || 'No models detected'}</option>
          )}
        </select>
      </div>

      {/* System Prompt */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#94a3b8' }}>System Prompt</label>
        <textarea
          value={params.systemPrompt}
          onChange={(e) => onUpdateParams({ systemPrompt: e.target.value })}
          placeholder="You are a helpful, thoughtful, local AI assistant..."
          rows={4}
          style={{
            background: '#0b0f17',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            padding: '8px 10px',
            color: '#f8fafc',
            fontSize: '12px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Temperature */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Temperature</span>
          <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{params.temperature.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={params.temperature}
          onChange={(e) => onUpdateParams({ temperature: parseFloat(e.target.value) })}
          style={{ accentColor: '#38bdf8' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
          <span>0.0 (Precise)</span>
          <span>1.0 (Balanced)</span>
          <span>2.0 (Creative)</span>
        </div>
      </div>

      {/* Top P */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Top P</span>
          <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{params.topP.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={params.topP}
          onChange={(e) => onUpdateParams({ topP: parseFloat(e.target.value) })}
          style={{ accentColor: '#38bdf8' }}
        />
      </div>

      {/* Max Tokens */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Max Tokens</span>
          <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{params.maxTokens}</span>
        </div>
        <input
          type="range"
          min="128"
          max="4096"
          step="128"
          value={params.maxTokens}
          onChange={(e) => onUpdateParams({ maxTokens: parseInt(e.target.value, 10) })}
          style={{ accentColor: '#38bdf8' }}
        />
      </div>

      {/* Stream Response Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Stream Response</span>
        <input
          type="checkbox"
          checked={params.stream}
          onChange={(e) => onUpdateParams({ stream: e.target.checked })}
          style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
        />
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {onExportThread && (
          <button
            onClick={onExportThread}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#1a2332',
              border: '1px solid #1e293b',
              color: '#f8fafc',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Export Chat (JSON/Markdown)
          </button>
        )}
        {onDeleteThread && (
          <button
            onClick={onDeleteThread}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#f43f5e',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Delete Thread
          </button>
        )}
      </div>
    </aside>
  );
};
