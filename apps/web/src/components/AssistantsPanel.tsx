import React, { useState } from 'react';
import type { AssistantProfile } from '../api.js';

export interface AssistantsPanelProps {
  profiles: AssistantProfile[];
  activeProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onSaveProfile: (p: { id?: string; name: string; system_prompt: string; scope: string }) => Promise<string>;
  onDeleteProfile: (id: string) => Promise<void>;
}

const cardStyle = (active: boolean): React.CSSProperties => ({
  padding: '14px 16px',
  borderRadius: '8px',
  backgroundColor: '#121824',
  border: `2px solid ${active ? '#38bdf8' : '#1e293b'}`,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  transition: 'border-color 0.15s',
});

const emptyInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#0b0f17',
  border: '1px solid #1e293b',
  borderRadius: '6px',
  color: '#f8fafc',
  fontSize: '13px',
  boxSizing: 'border-box',
};

export const AssistantsPanel: React.FC<AssistantsPanelProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const [editing, setEditing] = useState<AssistantProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emptyDraft = (): AssistantProfile => ({
    id: '',
    name: '',
    system_prompt: '',
    scope: 'project',
    created_at: undefined,
    updated_at: undefined,
  });

  const openNew = () => {
    setEditing(emptyDraft());
    setIsNew(true);
    setErr(null);
  };

  const openEdit = (p: AssistantProfile) => {
    setEditing({ ...p });
    setIsNew(false);
    setErr(null);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
    setErr(null);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSaveProfile({
        id: isNew ? undefined : editing.id,
        name: editing.name.trim(),
        system_prompt: editing.system_prompt,
        scope: editing.scope,
      });
      cancel();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    try {
      await onDeleteProfile(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', padding: '24px', overflowY: 'auto', backgroundColor: '#0b0f17', color: '#f8fafc' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Assistants</h2>
          <button
            type="button"
            id="btn-new-assistant"
            onClick={openNew}
            style={{ padding: '7px 16px', backgroundColor: '#38bdf8', color: '#0b0f17', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            + New Assistant
          </button>
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          Each assistant has its own instructions, tool settings, and model assignment.
          The active assistant is applied to all new conversations.
        </p>

        {err && (
          <div style={{ padding: '10px 14px', backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {err}
          </div>
        )}

        {/* Editing form */}
        {editing && (
          <div style={{ padding: '20px', backgroundColor: '#121824', borderRadius: '10px', border: '1px solid #38bdf8', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px 0' }}>
              {isNew ? 'New Assistant' : `Edit — ${editing.name || 'Untitled'}`}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Name *</label>
                <input
                  id="assistant-name"
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Code Reviewer"
                  style={emptyInput}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Scope</label>
                <select
                  id="assistant-scope"
                  value={editing.scope}
                  onChange={(e) => setEditing({ ...editing, scope: e.target.value })}
                  style={{ ...emptyInput, cursor: 'pointer' }}
                >
                  <option value="project">Project</option>
                  <option value="global">Global</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>System Instructions</label>
                <textarea
                  id="assistant-system-prompt"
                  rows={5}
                  value={editing.system_prompt}
                  onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })}
                  placeholder="Describe the assistant's role and constraints…"
                  style={{ ...emptyInput, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  id="btn-save-assistant"
                  onClick={save}
                  disabled={saving}
                  style={{ padding: '7px 20px', backgroundColor: '#38bdf8', color: '#0b0f17', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  id="btn-cancel-assistant"
                  onClick={cancel}
                  style={{ padding: '7px 16px', backgroundColor: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Cards */}
        {profiles.length === 0 && !editing && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
            No assistants yet. Create one to assign custom instructions to your conversations.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {profiles.map((p) => (
            <div key={p.id} style={cardStyle(p.id === activeProfileId)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{p.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: p.scope === 'global' ? '#1e3a5f' : '#1e293b',
                    color: p.scope === 'global' ? '#7dd3fc' : '#94a3b8',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {p.scope}
                </span>
              </div>
              {p.system_prompt && (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.system_prompt}
                </p>
              )}
              {p.updated_at && (
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Updated {new Date(p.updated_at * 1000).toLocaleString()}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => onSelectProfile(p.id)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: p.id === activeProfileId ? '#0e4372' : '#1e293b',
                    color: p.id === activeProfileId ? '#38bdf8' : '#94a3b8',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p.id === activeProfileId ? '✓ Active' : 'Set Active'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  style={{ padding: '6px 12px', backgroundColor: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => del(p.id)}
                  style={{ padding: '6px 10px', backgroundColor: '#2d1b1b', color: '#f87171', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
