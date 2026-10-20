import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  panelTitle?: string;
  fallback?: ReactNode;
  onReset?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Error is captured locally for diagnosis without external egress
    console.error(`[PanelErrorBoundary] Panel '${this.props.panelTitle || 'unknown'}' crashed:`, error, info);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            margin: '16px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            border: '1px solid #f43f5e',
            color: '#f8fafc',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {this.props.panelTitle || 'Panel'} encountered an error
            </h3>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this panel.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '6px 14px',
              backgroundColor: '#38bdf8',
              color: '#0b0f17',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Retry Panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
