import React, { useState, useEffect, useRef } from 'react';
import type { Model, SanctumClient } from '../api.js';
import { ContextBar } from './ContextBar.js';
import { STRINGS } from './strings.js';
import {privacyMessage,startupChecksPassed,type RuntimeHealth} from '../runtime-truth.js';

export interface StatusBarProps {
  api?: SanctumClient;
  conversation: string;
  activeModel: string;
  models: Model[];
  onSelectModel: (modelId: string) => void;
  className?: string;
}

type HealthData=RuntimeHealth;

interface DispatchData {
  queued: number[];
  active: number[];
}

const LANE_NAMES = ['Control', 'Voice (Interactive)', 'Chat (Interactive)', 'Background'];

export function StatusBar({
  api,
  conversation,
  activeModel,
  models,
  onSelectModel,
  className = '',
}: StatusBarProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [dispatch, setDispatch] = useState<DispatchData | null>(null);
  const [showDispatchPopover, setShowDispatchPopover] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Poll /healthz and /healthz/dispatch
  useEffect(() => {
    let active = true;
    let inFlight=false;
    const controller=new AbortController();

    async function fetchStatus() {
      if(inFlight)return;
      inFlight=true;
      try {
        const [hRes, dRes] = await Promise.all([
          fetch('/healthz', { cache: 'no-store',credentials:'omit',redirect:'error',signal:controller.signal }),
          fetch('/healthz/dispatch', { credentials: 'omit', cache: 'no-store',redirect:'error',signal:controller.signal }),
        ]);
        if (!active) return;
        if (hRes.ok) {
          const hData = await hRes.json();
          setHealth(hData);
        }else setHealth(null);
        if (dRes.ok) {
          const dData = await dRes.json();
          const valid=(value:unknown)=>Array.isArray(value)&&value.length===4&&value.every(item=>Number.isInteger(item)&&item>=0);
          setDispatch(valid(dData.queued)&&valid(dData.active)?dData:null);
        }else setDispatch(null);
      } catch {
        if (active) {
          setHealth(null);setDispatch(null);
        }
      } finally {inFlight=false;}
    }

    fetchStatus();
    const timer = setInterval(fetchStatus, 8000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowDispatchPopover(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalQueued = dispatch?dispatch.queued.reduce((a,b)=>a+b,0):null;
  const totalActive = dispatch?dispatch.active.reduce((a,b)=>a+b,0):null;
  const totalJobs = totalQueued!==null&&totalActive!==null?totalQueued+totalActive:null;

  const isHealthy = health?.status === 'ok';
  const currentModelObj = models.find(m => m.id === activeModel);
  const contextLimit = currentModelObj?.context_length;

  return (
    <footer
      role="status"
      aria-label="Status Bar"
      className={`status-bar border-t ui-border ui-surface px-3 py-1.5 flex flex-wrap gap-2 items-center justify-between text-xs ui-text-secondary select-none z-20 ${className}`}
    >
      <details className="runtime-details">
      <summary aria-label="Runtime details" data-startup-checks={startupChecksPassed(health)?'passed':'unknown'}>
        <span className="runtime-dot" aria-hidden="true"/>
        <span>{startupChecksPassed(health)?'Startup checks reported passed':'Startup checks unknown'}</span>
        <span className="runtime-more">Runtime details</span>
      </summary>
      <div className="runtime-details-panel">
      {/* Left side: Runtime Health, Engine Readiness, Egress Badge */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {/* Runtime Health */}
        <div
          className="flex items-center gap-1.5"
          title={`Runtime: ${health?.status || 'connecting'}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="font-medium text-foreground">
            {isHealthy ? STRINGS.statusBar.healthOk : STRINGS.statusBar.healthDegraded}
          </span>
        </div>

        <span aria-hidden="true" className="inline-block h-3 border-r ui-border"/>

        {/* Engine Readiness */}
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="text-xs text-display">
            {isHealthy ? 'Gateway responding' : 'Gateway status unknown'}
          </span>
        </div>

        <span aria-hidden="true" className="hidden sm:inline-block h-3 border-r ui-border"/>

        {/* Offline / Egress Badge */}
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ui-border font-mono text-xs"
          title={privacyMessage(health)}
        >
          {privacyMessage(health)}
        </div>
      </div>

      {/* Right side: Dispatch Jobs Popover, Model Picker, Context Bar */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {/* Background Jobs Popover Toggle */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowDispatchPopover(o => !o)}
            aria-expanded={showDispatchPopover}
            aria-label="Background jobs status"
            className="flex items-center gap-1.5 hover:text-foreground text-xs transition-colors"
          >
            <span>⚡</span>
            <span>
              {STRINGS.statusBar.jobsCount.replace('{count}', totalJobs===null?'Unknown':String(totalJobs))}
            </span>
          </button>

          {showDispatchPopover && (
            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl border ui-border ui-surface shadow-xl z-50 text-xs space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between border-b ui-border pb-1.5">
                <span className="font-semibold text-display">Dispatch Lanes</span>
                <span className="text-xs ui-text-secondary">
                  Active: {totalActive??'Unknown'} | Queued: {totalQueued??'Unknown'}
                </span>
              </div>
              <div className="space-y-1.5">
                {LANE_NAMES.map((name, idx) => {
                  const q = dispatch?.queued?.[idx];
                  const a = dispatch?.active?.[idx];
                  return (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="ui-text-secondary">{name}</span>
                      <span className="font-mono">
                        {a===undefined||q===undefined?'Unknown':a > 0 ? (
                          <strong className="text-accent">{a} active</strong>
                        ) : (
                          'idle'
                        )}
                        {q!==undefined&&q > 0 ? ` (${q} queued)` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span aria-hidden="true" className="inline-block h-3 border-r ui-border"/>

        {/* Model Picker Dropdown */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setShowModelPicker(o => !o)}
            aria-expanded={showModelPicker}
            aria-label="Model picker"
            className="flex items-center gap-1.5 hover:text-foreground text-xs font-medium transition-colors border ui-border px-2 py-0.5 rounded ui-surface"
          >
            <span>◈</span>
            <span className="max-w-[120px] truncate">{activeModel || 'Select Model'}</span>
            <span className="text-xs opacity-70">▼</span>
          </button>

          {showModelPicker && (
            <div className="absolute bottom-full right-0 mb-2 w-72 p-2 rounded-xl border ui-border ui-surface shadow-xl z-50 text-xs space-y-1.5 animate-fade-in">
              <div className="text-xs uppercase font-mono tracking-wider px-2 py-1 border-b ui-border ui-text-secondary">
                Registry Models
              </div>
              {models.length === 0 ? (
                <div className="p-2 text-center text-xs ui-text-secondary">No models configured</div>
              ) : (
                models.filter(model=>model.capabilities.includes('text')).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(m.id);
                      setShowModelPicker(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-colors flex flex-col gap-1 ${
                      m.id === activeModel ? 'bg-accent/15 text-accent' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-medium text-xs">
                      <span className="truncate">{m.id}</span>
                      <span className="text-xs px-1 py-0.2 rounded border ui-border opacity-80">
                        {m.license || 'License unknown'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs ui-text-secondary">
                      <span>Window: {m.context_length ? m.context_length.toLocaleString() : 'Unknown'}</span>
                      <span>Fit / speed: Unknown</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <span aria-hidden="true" className="inline-block h-3 border-r ui-border"/>

        {/* Real Context/Token usage */}
        <ContextBar
          api={api}
          conversation={conversation}
          contextLimit={contextLimit}
        />
      </div>
      </div>
      </details>
    </footer>
  );
}
