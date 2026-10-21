import React, { useState } from 'react';
import type { CloudProvider, LocalApiServerStatus } from '../api.js';

export interface ProvidersPanelProps {
  providers: CloudProvider[];
  localApiStatus: LocalApiServerStatus | null;  // null = API unreachable
  onSaveProviderKey: (id: string, apiKey: string) => Promise<void>;
  onRemoveProviderKey: (id: string) => Promise<void>;
  onStartLocalApi: (port: number, allowedOrigins: string) => Promise<void>;
  onStopLocalApi: () => Promise<void>;
  onUpdateLocalApiConfig: (port: number, allowedOrigins: string) => Promise<void>;
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#0b0f17',
  border: '1px solid #1e293b',
  borderRadius: '6px',
  color: '#f8fafc',
  fontSize: '13px',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
};

export const ProvidersPanel: React.FC<ProvidersPanelProps> = ({
  providers,
  localApiStatus,
  onSaveProviderKey,
  onRemoveProviderKey,
  onStartLocalApi,
  onStopLocalApi,
  onUpdateLocalApiConfig,
}) => {
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [localPort, setLocalPort] = useState<number>(localApiStatus?.port ?? 11434);
  const [localOrigins, setLocalOrigins] = useState(localApiStatus?.allowed_origins ?? '');
  const [localBusy, setLocalBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveKey = async (id: string) => {
    const key = editingKey[id]?.trim();
    if (!key) return;
    setSaving((s) => ({ ...s, [id]: true }));
    setErr(null);
    try {
      await onSaveProviderKey(id, key);
      setEditingKey((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const removeKey = async (id: string) => {
    setErr(null);
    try { await onRemoveProviderKey(id); } catch (e) { setErr(e instanceof Error ? e.message : 'Remove failed.'); }
  };

  const toggleLocalApi = async () => {
    setLocalBusy(true);
    setErr(null);
    try {
      if (localApiStatus?.running) {
        await onStopLocalApi();
      } else {
        await onStartLocalApi(localPort, localOrigins);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to toggle local API server.');
    } finally {
      setLocalBusy(false);
    }
  };

  const saveLocalConfig = async () => {
    setLocalBusy(true);
    setErr(null);
    try {
      await onUpdateLocalApiConfig(localPort, localOrigins);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save config.');
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', padding: '24px', overflowY: 'auto', backgroundColor: '#0b0f17', color: '#f8fafc' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Providers & Local API</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          Cloud providers are <strong>off by default</strong>. Every request to a cloud provider is written to the egress ledger.
          Keys are stored only in the local credential store, never transmitted except to the named provider.
        </p>

        {err && (
          <div style={{ padding: '10px 14px', backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: '6px', fontSize: '13px', marginBottom: '20px' }}>
            {err}
          </div>
        )}

        {/* Local OpenAI-compatible API server */}
        <section style={{ padding: '20px', backgroundColor: '#121824', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Local API Server</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Exposes an OpenAI-compatible endpoint on localhost. Use with any compatible client.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {localApiStatus === null ? (
                <span style={{ fontSize: '12px', color: '#64748b' }}>Unknown</span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '5px',
                  backgroundColor: localApiStatus.running ? '#064e3b' : '#1e293b',
                  color: localApiStatus.running ? '#6ee7b7' : '#94a3b8',
                  fontWeight: 700,
                }}>
                  {localApiStatus.running ? '● RUNNING' : '○ STOPPED'}
                </span>
              )}
              <button
                type="button"
                id="btn-toggle-local-api"
                onClick={toggleLocalApi}
                disabled={localBusy || localApiStatus === null}
                style={{
                  padding: '6px 14px',
                  backgroundColor: localApiStatus?.running ? '#7f1d1d' : '#064e3b',
                  color: localApiStatus?.running ? '#fca5a5' : '#6ee7b7',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: (localBusy || localApiStatus === null) ? 'not-allowed' : 'pointer',
                  opacity: (localBusy || localApiStatus === null) ? 0.5 : 1,
                }}
              >
                {localBusy ? '…' : localApiStatus?.running ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Port</label>
              <input
                id="local-api-port"
                type="number"
                min={1024}
                max={65535}
                value={localPort}
                onChange={(e) => setLocalPort(Number(e.target.value))}
                style={INPUT}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Allowed origins (CORS)</label>
              <input
                id="local-api-origins"
                type="text"
                value={localOrigins}
                onChange={(e) => setLocalOrigins(e.target.value)}
                placeholder="e.g. http://localhost:3000"
                style={INPUT}
              />
            </div>
          </div>

          {localApiStatus?.running && (
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', fontFamily: 'monospace' }}>
              Endpoint: http://localhost:{localApiStatus.port}/v1
            </div>
          )}

          <button
            type="button"
            id="btn-save-local-api-config"
            onClick={saveLocalConfig}
            disabled={localBusy}
            style={{ padding: '6px 14px', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: localBusy ? 'not-allowed' : 'pointer', opacity: localBusy ? 0.5 : 1 }}
          >
            Save Config
          </button>
        </section>

        {/* Cloud providers */}
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
          Cloud Providers
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400, marginLeft: '10px' }}>
            All cloud usage is logged in the egress ledger.
          </span>
        </h3>

        {providers.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
            No cloud providers available. Check gateway configuration.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {providers.map((p) => {
            const draftKey = editingKey[p.id] ?? '';
            const isSaving = saving[p.id] ?? false;
            return (
              <div
                key={p.id}
                style={{
                  padding: '16px',
                  backgroundColor: '#121824',
                  border: `1px solid ${p.has_key ? '#065f46' : '#1e293b'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{p.name}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: '#7f1d1d',
                      color: '#fca5a5',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      CLOUD
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '5px',
                    backgroundColor: p.has_key ? '#064e3b' : '#1e293b',
                    color: p.has_key ? '#6ee7b7' : '#64748b',
                    fontWeight: 600,
                  }}>
                    {p.has_key ? 'KEY SET' : 'NO KEY'}
                  </span>
                </div>

                {p.description && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{p.description}</div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id={`provider-key-${p.id}`}
                    type="password"
                    value={draftKey}
                    onChange={(e) => setEditingKey((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.has_key ? '••••••••••••  (replace existing key)' : 'Enter API key…'}
                    style={{ ...INPUT, flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    id={`btn-save-key-${p.id}`}
                    onClick={() => saveKey(p.id)}
                    disabled={isSaving || !draftKey.trim()}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#38bdf8',
                      color: '#0b0f17',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: (isSaving || !draftKey.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (isSaving || !draftKey.trim()) ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save Key'}
                  </button>
                  {p.has_key && (
                    <button
                      type="button"
                      id={`btn-remove-key-${p.id}`}
                      onClick={() => removeKey(p.id)}
                      style={{ padding: '8px 12px', backgroundColor: '#2d1b1b', color: '#f87171', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      Remove
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
