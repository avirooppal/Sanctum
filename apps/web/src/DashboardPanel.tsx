import React, { useEffect, useState } from 'react';
import { Button } from './ui/primitives.js';

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

export function DashboardPanel({ token }: { token: string }) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dispatch, setDispatch] = useState<DispatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadMetrics() {
    setLoading(true);
    setError('');
    try {
      const [hRes, dRes] = await Promise.all([
        fetch('/healthz', { cache: 'no-store' }),
        fetch('/healthz/dispatch', { credentials: 'omit', cache: 'no-store' }),
      ]);
      if (hRes.ok) {
        setHealth(await hRes.json());
      }
      if (dRes.ok) {
        setDispatch(await dRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to query local runtime status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const laneLabels = ['Control', 'Voice (Interactive)', 'Chat (Interactive)', 'Background'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-display tracking-wider">Local Platform Status</h2>
          <p className="text-xs ui-text-secondary mt-1">Real-time status of your on-device Sanctum daemon</p>
        </div>
        <Button variant="outline" onClick={loadMetrics} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ui-card">
          <div className="text-[11px] text-display ui-text-secondary mb-1">Daemon Health</div>
          <div className="text-lg font-semibold flex items-center gap-2">
            <span className={health?.status === 'ok' ? 'text-emerald-700' : 'text-amber-700'}>
              ● {health?.status?.toUpperCase() || 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs ui-text-secondary mt-2">Zero foreign egress permitted</p>
        </div>

        <div className="ui-card">
          <div className="text-[11px] text-display ui-text-secondary mb-1">Cloud Policy</div>
          <div className="text-lg font-semibold ui-text-primary">
            {health?.cloud_connectors === 'disabled' ? 'Disabled (Strict)' : 'Restricted'}
          </div>
          <p className="text-xs ui-text-secondary mt-2">All traffic bound to loopback</p>
        </div>

        <div className="ui-card">
          <div className="text-[11px] text-display ui-text-secondary mb-1">Sandboxing</div>
          <div className="text-lg font-semibold ui-text-primary">
            {health?.isolation || 'Active'}
          </div>
          <p className="text-xs ui-text-secondary mt-2">Kernel namespaces & seccomp</p>
        </div>
      </div>

      <div className="ui-card space-y-4">
        <div className="text-xs font-semibold text-display tracking-wider">Engine Dispatch Queues</div>
        <div className="space-y-3">
          {laneLabels.map((lane, index) => {
            const queuedCount = dispatch?.queued?.[index] ?? 0;
            const activeCount = dispatch?.active?.[index] ?? 0;
            return (
              <div key={lane} className="flex items-center justify-between text-xs py-1 border-b ui-border last:border-b-0">
                <span className="font-medium">{lane}</span>
                <div className="flex gap-4">
                  <span className="ui-text-secondary">
                    Active: <strong className="ui-text-primary">{activeCount}</strong>
                  </span>
                  <span className="ui-text-secondary">
                    Queued: <strong className="ui-text-primary">{queuedCount}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ui-card">
        <div className="text-xs font-semibold text-display tracking-wider mb-2">Privacy & Execution Invariants</div>
        <ul className="text-xs ui-text-secondary space-y-1.5 list-disc pl-4">
          <li>All models, ASR, TTS, and embeddings execute exclusively on local hardware.</li>
          <li>Owner authentication token required for API access and WebSocket controls.</li>
          <li>Zero remote tracking, analytics, telemetry, or external network calls.</li>
          <li>Conversations, embeddings, and audio never leave this machine.</li>
        </ul>
      </div>
    </div>
  );
}
