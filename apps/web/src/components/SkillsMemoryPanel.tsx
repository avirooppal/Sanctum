import React, { useState } from 'react';
import type { Skill, Memory, AssistantProfile } from '../api.js';

export interface SkillsMemoryPanelProps {
  skills: Skill[];
  memories: Memory[];
  profiles: AssistantProfile[];
  onSaveSkill: (skill: { id?: string; name: string; description?: string; content: string; enabled?: boolean }) => Promise<void>;
  onDeleteSkill: (id: string) => Promise<void>;
  onSaveMemory: (mem: { id?: string; assistant_id?: string | null; fact: string; category?: string }) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const SkillsMemoryPanel: React.FC<SkillsMemoryPanelProps> = ({
  skills,
  memories,
  profiles,
  onSaveSkill,
  onDeleteSkill,
  onSaveMemory,
  onDeleteMemory,
}) => {
  const [activeTab, setActiveTab] = useState<'skills' | 'memory'>('skills');

  // Skill editing state
  const [editingSkill, setEditingSkill] = useState<{
    id?: string;
    name: string;
    description: string;
    content: string;
    enabled: boolean;
  } | null>(null);

  // New Memory state
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('preference');
  const [newAssistantId, setNewAssistantId] = useState<string>('');

  const handleSaveSkillForm = async () => {
    if (!editingSkill || !editingSkill.name.trim() || !editingSkill.content.trim()) return;
    await onSaveSkill(editingSkill);
    setEditingSkill(null);
  };

  const handleSaveMemoryForm = async () => {
    if (!newFact.trim()) return;
    await onSaveMemory({
      fact: newFact.trim(),
      category: newCategory,
      assistant_id: newAssistantId || null,
    });
    setNewFact('');
  };

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
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Skills & Memory</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Manage Markdown instruction skills and persistent user memory facts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: '#121824', borderRadius: '6px', padding: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'skills' ? '#1e293b' : 'transparent',
              color: activeTab === 'skills' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Markdown Skills ({skills.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'memory' ? '#1e293b' : 'transparent',
              color: activeTab === 'memory' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Memory Ledger ({memories.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {activeTab === 'skills' ? (
          <div>
            {/* Skills Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>System Instruction Skills</h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Plain Markdown guidelines loaded on-demand into assistant contexts.
                </p>
              </div>
              {!editingSkill && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingSkill({
                      name: '',
                      description: '',
                      content: '',
                      enabled: true,
                    })
                  }
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + New Skill
                </button>
              )}
            </div>

            {/* Skill Editor Modal/Form */}
            {editingSkill && (
              <div
                style={{
                  backgroundColor: '#121824',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '24px',
                }}
              >
                <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>
                  {editingSkill.id ? 'Edit Skill' : 'Create New Skill'}
                </h3>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Skill Name
                    </label>
                    <input
                      type="text"
                      value={editingSkill.name}
                      onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                      placeholder="e.g. Code Reviewer, Technical Writer"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: '#0b0f17',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingSkill.description}
                      onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                      placeholder="Short summary of what this skill instructs"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: '#0b0f17',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Markdown Instructions
                    </label>
                    <textarea
                      value={editingSkill.content}
                      onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
                      rows={6}
                      placeholder="# Role & Rules&#10;Follow these specific guidelines..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#0b0f17',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingSkill(null)}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: 'transparent',
                        color: '#94a3b8',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSkillForm}
                      disabled={!editingSkill.name.trim() || !editingSkill.content.trim()}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#38bdf8',
                        color: '#0b0f17',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: !editingSkill.name.trim() || !editingSkill.content.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Save Skill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Skills List */}
            <div style={{ display: 'grid', gap: '12px' }}>
              {skills.map((s) => (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: '#121824',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>{s.name}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: s.enabled ? '#065f46' : '#1e293b',
                          color: s.enabled ? '#34d399' : '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {s.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    {s.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{s.description}</p>
                    )}
                    <pre
                      style={{
                        margin: '10px 0 0',
                        padding: '8px 12px',
                        backgroundColor: '#0b0f17',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#cbd5e1',
                        maxHeight: '80px',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {s.content}
                    </pre>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingSkill(s)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#1e293b',
                        color: '#38bdf8',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSkill(s.id)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#1e293b',
                        color: '#ef4444',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {skills.length === 0 && !editingSkill && (
                <div
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    backgroundColor: '#121824',
                    borderRadius: '8px',
                    border: '1px dashed #334155',
                    color: '#64748b',
                  }}
                >
                  No custom skills created yet. Skills provide reusable Markdown system prompts and specialized workflow guidelines.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Memory Actions Bar */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Persistent Memory Ledger</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Key user facts, preferences, and guidelines preserved across conversations.
              </p>
            </div>

            {/* Add Memory Form */}
            <div
              style={{
                backgroundColor: '#121824',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: '1fr 140px 180px auto',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="Enter a new memory fact (e.g. Preferred language is TypeScript)..."
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#0b0f17',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveMemoryForm();
                }}
              />

              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#0b0f17',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <option value="preference">Preference</option>
                <option value="fact">Fact</option>
                <option value="project">Project</option>
                <option value="style">Style</option>
              </select>

              <select
                value={newAssistantId}
                onChange={(e) => setNewAssistantId(e.target.value)}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#0b0f17',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <option value="">Global (All Assistants)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSaveMemoryForm}
                disabled={!newFact.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: !newFact.trim() ? '#1e293b' : '#38bdf8',
                  color: !newFact.trim() ? '#64748b' : '#0b0f17',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !newFact.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Add Fact
              </button>
            </div>

            {/* Memory List */}
            <div style={{ display: 'grid', gap: '8px' }}>
              {memories.map((m) => {
                const asst = profiles.find((p) => p.id === m.assistant_id);
                return (
                  <div
                    key={m.id}
                    style={{
                      backgroundColor: '#121824',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        {m.category || 'fact'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#f8fafc' }}>{m.fact}</span>
                      {asst && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          [{asst.name}]
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteMemory(m.id)}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}

              {memories.length === 0 && (
                <div
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    backgroundColor: '#121824',
                    borderRadius: '8px',
                    border: '1px dashed #334155',
                    color: '#64748b',
                  }}
                >
                  No persistent memory facts recorded.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
