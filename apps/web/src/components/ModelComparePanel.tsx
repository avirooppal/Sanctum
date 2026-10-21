import React, { useState, useRef, useCallback } from 'react';
import type { SanctumClient, Model } from '../api.js';

export interface ModelComparePanelProps {
  client: SanctumClient;
  models: Model[];
  platformAssurance: string;
}

interface StreamResult {
  content: string;
  isStreaming: boolean;
  durationMs: number | null;
  tokenCount: number;
  error: string | null;
}

export const ModelComparePanel: React.FC<ModelComparePanelProps> = ({
  client,
  models,
  platformAssurance,
}) => {
  const [modelA, setModelA] = useState<string>(models[0]?.id || '');
  const [modelB, setModelB] = useState<string>(models[1]?.id || models[0]?.id || '');
  const [prompt, setPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [resultA, setResultA] = useState<StreamResult>({
    content: '',
    isStreaming: false,
    durationMs: null,
    tokenCount: 0,
    error: null,
  });

  const [resultB, setResultB] = useState<StreamResult>({
    content: '',
    isStreaming: false,
    durationMs: null,
    tokenCount: 0,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRunComparison = useCallback(async () => {
    if (!prompt.trim() || !modelA || !modelB || isRunning) return;

    setIsRunning(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setResultA({ content: '', isStreaming: true, durationMs: null, tokenCount: 0, error: null });
    setResultB({ content: '', isStreaming: true, durationMs: null, tokenCount: 0, error: null });

    const messages = [{ role: 'user' as const, content: prompt.trim() }];

    // Stream Model A
    const runStreamA = async () => {
      const startTime = performance.now();
      let count = 0;
      try {
        const stream = client.chat(modelA, messages, 'compare-session-a', signal);
        for await (const chunk of stream) {
          count += 1;
          setResultA((prev) => ({
            ...prev,
            content: prev.content + chunk,
            tokenCount: count,
          }));
        }
        const duration = Math.round(performance.now() - startTime);
        setResultA((prev) => ({ ...prev, isStreaming: false, durationMs: duration }));
      } catch (err) {
        if (!signal.aborted) {
          setResultA((prev) => ({
            ...prev,
            isStreaming: false,
            error: err instanceof Error ? err.message : 'Generation failed',
          }));
        }
      }
    };

    // Stream Model B
    const runStreamB = async () => {
      const startTime = performance.now();
      let count = 0;
      try {
        const stream = client.chat(modelB, messages, 'compare-session-b', signal);
        for await (const chunk of stream) {
          count += 1;
          setResultB((prev) => ({
            ...prev,
            content: prev.content + chunk,
            tokenCount: count,
          }));
        }
        const duration = Math.round(performance.now() - startTime);
        setResultB((prev) => ({ ...prev, isStreaming: false, durationMs: duration }));
      } catch (err) {
        if (!signal.aborted) {
          setResultB((prev) => ({
            ...prev,
            isStreaming: false,
            error: err instanceof Error ? err.message : 'Generation failed',
          }));
        }
      }
    };

    try {
      await Promise.all([runStreamA(), runStreamB()]);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [client, modelA, modelB, prompt, isRunning]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsRunning(false);
      setResultA((prev) => ({ ...prev, isStreaming: false }));
      setResultB((prev) => ({ ...prev, isStreaming: false }));
    }
  };

  const hasResults = resultA.content || resultB.content || isRunning;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Model Compare Arena</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Run dual local inference side-by-side on identical prompts.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: platformAssurance === 'verified kernel containment' ? '#065f46' : '#1e293b',
              color: platformAssurance === 'verified kernel containment' ? '#34d399' : '#94a3b8',
              fontWeight: 500,
            }}
          >
            {platformAssurance === 'verified kernel containment' ? 'CONTAINED' : 'UNVERIFIED'}
          </span>
        </div>
      </header>

      {/* Model Selectors Bar */}
      <div
        style={{
          padding: '12px 24px',
          backgroundColor: '#121824',
          borderBottom: '1px solid #1e293b',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>Model A:</label>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            disabled={isRunning}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: '#0b0f17',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
            {models.length === 0 && <option value="">No models installed</option>}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7' }}>Model B:</label>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            disabled={isRunning}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: '#0b0f17',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
            {models.length === 0 && <option value="">No models installed</option>}
          </select>
        </div>
      </div>

      {/* Comparison Split Panes */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          backgroundColor: '#1e293b',
          overflow: 'hidden',
        }}
      >
        {/* Pane A */}
        <div
          style={{
            backgroundColor: '#0b0f17',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>{modelA || 'Model A'}</span>
            <div style={{ display: 'flex', gap: '12px', color: '#94a3b8' }}>
              {resultA.durationMs !== null && <span>⏱️ {(resultA.durationMs / 1000).toFixed(2)}s</span>}
              {resultA.tokenCount > 0 && <span>🔢 {resultA.tokenCount} chunks</span>}
            </div>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {resultA.error ? (
              <div style={{ color: '#ef4444' }}>Error: {resultA.error}</div>
            ) : resultA.content ? (
              resultA.content
            ) : !hasResults ? (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '48px' }}>
                Select models, enter a prompt below, and run comparison.
              </div>
            ) : resultA.isStreaming ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Streaming response...</div>
            ) : null}
          </div>
        </div>

        {/* Pane B */}
        <div
          style={{
            backgroundColor: '#0b0f17',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#a855f7' }}>{modelB || 'Model B'}</span>
            <div style={{ display: 'flex', gap: '12px', color: '#94a3b8' }}>
              {resultB.durationMs !== null && <span>⏱️ {(resultB.durationMs / 1000).toFixed(2)}s</span>}
              {resultB.tokenCount > 0 && <span>🔢 {resultB.tokenCount} chunks</span>}
            </div>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {resultB.error ? (
              <div style={{ color: '#ef4444' }}>Error: {resultB.error}</div>
            ) : resultB.content ? (
              resultB.content
            ) : !hasResults ? (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '48px' }}>
                Select models, enter a prompt below, and run comparison.
              </div>
            ) : resultB.isStreaming ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Streaming response...</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Prompt Input Form */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt to evaluate both models simultaneously..."
          rows={2}
          disabled={isRunning}
          style={{
            flex: 1,
            backgroundColor: '#121824',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#f8fafc',
            fontSize: '14px',
            resize: 'none',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleRunComparison();
            }
          }}
        />

        {isRunning ? (
          <button
            type="button"
            onClick={handleStop}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              height: '42px',
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRunComparison}
            disabled={!prompt.trim() || !modelA || !modelB}
            style={{
              padding: '10px 24px',
              backgroundColor: !prompt.trim() || !modelA || !modelB ? '#1e293b' : '#38bdf8',
              color: !prompt.trim() || !modelA || !modelB ? '#64748b' : '#0b0f17',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: !prompt.trim() || !modelA || !modelB ? 'not-allowed' : 'pointer',
              height: '42px',
            }}
          >
            Compare Models
          </button>
        )}
      </div>
    </div>
  );
};
