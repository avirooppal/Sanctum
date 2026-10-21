import React, { useState } from 'react';
import type { McpServer } from '../api.js';

export interface McpPanelProps {
  servers: McpServer[];
  onAddServer: (s: { name: string; command: string; args: string[] }) => Promise<void>;
  onRemoveServer: (id: string) => Promise<void>;
  onApproveCall: (callId: string) => void;
  onDenyCall: (callId: string) => void;
  pendingCalls: PendingToolCall[];
}

export interface PendingToolCall {
  callId: string;
  serverId: string;
  tool: string;
  args: Record<string, unknown>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#0b0f17',
  border: '1px solid #1e293b',
  borderRadius: '6px',
  color: '#f8fafc',
  fontSize: '13px',
  boxSizing: 'border-box',
};

export const McpPanel: React.FC<McpPanelProps> = ({
  servers,
  onAddServer,
  onRemoveServer,
  onApproveCall,
  onDenyCall,
  pendingCalls,
}) => {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [argsRaw, setArgsRaw] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim() || !command.trim()) { setErr('Name and command are required.'); return; }
    const args = argsRaw.trim() ? argsRaw.split(/\s+/) : [];
    setAdding(true);
    setErr(null);
    try {
      await onAddServer({ name: name.trim(), command: command.trim(), args });
      setName(''); setCommand(''); setArgsRaw('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add server.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', padding: '24px', overflowY: 'auto', backgroundColor: '#0b0f17', color: '#f8fafc' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>MCP Tool Servers</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          Model Context Protocol servers provide tools to the AI. Every tool call shows
          the exact arguments and requires your approval before it executes.
        </p>

        {/* Pending approval queue */}
        {pendingCalls.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', marginBottom: '12px' }}>
              ⚠ {pendingCalls.length} call{pendingCalls.length > 1 ? 's' : ''} awaiting your approval
            </div>
            {pendingCalls.map((call) => (
              <div
                key={call.callId}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#1c1200',
                  border: '1px solid #92400e',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                    {call.tool}
                  </span>
                  <span style={{ fontSize: '11px', color: '#78716c' }}>server: {call.serverId}</span>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '10px',
                  backgroundColor: '#0b0f17',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {JSON.stringify(call.args, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    id={`btn-approve-${call.callId}`}
                    onClick={() => onApproveCall(call.callId)}
                    style={{ padding: '6px 16px', backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #065f46', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    ✓ Allow
                  </button>
                  <button
                    type="button"
                    id={`btn-deny-${call.callId}`}
                    onClick={() => onDenyCall(call.callId)}
                    style={{ padding: '6px 16px', backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    ✕ Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add server form */}
        <div style={{ padding: '18px', backgroundColor: '#121824', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 14px 0' }}>Add Server</h3>
          {err && (
            <div style={{ padding: '8px 12px', backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
              {err}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Display name *</label>
                <input id="mcp-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. filesystem" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Executable path *</label>
                <input id="mcp-command" type="text" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g. /usr/local/bin/mcp-fs" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Arguments (space-separated)</label>
              <input id="mcp-args" type="text" value={argsRaw} onChange={(e) => setArgsRaw(e.target.value)} placeholder="e.g. --root /home/user/data" style={inputStyle} />
            </div>
            <button
              type="button"
              id="btn-add-mcp-server"
              onClick={add}
              disabled={adding}
              style={{ alignSelf: 'flex-start', padding: '7px 18px', backgroundColor: '#38bdf8', color: '#0b0f17', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.6 : 1 }}
            >
              {adding ? 'Adding…' : 'Add Server'}
            </button>
          </div>
        </div>

        {/* Server list */}
        {servers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
            No servers configured. Add one above to give the AI access to tools.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {servers.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#121824',
                  border: `1px solid ${s.status === 'running' ? '#065f46' : '#1e293b'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: s.status === 'running' ? '#22c55e' : s.status === 'error' ? '#ef4444' : '#94a3b8',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.name}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.command}{s.args?.length ? ' ' + s.args.join(' ') : ''}
                  </div>
                  {s.tools?.length ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {s.tools.map((t) => (
                        <span key={t} style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: '#1e293b', color: '#7dd3fc', borderRadius: '3px' }}>{t}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveServer(s.id)}
                  style={{ padding: '6px 12px', backgroundColor: '#2d1b1b', color: '#f87171', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
