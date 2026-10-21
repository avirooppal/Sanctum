import React from 'react';

export interface StatusBarProps {
  isReady?: boolean;
  platformAssurance?: string;
  activeModelName?: string;
  threads?: number;
  contextWindow?: number;
  lowMemoryWarning?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isReady = true,
  platformAssurance = 'not verified',
  activeModelName = '',
  threads = 6,
  contextWindow = 8192,
  lowMemoryWarning = false,
}) => {
  return (
    <footer
      style={{
        height: '28px',
        backgroundColor: '#0b0f17',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        color: '#94a3b8',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isReady ? '#10b981' : '#f59e0b',
              display: 'inline-block',
            }}
          />
          <span>{isReady ? 'Engine Ready' : 'Connecting...'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Assurance:</span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: platformAssurance.includes('verified kernel') ? '#064e3b' : '#1e293b',
              color: platformAssurance.includes('verified kernel') ? '#6ee7b7' : '#94a3b8',
              fontWeight: 600,
            }}
          >
            {platformAssurance}
          </span>
        </div>

        {lowMemoryWarning && (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              fontWeight: 600,
            }}
          >
            ⚠️ Low RAM Headroom (&lt; 1.5 GB)
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>Model: <strong style={{ color: '#cbd5e1' }}>{activeModelName}</strong></span>
        <span>Threads: <strong style={{ color: '#cbd5e1' }}>{threads}</strong></span>
        <span>Context: <strong style={{ color: '#cbd5e1' }}>{contextWindow}</strong></span>
      </div>
    </footer>
  );
};
