import React from 'react';
import type { PackInfo } from '../api.js';

export interface PacksPanelProps {
  packs: PackInfo[];
  platformAssurance?: string;
  onLoadPack?: (id: string) => void;
  onUnloadPack?: (id: string) => void;
}

export const PacksPanel: React.FC<PacksPanelProps> = ({
  packs,
  platformAssurance = 'not verified',
  onLoadPack,
  onUnloadPack,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Modality & Capability Packs</h2>
          <span
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: platformAssurance.includes('verified kernel') ? '#064e3b' : '#334155',
              color: platformAssurance.includes('verified kernel') ? '#6ee7b7' : '#94a3b8',
              fontWeight: 600,
            }}
          >
            Assurance: {platformAssurance}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          Optional capability packs for Knowledge (RAG), Full-Duplex Voice, Vision reasoning, and Disposable Sandbox Automation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {packs.map((pack) => {
            const isLoaded = pack.state === 'loaded';
            const isInstalled = pack.state === 'installed' || isLoaded;
            return (
              <div
                key={pack.id}
                style={{
                  padding: '20px',
                  borderRadius: '8px',
                  backgroundColor: '#121824',
                  border: `1px solid ${isLoaded ? '#38bdf8' : '#1e293b'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{pack.name}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor:
                          pack.state === 'loaded'
                            ? '#0369a1'
                            : pack.state === 'installed'
                            ? '#1e293b'
                            : '#0f172a',
                        color:
                          pack.state === 'loaded'
                            ? '#e0f2fe'
                            : pack.state === 'installed'
                            ? '#38bdf8'
                            : '#64748b',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {pack.state}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                    {pack.description || 'No description provided.'}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                    <span>RAM Budget: <strong style={{ color: '#cbd5e1' }}>{pack.ram_budget_mb} MB</strong></span>
                    <span>Disk: <strong style={{ color: '#cbd5e1' }}>{(pack.disk_bytes / 1024 / 1024).toFixed(1)} MB</strong></span>
                    <span>Version: <strong style={{ color: '#cbd5e1' }}>{pack.version}</strong></span>
                  </div>
                </div>

                <div>
                  {isLoaded ? (
                    <button
                      type="button"
                      onClick={() => onUnloadPack?.(pack.id)}
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
                      Unload
                    </button>
                  ) : isInstalled ? (
                    <button
                      type="button"
                      onClick={() => onLoadPack?.(pack.id)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#38bdf8',
                        color: '#0b0f17',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Load Pack
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#1e293b',
                        color: '#64748b',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'default',
                      }}
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
