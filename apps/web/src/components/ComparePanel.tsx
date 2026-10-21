import React, { useState } from 'react';
import { SafeMarkdown } from '../ui/SafeMarkdown.js';

export interface ComparePanelProps {
  models: { id: string; name?: string }[];
  activeModelId?: string;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({
  models,
  activeModelId = 'qwen2.5-coder-7b',
}) => {
  const [modelA, setModelA] = useState(models[0]?.id || activeModelId);
  const [modelB, setModelB] = useState(models[1]?.id || 'llama-3.2-3b-instruct');
  const [prompt, setPrompt] = useState('Write a concise comparison of local Rust vs Python for backend engineering.');
  const [isRunning, setIsRunning] = useState(false);
  const [resultA, setResultA] = useState<string | null>(null);
  const [resultB, setResultB] = useState<string | null>(null);
  const [metricsA, setMetricsA] = useState<{ speed: string; tokens: number; ttft: string } | null>(null);
  const [metricsB, setMetricsB] = useState<{ speed: string; tokens: number; ttft: string } | null>(null);
  const [blindMode, setBlindMode] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);

  const handleRunCompare = () => {
    setIsRunning(true);
    setResultA(null);
    setResultB(null);
    setVoted(null);

    // Simulate side-by-side generation
    setTimeout(() => {
      setResultA(
        `### Rust for Backend Engineering\n- **Zero-Cost Abstractions**: High memory safety without garbage collection pauses.\n- **Performance**: High throughput and predictable sub-millisecond tail latencies.\n- **Concurrency**: Compile-time data race prevention with \`Send\` / \`Sync\` traits.\n- **Trade-off**: Steeper learning curve and longer compilation times.`
      );
      setMetricsA({ speed: '44.2 tok/s', tokens: 72, ttft: '180ms' });
    }, 900);

    setTimeout(() => {
      setResultB(
        `### Python for Backend Engineering\n- **Rapid Development**: Extensive ecosystem (FastAPI, PyTorch, LangChain) with fast prototyping.\n- **Ecosystem**: Defacto standard for AI/ML pipelines and glue code.\n- **Trade-off**: Higher RAM consumption, GIL bottlenecks under heavy CPU loads, and runtime typing errors.`
      );
      setMetricsB({ speed: '36.8 tok/s', tokens: 68, ttft: '210ms' });
      setIsRunning(false);
    }, 1400);
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
        overflowY: 'auto',
        padding: '24px 32px',
        gap: '24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚖️</span> Model Compare & Arena
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Side-by-side prompt evaluation, throughput benchmarks, and blind output synthesis.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blindMode}
              onChange={(e) => setBlindMode(e.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            Blind Testing Mode
          </label>
        </div>
      </div>

      {/* Model Selectors & Prompt Input */}
      <div
        style={{
          backgroundColor: '#121824',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              {blindMode ? 'Candidate A' : 'Model A'}
            </label>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              disabled={isRunning}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#0b0f17',
                border: '1px solid #1e293b',
                color: '#f8fafc',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              {blindMode ? 'Candidate B' : 'Model B'}
            </label>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              disabled={isRunning}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#0b0f17',
                border: '1px solid #1e293b',
                color: '#f8fafc',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
            Comparison Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isRunning}
            rows={3}
            placeholder="Enter a prompt to run simultaneously across both models..."
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#0b0f17',
              border: '1px solid #1e293b',
              color: '#f8fafc',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRunCompare}
            disabled={isRunning || !prompt.trim()}
            style={{
              padding: '10px 20px',
              background: '#38bdf8',
              color: '#0b0f17',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isRunning ? 'Benchmarking Both Models...' : '⚡ Run Side-by-Side'}
          </button>
        </div>
      </div>

      {/* Side-by-Side Results Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
        {/* Left Card */}
        <div
          style={{
            backgroundColor: '#121824',
            border: voted === 'A' ? '2px solid #38bdf8' : '1px solid #1e293b',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1e293b',
              backgroundColor: '#1a2332',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: '14px', color: '#38bdf8' }}>
              {blindMode && !voted ? 'Candidate 1' : modelA}
            </strong>
            {metricsA && (
              <span style={{ fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>
                ⚡ {metricsA.speed} · TTFT {metricsA.ttft}
              </span>
            )}
          </div>

          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {isRunning && !resultA ? (
              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>Generating tokens...</div>
            ) : resultA ? (
              <SafeMarkdown content={resultA} />
            ) : (
              <div style={{ color: '#475569', fontSize: '13px' }}>Results will appear here.</div>
            )}
          </div>

          {resultA && resultB && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setVoted('A')}
                style={{
                  padding: '6px 14px',
                  background: voted === 'A' ? '#38bdf8' : '#1e293b',
                  color: voted === 'A' ? '#0b0f17' : '#f8fafc',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                👍 {blindMode ? 'Candidate 1 was Better' : `Vote for ${modelA}`}
              </button>
            </div>
          )}
        </div>

        {/* Right Card */}
        <div
          style={{
            backgroundColor: '#121824',
            border: voted === 'B' ? '2px solid #38bdf8' : '1px solid #1e293b',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1e293b',
              backgroundColor: '#1a2332',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: '14px', color: '#38bdf8' }}>
              {blindMode && !voted ? 'Candidate 2' : modelB}
            </strong>
            {metricsB && (
              <span style={{ fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>
                ⚡ {metricsB.speed} · TTFT {metricsB.ttft}
              </span>
            )}
          </div>

          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {isRunning && !resultB ? (
              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>Generating tokens...</div>
            ) : resultB ? (
              <SafeMarkdown content={resultB} />
            ) : (
              <div style={{ color: '#475569', fontSize: '13px' }}>Results will appear here.</div>
            )}
          </div>

          {resultA && resultB && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setVoted('B')}
                style={{
                  padding: '6px 14px',
                  background: voted === 'B' ? '#38bdf8' : '#1e293b',
                  color: voted === 'B' ? '#0b0f17' : '#f8fafc',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                👍 {blindMode ? 'Candidate 2 was Better' : `Vote for ${modelB}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
