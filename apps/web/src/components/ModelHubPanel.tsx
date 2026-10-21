import React, { useState, useRef } from 'react';
import type { Model } from '../api.js';

export interface HardwareInfo {
  threads: number;
  context: number;
  vram_mb?: number;
  total_ram_mb?: number;
}

export interface ModelHubPanelProps {
  models: Model[];
  activeModelId: string;
  hardware: HardwareInfo | null;
  onSelectModel: (id: string) => void;
  onImportGguf: (file: File) => Promise<void>;
  onDeleteModel?: (id: string) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<'installed' | 'catalog'>('installed');
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
      setImportSuccess(`Imported "${file.name}" successfully.`);
    } catch (err: unknown) {
      setImportErr(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-background text-foreground overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <h1 className="text-2xl font-bold font-studio tracking-tight text-foreground">Model Hub</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage local weights and import GGUF models</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileRef}
              accept=".gguf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span>{importing ? 'Importing...' : 'Import GGUF'}</span>
            </button>
          </div>
        </div>

        {/* Status Banners */}
        {importErr && (
          <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs">
            {importErr}
          </div>
        )}
        {importSuccess && (
          <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs">
            {importSuccess}
          </div>
        )}

        {/* Tabs & Search */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/40">
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'installed'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Installed ({models.length})
            </button>
          </div>

          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
              className="w-56 border border-border/40 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Model List */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 space-y-3">
            <div className="size-10 rounded-full bg-secondary text-muted-foreground mx-auto flex items-center justify-center">
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">No models installed</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Import a local .gguf weights file using the Import button above to begin.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((m) => {
              const isActive = m.id === activeModelId;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'border-primary/50 bg-card shadow-sm'
                      : 'border-border bg-card/60 hover:border-border/80'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate" title={m.id}>
                        {m.id}
                      </h3>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/40 shrink-0">
                        GGUF
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {m.context_length && <span>Context: {m.context_length}</span>}
                      {m.license && <span>License: {m.license}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <button
                      onClick={() => onSelectModel(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {isActive ? '✓ Active' : 'Load Model'}
                    </button>

                    {onDeleteModel && (
                      <button
                        onClick={() => onDeleteModel(m.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete model"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
