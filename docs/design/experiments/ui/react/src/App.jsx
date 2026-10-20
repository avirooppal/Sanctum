import React, { useState } from 'react';

export default function App() {
  const [threads, setThreads] = useState([
    { id: '1', title: 'Rust Gateway Architecture' },
    { id: '2', title: 'Local Inference Verification' },
    { id: '3', title: 'Egress Broker Policy' }
  ]);
  const [activeThread, setActiveThread] = useState('1');
  const [messages, setMessages] = useState([
    { role: 'user', content: 'What is the role of the supervised llama worker in Sanctum?' },
    { role: 'assistant', content: 'The supervised worker runs llama.cpp as an isolated child process managed by the Rust gateway supervisor with guaranteed cancellation.' }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [model, setModel] = useState('qwen2.5-coder-7b');
  const [temperature, setTemperature] = useState(0.7);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'This response simulates streaming token completion from local engine.' }
      ]);
      setIsStreaming(false);
    }, 400);
  };

  const handleStop = () => {
    setIsStreaming(false);
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={() => {
            const id = String(Date.now());
            setThreads(prev => [{ id, title: 'New Conversation' }, ...prev]);
            setActiveThread(id);
          }}>
            + New Thread
          </button>
        </div>
        <div className="thread-list">
          {threads.map(t => (
            <div
              key={t.id}
              className={`thread-item ${t.id === activeThread ? 'active' : ''}`}
              onClick={() => setActiveThread(t.id)}
            >
              {t.title}
            </div>
          ))}
        </div>
      </div>

      <div className="main-chat">
        <div className="chat-header">
          <span>Active Model: <strong>{model}</strong></span>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            style={{ background: 'none', border: 'none', color: '#909296', cursor: 'pointer' }}
          >
            {settingsOpen ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        <div className="message-list">
          {messages.map((m, idx) => (
            <div key={idx} className={`message-item message-${m.role}`}>
              {m.content}
            </div>
          ))}
          {isStreaming && (
            <div className="message-item message-assistant" style={{ fontStyle: 'italic', opacity: 0.7 }}>
              Generating tokens...
            </div>
          )}
        </div>

        <div className="composer-area">
          <input
            className="composer-input"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          {isStreaming ? (
            <button className="stop-btn" onClick={handleStop}>Stop</button>
          ) : (
            <button className="send-btn" onClick={handleSend}>Send</button>
          )}
        </div>
      </div>

      <div className={`settings-drawer ${settingsOpen ? '' : 'collapsed'}`}>
        <h3>Thread Settings</h3>
        <div className="setting-group">
          <label className="setting-label">Model</label>
          <select className="setting-control" value={model} onChange={e => setModel(e.target.value)}>
            <option value="qwen2.5-coder-7b">Qwen 2.5 Coder 7B</option>
            <option value="llama-3.2-3b">Llama 3.2 3B</option>
            <option value="phi-3.5-mini">Phi 3.5 Mini</option>
          </select>
        </div>
        <div className="setting-group">
          <label className="setting-label">Temperature: {temperature}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
