import React, { useEffect, useState } from 'react';
import { Button } from './primitives.js';

export interface ToastItem {
  id: string;
  message: string;
  onUndo?: () => void;
  durationMs?: number;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function UndoToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 'var(--ui-z-toast, 50)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
        width: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <SingleToast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function SingleToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const duration = toast.durationMs ?? 5000;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <div
      className="ui-card"
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        padding: '12px 16px',
        border: '1px solid var(--ui-accent, #48a87b)',
        background: 'var(--ui-surface-raised, #1c2622)',
        color: 'var(--ui-text-primary, #e8efe9)',
        boxShadow: 'var(--ui-shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.35))',
        borderRadius: 'var(--ui-radius-md, 8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {toast.message}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ui-text-secondary, #9fb3a4)' }}>
          {toast.onUndo ? 'Item will be permanently removed shortly' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {toast.onUndo && (
          <Button
            variant="primary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => {
              toast.onUndo?.();
              onDismiss();
            }}
          >
            Undo
          </Button>
        )}
        <Button
          variant="quiet"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          Dismiss
        </Button>
      </div>

      {/* Progress countdown bar */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          width: `${progress}%`,
          background: 'var(--ui-accent, #48a87b)',
          transition: 'width 50ms linear',
        }}
      />
    </div>
  );
}
