import React, { useState, useRef } from 'react';
import type { Model } from '../api.js';

/** Hardware data comes from the capability report — never hardcoded. */
export interface HardwareInfo {
  threads: number;
  context: number;
  vram_mb?: number;       // Unknown on Windows without a probe; absent = not measured
  total_ram_mb?: number;
}

export interface ModelHubPanelProps {
  models: Model[];
  activeModelId: string;
  hardware: HardwareInfo | null;   // null = API not yet contacted
  onSelectModel: (id: string) => void;
  onImportGguf: (file: File) => Promise<void>;
  onDeleteModel?: (id: string) => Promise<void>;
}

/** Fit estimate thresholds (rule-of-thumb; labeled as estimate per ADR0095) */
function fitLabel(model: Model, hw: HardwareInfo | null): { label: string; color: string } {
  if (!hw) return { label: 'Unknown', color: '#64748b' };
  const ctx = model.context_length ?? 4096;
  const bytes = ctx * 2; // rough Q4 KV cache per token
  const ramBytes = (hw.total_ram_mb ?? 0) * 1024 * 1024;
  if (ramBytes === 0) return { label: 'Unknown', color: '#64748b' };
  if (bytes < ramBytes * 0.5) return { label: '✓ Recommended', color: '#22c55e' };
  if (bytes < ramBytes * 0.85) return { label: '△ Fits (tight)', color: '#f59e0b' };
  return { label: '✗ May not fit', color: '#ef4444' };
}

export const ModelHubPanel: React.FC<ModelHubPanelProps> = ({
  models,
  activeModelId,
  hardware,
  onSelectModel,
  onImportGguf,
  onDeleteModel,
}) => {
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = models.filter((m) => m.id.toLowerCase().includes(search.toLowerCase()));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.gguf')) {
      setImportErr('Only .gguf files are supported.');
      return;
    }
    setImporting(true);
    setImportErr(null);
    setImportSuccess(null);
    try {
      await onImportGguf(file);
      setImportSuccess(`Imported: ${file.name}`);
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', padding: '24px', overflowY: 'auto', backgroundColor: '#0b0f17', color: '#f8fafc' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Model Hub</h2>
          <button
            type="button"
            id="btn-import-gguf"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{
              padding: '7px 16px',
              backgroundColor: importing ? '#1e3a5f' : '#38bdf8',
              color: importing ? '#7dd3fc' : '#0b0f17',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: importing ? 'not-allowed' : 'pointer',
            }}
          >
            {importing ? 'Importing…' : '↑ Import GGUF'}
          </button>
          <input
            ref={fileRef}
            id="input-gguf-file"
            type="file"
            accept=".gguf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          Local GGUF weights only. No model is downloaded automatically.
          Fit estimates are rule-of-thumb (context window × Q4 KV ÷ available RAM) and are labeled as estimates.
        </p>

        {/* Hardware strip */}
        <div style={{ padding: '12px 16px', backgroundColor: '#121824', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <HwStat label="CPU threads" value={hardware ? String(hardware.threads) : 'Unknown'} />
          <HwStat label="Max context" value={hardware ? `${hardware.context.toLocaleString()} tok` : 'Unknown'} />
          <HwStat label="System RAM" value={hardware?.total_ram_mb ? `${Math.round(hardware.total_ram_mb / 1024)} GB` : 'Unknown'} />
          <HwStat label="GPU VRAM" value={hardware?.vram_mb ? `${Math.round(hardware.vram_mb / 1024)} GB` : 'Unknown'} />
          {!hardware && (
            <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>
              Hardware data unavailable — gateway offline or probe not run.
            </span>
          )}
        </div>

        {/* Feedback banners */}
        {importErr && (
          <div style={{ padding: '10px 14px', backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {importErr}
          </div>
        )}
        {importSuccess && (
          <div style={{ padding: '10px 14px', backgroundColor: '#064e3b', color: '#6ee7b7', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {importSuccess}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Filter models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#121824',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            color: '#f8fafc',
            fontSize: '13px',
            boxSizing: 'border-box',
            marginBottom: '16px',
          }}
        />

        {/* Model cards */}
        {filtered.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
            {models.length === 0
              ? 'No models detected. Import a GGUF file to get started.'
              : 'No models match your search.'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {filtered.map((model) => {
            const isActive = model.id === activeModelId;
            const fit = fitLabel(model, hardware);
            return (
              <div
                key={model.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#121824',
                  border: `2px solid ${isActive ? '#38bdf8' : '#1e293b'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', wordBreak: 'break-all' }}>{model.id}</span>
                  {isActive && <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, flexShrink: 0 }}>ACTIVE</span>}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {model.capabilities.map((c) => (
                    <span key={c} style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#1e293b', color: '#38bdf8', borderRadius: '4px', fontWeight: 600 }}>
                      {c}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>Context: <span style={{ color: '#cbd5e1' }}>{(model.context_length ?? 0).toLocaleString() || 'Unknown'} tokens</span></div>
                  <div>License: <span style={{ color: '#cbd5e1' }}>{model.license || 'Unknown'}</span></div>
                  <div>
                    Fit estimate:{' '}
                    <span style={{ color: fit.color, fontWeight: 600 }}>{fit.label}</span>
                    <span style={{ color: '#475569', fontSize: '10px', marginLeft: '4px' }}>(estimate)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onSelectModel(model.id)}
                    style={{
                      flex: 1,
                      padding: '7px',
                      backgroundColor: isActive ? '#0e4372' : '#1e293b',
                      color: isActive ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isActive ? '✓ Selected' : 'Use This Model'}
                  </button>
                  {onDeleteModel && (
                    <button
                      type="button"
                      onClick={() => onDeleteModel(model.id)}
                      style={{ padding: '7px 10px', backgroundColor: '#2d1b1b', color: '#f87171', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      ✕
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

const HwStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '14px', fontWeight: 600, color: value === 'Unknown' ? '#475569' : '#f8fafc' }}>{value}</div>
  </div>
);
