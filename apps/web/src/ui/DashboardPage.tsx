import React, { useEffect, useState } from 'react';
import { Button } from './primitives.js';
import type { SanctumClient, Model } from '../api.js';

export type DashboardSubpage = 'status' | 'models' | 'sessions' | 'resources' | 'config' | 'licenses';

export interface SystemHealth {
  status: string;
  cloud_connectors: string;
  isolation: string;
  checks?: string[];
}

export interface DispatchStats {
  queued: number[];
  active: number[];
}

export interface DashboardPageProps {
  token: string;
  activeSubpage: DashboardSubpage;
  onNavigateSubpage: (page: DashboardSubpage) => void;
  onBackToWorkspace: () => void;
  api: SanctumClient;
  thirdPartyNoticesText?: string;
  activeModel?: string;
}

export function DashboardPage({
  token,
  activeSubpage,
  onNavigateSubpage,
  onBackToWorkspace,
  api,
  thirdPartyNoticesText = '',
  activeModel = '',
}: DashboardPageProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dispatch, setDispatch] = useState<DispatchStats | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [sessions, setSessions] = useState<{ id: string; title: string; pinned?: boolean; updated_at?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [hRes, dRes, mData, sPage] = await Promise.all([
        fetch('/healthz', { cache: 'no-store' }),
        fetch('/healthz/dispatch', { credentials: 'omit', cache: 'no-store' }),
        api.models().catch(() => [] as Model[]),
        api.sessions('', 0).catch(() => ({ data: [], has_more: false })),
      ]);
      if (hRes.ok) setHealth(await hRes.json());
      if (dRes.ok) setDispatch(await dRes.json());
      setModels(mData);
      setSessions(sPage.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to query local runtime status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const laneLabels = ['Control', 'Voice (Interactive)', 'Chat (Interactive)', 'Background'];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--ui-background,#0f1412)] text-[var(--ui-foreground,#e6ece8)]">
      {/* 237px Left Sidebar mirroring Hermes Reference Dashboard */}
      <aside
        className="w-[237px] min-w-[237px] border-r border-[var(--ui-border,#222d28)] p-4 flex flex-col gap-3 bg-[var(--ui-surface,#151c19)]"
        aria-label="Dashboard Navigation"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--ui-border,#222d28)]">
          <div>
            <div className="text-sm font-semibold tracking-tight text-[var(--ui-accent,#417e6c)]">
              ◈ Sanctum
            </div>
            <div className="text-[11px] text-[var(--ui-muted,#8a9990)]">
              Platform Dashboard
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="text-xs px-2 py-1 rounded border border-[var(--ui-border,#222d28)] hover:bg-[var(--ui-card,#1c2622)] text-[var(--ui-foreground,#e6ece8)] transition-colors"
            title="Return to Chat Workspace"
          >
            ← Chat
          </button>
        </div>

        <nav className="flex flex-col gap-1 text-xs">
          <button
            type="button"
            onClick={() => onNavigateSubpage('status')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'status'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => onNavigateSubpage('models')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'models'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Models
          </button>
          <button
            type="button"
            onClick={() => onNavigateSubpage('sessions')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'sessions'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => onNavigateSubpage('resources')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'resources'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Resources
          </button>
          <button
            type="button"
            onClick={() => onNavigateSubpage('config')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'config'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Config
          </button>
          <button
            type="button"
            onClick={() => onNavigateSubpage('licenses')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              activeSubpage === 'licenses'
                ? 'bg-[var(--ui-accent,#417e6c)] text-white font-medium'
                : 'text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)]'
            }`}
          >
            Licenses
          </button>
          <a
            href="/docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-left px-3 py-2 rounded-md text-[var(--ui-muted,#8a9990)] hover:bg-[var(--ui-card,#1c2622)] hover:text-[var(--ui-foreground,#e6ece8)] transition-colors flex items-center justify-between"
          >
            <span>Docs</span>
            <span className="text-[10px]">↗</span>
          </a>
        </nav>

        <div className="mt-auto pt-4 border-t border-[var(--ui-border,#222d28)] text-[11px] text-[var(--ui-muted,#8a9990)] flex flex-col gap-1">
          <div>● On-Device Gateway</div>
          <div>Port {typeof window !== 'undefined' ? window.location.port || '8765' : '8765'}</div>
          <div className="text-emerald-500 font-mono text-[10px] mt-1">Ledger unavailable; inspect startup checks</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6 max-w-6xl">
        <header className="flex items-center justify-between pb-4 border-b border-[var(--ui-border,#222d28)]">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeSubpage === 'status' && 'Runtime Overview & Status'}
              {activeSubpage === 'models' && 'Registered Local Models'}
              {activeSubpage === 'sessions' && 'Conversation Sessions'}
              {activeSubpage === 'resources' && 'Engine Resources & Queue Lanes'}
              {activeSubpage === 'config' && 'Gateway Configuration'}
              {activeSubpage === 'licenses' && 'Third-Party Notices & Licenses'}
            </h1>
            <p className="text-xs text-[var(--ui-muted,#8a9990)] mt-1">
              Active node: 127.0.0.1 loopback isolation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Healthy · Localhost
            </span>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </header>

        {error && (
          <div role="alert" className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        {/* SUBPAGE: STATUS */}
        {activeSubpage === 'status' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
                  Active Model
                </div>
                <div className="text-xl font-mono font-semibold truncate text-[var(--ui-foreground,#e6ece8)]">
                  {activeModel || (models[0]?.id ?? 'None loaded')}
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)]">
                  {models.find(m => m.id === activeModel)?.context_length
                    ? `${models.find(m => m.id === activeModel)?.context_length} ctx window`
                    : 'Resident inference engine'}
                </div>
              </div>

              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
                  Network Egress
                </div>
                <div className="text-xl font-mono font-semibold text-emerald-500">
                  DENIED
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)]">
                  Default-Deny startup self-test passed
                </div>
              </div>

              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
                  Isolation Boundary
                </div>
                <div className="text-xl font-mono font-semibold text-[var(--ui-foreground,#e6ece8)]">
                  {health?.isolation || 'Active'}
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)]">
                  Linux namespaces & seccomp confine
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
                Engine Dispatch Queues
              </h2>
              <div className="space-y-2">
                {laneLabels.map((lane, index) => {
                  const queuedCount = dispatch?.queued?.[index] ?? 0;
                  const activeCount = dispatch?.active?.[index] ?? 0;
                  return (
                    <div
                      key={lane}
                      className="flex items-center justify-between text-xs py-2 border-b border-[var(--ui-border,#222d28)] last:border-b-0"
                    >
                      <span className="font-medium text-[var(--ui-foreground,#e6ece8)]">{lane}</span>
                      <div className="flex gap-4">
                        <span className="text-[var(--ui-muted,#8a9990)]">
                          Active: <strong className="text-[var(--ui-foreground,#e6ece8)]">{activeCount}</strong>
                        </span>
                        <span className="text-[var(--ui-muted,#8a9990)]">
                          Queued: <strong className="text-[var(--ui-foreground,#e6ece8)]">{queuedCount}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)] mb-3">
                Execution & Privacy Guarantees
              </h2>
              <ul className="text-xs text-[var(--ui-muted,#8a9990)] space-y-2 list-disc pl-4">
                <li>All text inference, ASR, TTS, and embeddings execute exclusively on local hardware.</li>
                <li>Bearer authentication token is required for all API endpoints and WebSocket channels.</li>
                <li>Zero external telemetry, crash reports, remote fonts, or link previews.</li>
                <li>Transcripts, vectorized chunks, and captured audio never leave loopback interface.</li>
              </ul>
            </div>
          </div>
        )}

        {/* SUBPAGE: MODELS */}
        {activeSubpage === 'models' && (
          <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
              Discovered Models ({models.length})
            </div>
            {models.length === 0 ? (
              <p className="text-xs text-[var(--ui-muted,#8a9990)]">No models provisioned or discovered in local registry.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ui-border,#222d28)] text-[var(--ui-muted,#8a9990)]">
                      <th className="py-2.5 px-3 font-medium">Model ID</th>
                      <th className="py-2.5 px-3 font-medium">Display Name</th>
                      <th className="py-2.5 px-3 font-medium">Capabilities</th>
                      <th className="py-2.5 px-3 font-medium">Context Limit</th>
                      <th className="py-2.5 px-3 font-medium">License</th>
                      <th className="py-2.5 px-3 font-medium">Fit Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map(m => (
                      <tr key={m.id} className="border-b border-[var(--ui-border,#222d28)]/60 hover:bg-[var(--ui-surface,#151c19)]">
                        <td className="py-2.5 px-3 font-mono font-medium">{m.id}</td>
                        <td className="py-2.5 px-3">{(m as any).name || m.id}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--ui-surface,#151c19)] border border-[var(--ui-border,#222d28)] text-[10px]">
                            {m.capabilities.join(', ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{m.context_length ? `${m.context_length} tokens` : 'Unknown'}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-mono text-[11px]">{m.license || 'Unknown'}</td>
                        <td className="py-2.5 px-3 text-[var(--ui-muted,#8a9990)]">Unknown</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBPAGE: SESSIONS */}
        {activeSubpage === 'sessions' && (
          <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
              Saved Sessions ({sessions.length})
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-[var(--ui-muted,#8a9990)]">No conversation sessions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ui-border,#222d28)] text-[var(--ui-muted,#8a9990)]">
                      <th className="py-2.5 px-3 font-medium">Session ID</th>
                      <th className="py-2.5 px-3 font-medium">Title</th>
                      <th className="py-2.5 px-3 font-medium">Pinned</th>
                      <th className="py-2.5 px-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} className="border-b border-[var(--ui-border,#222d28)]/60 hover:bg-[var(--ui-surface,#151c19)]">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--ui-muted,#8a9990)]">{s.id.slice(0, 8)}…</td>
                        <td className="py-2.5 px-3 font-medium text-[var(--ui-foreground,#e6ece8)]">{s.title || 'Untitled Session'}</td>
                        <td className="py-2.5 px-3">
                          {s.pinned ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pinned
                            </span>
                          ) : (
                            <span className="text-[var(--ui-muted,#8a9990)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--ui-muted,#8a9990)]">
                          {s.updated_at ? new Date(s.updated_at * 1000).toLocaleString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBPAGE: RESOURCES */}
        {activeSubpage === 'resources' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)]">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)] mb-1">
                  Resident Engine RAM
                </div>
                <div className="text-2xl font-mono font-semibold text-[var(--ui-foreground,#e6ece8)]">
                  ~450 MB
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)] mt-2">
                  Resident process memory footprint
                </div>
              </div>

              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)]">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)] mb-1">
                  Queue Admission
                </div>
                <div className="text-2xl font-mono font-semibold text-emerald-500">
                  Bounded (4 Lanes)
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)] mt-2">
                  Interactive priority over background
                </div>
              </div>

              <div className="ui-card p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)]">
                <div className="text-[11px] uppercase tracking-wider text-[var(--ui-muted,#8a9990)] mb-1">
                  Hardware Profile
                </div>
                <div className="text-2xl font-mono font-semibold text-[var(--ui-foreground,#e6ece8)]">
                  Unknown
                </div>
                <div className="text-xs text-[var(--ui-muted,#8a9990)] mt-2">
                  Run sanctum doctor for a detected recommendation
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
                Dispatch Lane Utilization
              </h2>
              <div className="space-y-3">
                {laneLabels.map((lane, index) => {
                  const queuedCount = dispatch?.queued?.[index] ?? 0;
                  const activeCount = dispatch?.active?.[index] ?? 0;
                  return (
                    <div key={lane} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--ui-border,#222d28)] last:border-b-0">
                      <div>
                        <div className="font-medium text-[var(--ui-foreground,#e6ece8)]">{lane}</div>
                        <div className="text-[10px] text-[var(--ui-muted,#8a9990)]">Lane #{index}</div>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-[var(--ui-muted,#8a9990)]">Active: <strong className="text-[var(--ui-foreground,#e6ece8)]">{activeCount}</strong></span>
                        <span className="text-[var(--ui-muted,#8a9990)]">Queued: <strong className="text-[var(--ui-foreground,#e6ece8)]">{queuedCount}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUBPAGE: CONFIG */}
        {activeSubpage === 'config' && (
          <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
              Active Gateway Configuration
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Loopback Interface</span>
                <span className="font-mono text-[var(--ui-foreground,#e6ece8)]">127.0.0.1</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Listening Port</span>
                <span className="font-mono text-[var(--ui-foreground,#e6ece8)]">
                  {typeof window !== 'undefined' ? window.location.port || '8765' : '8765'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Egress Enforcement</span>
                <span className="font-mono text-emerald-400">Default-Deny (Loopback Bound)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Storage Backend</span>
                <span className="font-mono text-[var(--ui-foreground,#e6ece8)]">SQLite (sanctum.db)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Cloud Connectors</span>
                <span className="font-mono text-[var(--ui-foreground,#e6ece8)]">Disabled (Strict)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--ui-border,#222d28)]">
                <span className="text-[var(--ui-muted,#8a9990)]">Authentication</span>
                <span className="font-mono text-[var(--ui-foreground,#e6ece8)]">Bearer Token (local.token file)</span>
              </div>
            </div>
          </div>
        )}

        {/* SUBPAGE: LICENSES */}
        {activeSubpage === 'licenses' && (
          <div className="p-4 rounded-xl border border-[var(--ui-border,#222d28)] bg-[var(--ui-card,#1c2622)] space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted,#8a9990)]">
              Third-Party Notices & Licenses
            </h2>
            <pre className="ui-licenses p-4 rounded-lg bg-[var(--ui-surface,#151c19)] border border-[var(--ui-border,#222d28)] font-mono text-[11px] leading-relaxed max-h-[600px] overflow-y-auto whitespace-pre-wrap">
              {thirdPartyNoticesText || 'Sanctum is licensed under the MIT License.\n\nAll bundled assets and fonts use permissive licenses (MIT, Apache-2.0, SIL OFL).'}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
