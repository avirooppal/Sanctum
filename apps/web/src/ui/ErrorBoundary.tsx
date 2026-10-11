import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { STRINGS } from './strings.js';
import { Button } from './primitives.js';

interface Props {
  panelId?: string;
  panelTitle?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Isolated panel error log (in-app only, zero external telemetry)
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[Sanctum PanelError:${this.props.panelId || 'unknown'}]`, error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = this.props.panelTitle || this.props.panelId || 'Panel';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="ui-card"
          style={{
            margin: '16px',
            border: '1px solid var(--ui-danger, #f87171)',
            background: 'var(--ui-surface-raised, #1c2622)',
            color: 'var(--ui-text-primary, #e8efe9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: 'var(--ui-danger, #f87171)', fontSize: '18px', fontWeight: 'bold' }}>⚠</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              {title} encountered an unexpected issue
            </h3>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ui-text-secondary, #9fb3a4)' }}>
            <strong>What happened:</strong> This panel ran into a rendering problem and paused safely.
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--ui-text-secondary, #9fb3a4)' }}>
            <strong>What you can do:</strong> Other panels and your active drafts remain fully intact.
            Click below to reload this panel.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '8px',
                background: 'var(--ui-background, #0f1412)',
                borderRadius: '4px',
                overflowX: 'auto',
                marginBottom: '12px',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <Button variant="outline" onClick={this.handleReset}>
            Reload {title}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
