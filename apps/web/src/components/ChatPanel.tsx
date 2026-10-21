import React, { useRef, useEffect } from 'react';
import { Composer } from './Composer.js';
import { SafeMarkdown } from '../ui/SafeMarkdown.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  speed?: string;
  citations?: {
    source: string;
    page: number | null;
    quote: string;
  }[];
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming?: () => void;
  activeModelName?: string;
  availableModels?: { id: string; name?: string }[];
  onSelectModel?: (id: string) => void;
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  onNewChat?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isStreaming = false,
  onSendMessage,
  onStopStreaming,
  activeModelName = '',
  availableModels = [],
  onSelectModel,
  isDrawerOpen = false,
  onToggleDrawer,
  onNewChat,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleCopy = (content: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(content);
    }
  };

  const displayModel = activeModelName || (availableModels.length > 0 ? availableModels[0].id : 'Select a model');

  return (
    <div className="flex-1 h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Header: Model Combobox + Actions (No assurance claim in header per Deviation #6) */}
      <div className="h-12 border-b border-border/40 px-4 flex items-center justify-between bg-background/80 backdrop-blur-xs shrink-0 z-10">
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors shadow-xs"
          >
            <div className="size-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{displayModel}</span>
            <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {modelDropdownOpen && availableModels.length > 0 && (
            <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg p-1 z-50">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Installed Models
              </div>
              {availableModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (onSelectModel) onSelectModel(m.id);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                    m.id === activeModelName ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/60'
                  }`}
                >
                  <span className="truncate">{m.name || m.id}</span>
                  {m.id === activeModelName && (
                    <span className="text-primary text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onNewChat && (
            <button
              onClick={onNewChat}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="New Chat (Ctrl+N)"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
          {onToggleDrawer && (
            <button
              onClick={onToggleDrawer}
              className={`p-1.5 rounded-lg transition-colors ${
                isDrawerOpen
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Model Parameters"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" x2="20" y1="21" y2="21" />
                <line x1="4" x2="20" y1="3" y2="3" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="12" x2="12" y1="9" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Scroll Area */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto flex flex-col px-4">
          <div className="mx-auto w-full max-w-3xl my-auto">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-studio font-medium text-foreground tracking-tight">
                How can I help you today?
              </h1>
            </div>
            <Composer
              onSend={onSendMessage}
              onStop={onStopStreaming}
              isStreaming={isStreaming}
              activeModelName={displayModel}
            />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? 'justify-end' : 'items-start gap-3'}`}
                  >
                    {!isUser && (
                      <div className="size-7 rounded-full bg-primary/15 text-primary border border-primary/25 flex items-center justify-center shrink-0 text-xs font-semibold shadow-xs">
                        S
                      </div>
                    )}

                    <div className={`flex flex-col ${isUser ? 'items-end' : 'flex-1 min-w-0'}`}>
                      <div
                        className={`${
                          isUser
                            ? 'max-w-[85%] rounded-2xl bg-secondary text-secondary-foreground px-4 py-2.5 text-sm shadow-xs border border-border/40'
                            : 'w-full text-foreground text-sm'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        ) : (
                          <div>
                            {m.thinking && (
                              <details className="mb-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 text-xs text-muted-foreground">
                                <summary className="cursor-pointer font-medium hover:text-foreground">
                                  Thought process
                                </summary>
                                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{m.thinking}</p>
                              </details>
                            )}
                            <SafeMarkdown content={m.content} />
                          </div>
                        )}
                      </div>

                      {!isUser && (
                        <div className="flex items-center gap-2 pt-1.5 text-xs text-muted-foreground">
                          {m.speed && (
                            <span className="font-mono text-[10px] border border-border/50 rounded px-1.5 py-0.5">
                              {m.speed}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(m.content)}
                            className="hover:text-foreground cursor-pointer text-[11px] transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Composer in Active Chat */}
          <Composer
            onSend={onSendMessage}
            onStop={onStopStreaming}
            isStreaming={isStreaming}
            activeModelName={displayModel}
          />
        </>
      )}
    </div>
  );
};
