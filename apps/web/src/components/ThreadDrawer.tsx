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
  params,
  onUpdateParams,
  onDeleteThread,
  onExportThread,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-80 h-full border-l border-border bg-card flex flex-col text-foreground select-none shrink-0 z-20 shadow-md">
      {/* Header */}
      <div className="h-12 border-b border-border/40 px-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Model Parameters</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Close drawer"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* System Prompt */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            System Instructions
          </label>
          <textarea
            rows={4}
            value={params.systemPrompt}
            onChange={(e) => onUpdateParams({ systemPrompt: e.target.value })}
            placeholder="Custom instructions for this conversation..."
            className="w-full bg-input/20 border border-input/40 rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
          />
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Temperature</span>
            <span className="font-mono text-muted-foreground">{params.temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={params.temperature}
            onChange={(e) => onUpdateParams({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Focused (0.0)</span>
            <span>Creative (2.0)</span>
          </div>
        </div>

        {/* Top P */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Top P</span>
            <span className="font-mono text-muted-foreground">{params.topP.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={params.topP}
            onChange={(e) => onUpdateParams({ topP: parseFloat(e.target.value) })}
            className="w-full accent-primary cursor-pointer"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Max Output Tokens</span>
            <span className="font-mono text-muted-foreground">{params.maxTokens}</span>
          </div>
          <input
            type="number"
            min="128"
            max="8192"
            step="128"
            value={params.maxTokens}
            onChange={(e) => onUpdateParams({ maxTokens: parseInt(e.target.value, 10) || 2048 })}
            className="w-full bg-input/20 border border-input/40 rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Stream Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <div>
            <div className="text-xs font-medium text-foreground">Stream Responses</div>
            <div className="text-[11px] text-muted-foreground">Emit tokens in real time</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateParams({ stream: !params.stream })}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
              params.stream ? 'bg-primary justify-end' : 'bg-muted justify-start'
            }`}
          >
            <div className="size-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        {/* Thread Actions */}
        {(onDeleteThread || onExportThread) && (
          <div className="pt-4 border-t border-border/20 space-y-2">
            {onExportThread && (
              <button
                onClick={onExportThread}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:bg-accent text-xs font-medium transition-colors"
              >
                Export JSON
              </button>
            )}
            {onDeleteThread && (
              <button
                onClick={onDeleteThread}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
              >
                Delete Conversation
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
