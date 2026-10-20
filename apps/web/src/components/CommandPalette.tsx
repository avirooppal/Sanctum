import React, { useState, useEffect, type KeyboardEvent } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  onExecute: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].onExecute();
        onClose();
      }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          backgroundColor: '#121824',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '15px',
            }}
          />
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '6px' }}>
          {filtered.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.onExecute();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? '#1e293b' : 'transparent',
                  color: isSelected ? '#f8fafc' : '#cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', marginRight: '8px', textTransform: 'uppercase' }}>
                    {cmd.category}
                  </span>
                  <span>{cmd.title}</span>
                </div>
                {cmd.shortcut && (
                  <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#0b0f17', padding: '2px 6px', borderRadius: '4px' }}>
                    {cmd.shortcut}
                  </span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No matching commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
