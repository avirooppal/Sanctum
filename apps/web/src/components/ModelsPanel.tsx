import React from 'react';
import type { Model } from '../api.js';

export interface ModelsPanelProps {
  models: Model[];
  activeModelId: string;
  onSelectModel: (id: string) => void;
  contextWindow?: number;
  onChangeContextWindow?: (val: number) => void;
  threads?: number;
  onChangeThreads?: (val: number) => void;
}

export const ModelsPanel: React.FC<ModelsPanelProps> = ({
  models,
  activeModelId,
  onSelectModel,
  contextWindow = 8192,
  onChangeContextWindow,
  threads = 6,
  onChangeThreads,
}) => {
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
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Model Management</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          Select and configure local model weights. Inference executes entirely on this host.
        </p>

        {/* Model Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {models.map((model) => {
            const isSelected = model.id === activeModelId;
            return (
              <div
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#121824',
                  border: `2px solid ${isSelected ? '#38bdf8' : '#1e293b'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>{model.id}</span>
                  {isSelected && (
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>ACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  License: <span style={{ color: '#cbd5e1' }}>{model.license || 'Permissive (Apache/MIT)'}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Max Context: <span style={{ color: '#cbd5e1' }}>{model.context_length || 8192} tokens</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {model.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        backgroundColor: '#1e293b',
                        color: '#38bdf8',
                        borderRadius: '4px',
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Parameters Configuration */}
        <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#121824', border: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>Engine Parameters</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span>Context Window Length</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{contextWindow} tokens</span>
              </div>
              <input
                type="range"
                min={2048}
                max={32768}
                step={1024}
                value={contextWindow}
                onChange={(e) => onChangeContextWindow?.(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span>CPU Inference Threads</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{threads} threads</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={threads}
                onChange={(e) => onChangeThreads?.(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
