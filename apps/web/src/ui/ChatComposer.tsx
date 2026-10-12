import React, { useState, useRef, useEffect } from 'react';
import { Button } from './primitives.js';
import { STRINGS } from './strings.js';
import type { SanctumClient } from '../api.js';
import { MicrophoneCapture } from '../microphone.js';
import { SpeechController } from '../speech.js';

export interface ChatComposerProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  sendOnEnter: boolean;
  api?: SanctumClient;
  token?: string;
  conversation?: string;
  onAttachmentUploaded?: (documentName: string) => void;
  className?: string;
}

export const IMPLEMENTED_SLASH_COMMANDS = [
  { command: '/help', description: 'Show available local commands' },
  { command: '/clear', description: 'Clear messages in current session' },
  { command: '/stop', description: 'Stop current generation' },
  { command: '/info', description: 'Show active model and privacy invariants' },
];

export function ChatComposer({
  prompt,
  setPrompt,
  onSend,
  onStop,
  busy,
  sendOnEnter,
  api,
  token,
  conversation,
  onAttachmentUploaded,
  className = '',
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Dictation state
  const [recording, setRecording] = useState(false);
  const [dictationStatus, setDictationStatus] = useState('');
  const microphoneRef = useRef<MicrophoneCapture | null>(null);
  const speechControllerRef = useRef<SpeechController | null>(null);

  // Initialize dictation
  useEffect(() => {
    if (token) {
      speechControllerRef.current = new SpeechController(token, {
        fetch: (input, init) => fetch(input, init),
        play: () => () => {},
      });
      microphoneRef.current = new MicrophoneCapture();
    }
    return () => {
      microphoneRef.current?.cancel();
    };
  }, [token]);

  // Autosize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 240);
    el.style.height = `${Math.max(nextHeight, 64)}px`;
  }, [prompt]);

  // Check for slash menu
  useEffect(() => {
    if (prompt.startsWith('/') && !prompt.includes(' ')) {
      setShowSlashMenu(true);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  }, [prompt]);

  const filteredCommands = IMPLEMENTED_SLASH_COMMANDS.filter(c =>
    c.command.toLowerCase().startsWith(prompt.toLowerCase())
  );

  const applySlashCommand = (cmd: string) => {
    setPrompt(cmd);
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex(idx => (idx + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex(idx => (idx - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySlashCommand(filteredCommands[selectedSlashIndex].command);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    } else if (!sendOnEnter && e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const validateAndUploadFile = async (file: File) => {
    setUploadError(null);
    setUploadNotice(null);

    const validExtensions = ['.md', '.pdf'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setUploadError('Only Markdown (.md) and PDF (.pdf) documents are accepted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Document exceeds maximum size of 10 MiB.');
      return;
    }

    if (!api) {
      setUploadError('Local API client is not connected.');
      return;
    }

    try {
      setUploadNotice(`Uploading ${file.name} to Knowledge…`);
      const workspaces = await api.workspaces();
      let targetWorkspace = workspaces[0]?.id;
      if (!targetWorkspace) {
        targetWorkspace = await api.createWorkspace('Default Workspace');
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const docId = await api.uploadDocument(targetWorkspace, file.name, bytes);
      setUploadNotice(`✓ Ingested to Knowledge: ${file.name}`);
      onAttachmentUploaded?.(file.name);
      setTimeout(() => setUploadNotice(null), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndUploadFile(files[0]);
    }
  };

  const toggleDictation = async () => {
    if (!microphoneRef.current || !speechControllerRef.current) return;
    if (recording) {
      setRecording(false);
      setDictationStatus('Transcribing locally…');
      try {
        const file = microphoneRef.current.finish();
        if (file) {
          const text = await speechControllerRef.current.transcribe(file, 'whisper-base');
          if (text) {
            setPrompt(prompt ? `${prompt} ${text}` : text);
            setDictationStatus('Transcript added to draft.');
            setTimeout(() => setDictationStatus(''), 3000);
          }
        }
      } catch (err) {
        setDictationStatus(String(err));
      }
    } else {
      setDictationStatus('Listening locally… (max 30s)');
      const started = await microphoneRef.current.start(
        () => {
          setDictationStatus('30s limit reached. Finish dictation.');
        },
        err => {
          setDictationStatus(err);
          setRecording(false);
        }
      );
      if (started) {
        setRecording(true);
      }
    }
  };

  return (
    <div
      className={`app-composer relative ${className}`}
      onDragOver={e => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent rounded-2xl backdrop-blur-xs">
          <p className="text-sm font-semibold text-accent">Drop Markdown or PDF to ingest into Knowledge</p>
        </div>
      )}

      {/* Slash command autocomplete menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div
          role="listbox"
          aria-label="Slash commands"
          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border ui-border ui-surface shadow-lg overflow-hidden z-30"
        >
          <div className="text-[10px] uppercase font-mono tracking-wider px-3 py-1.5 border-b ui-border ui-text-secondary bg-black/5 dark:bg-white/5">
            Commands
          </div>
          {filteredCommands.map((cmd, idx) => (
            <button
              key={cmd.command}
              type="button"
              role="option"
              aria-selected={idx === selectedSlashIndex}
              onClick={() => applySlashCommand(cmd.command)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                idx === selectedSlashIndex ? 'bg-accent/15 text-accent' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span className="font-mono font-semibold">{cmd.command}</span>
              <span className="text-[11px] ui-text-secondary">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ui-surface border ui-border rounded-2xl p-4 shadow-sm focus-within:border-accent transition-colors">
        <textarea
          ref={textareaRef}
          aria-label="Message"
          placeholder={STRINGS.composer.placeholder}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none w-full bg-transparent outline-hidden text-sm leading-relaxed"
        />

        <div className="flex justify-between items-center mt-3 pt-2 border-t ui-border">
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.pdf"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) {
                  validateAndUploadFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach document to Knowledge"
              title="Attach .md or .pdf (max 10 MiB)"
              className="p-1.5 rounded-lg border ui-border hover:bg-black/5 dark:hover:bg-white/5 text-xs text-display ui-text-secondary hover:text-foreground transition-colors flex items-center gap-1"
            >
              📎 <span className="hidden sm:inline">Attach</span>
            </button>

            {/* Dictation Toggle */}
            {token && (
              <button
                type="button"
                onClick={toggleDictation}
                aria-label={recording ? 'Finish dictation' : 'Start dictation'}
                title="Dictate with local speech model"
                className={`p-1.5 rounded-lg border ui-border text-xs text-display transition-colors flex items-center gap-1 ${
                  recording ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse' : 'hover:bg-black/5 dark:hover:bg-white/5 ui-text-secondary'
                }`}
              >
                🎤 <span className="hidden sm:inline">{recording ? 'Listening…' : 'Dictate'}</span>
              </button>
            )}

            <span className="text-[11px] text-display ui-text-secondary hidden md:inline ml-1">
              {sendOnEnter ? 'Enter to send (Shift+Enter for newline)' : 'Shift+Enter to send'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {busy && (
              <Button variant="outline" onClick={onStop}>
                {STRINGS.composer.stop}
              </Button>
            )}
            <button
              disabled={busy || !prompt.trim()}
              onClick={onSend}
              className="ui-primary text-white py-1.5 px-4 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Generating…' : 'Send ↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Upload feedback */}
      {uploadNotice && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 px-1 animate-fade-in">
          {uploadNotice}
        </p>
      )}
      {uploadError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1.5 px-1">
          {uploadError}
        </p>
      )}
      {dictationStatus && (
        <p role="status" className="text-xs ui-text-secondary mt-1.5 px-1">
          {dictationStatus}
        </p>
      )}
    </div>
  );
}
