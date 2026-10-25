"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconSearch,
  IconMessage,
  IconPlus,
  IconFolder,
  IconCornerDownLeft,
} from "@tabler/icons-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ open, onOpenChange }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { chatSessions, setActiveSessionId, createNewChatSession } = useAppStore();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter threads by search query
  const filteredThreads = chatSessions.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(q);
    const msgMatch = s.messages.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || msgMatch;
  });

  const handleSelectNewChat = () => {
    createNewChatSession();
    onOpenChange(false);
  };

  const handleSelectThread = (id: string) => {
    setActiveSessionId(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 border border-border/80 bg-background/95 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden gap-0">
        <DialogTitle className="sr-only">Search threads</DialogTitle>

        {/* Search Input Bar matching preview (2).webp */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/60 gap-3">
          <IconSearch className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search threads..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Results list */}
        <div className="p-2 max-h-[360px] overflow-y-auto space-y-1">
          {/* Quick Action: New Chat */}
          <button
            type="button"
            onClick={handleSelectNewChat}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-colors",
              selectedIndex === 0 ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <IconPlus className="size-4 text-primary shrink-0" />
              <span className="font-medium text-foreground">New Chat</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">Ctrl+N</span>
          </button>

          {filteredThreads.length > 0 && (
            <div className="pt-2">
              <span className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Threads
              </span>
              <div className="mt-1 space-y-0.5">
                {filteredThreads.map((thread, idx) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => handleSelectThread(thread.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm transition-colors",
                      selectedIndex === idx + 1 ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[420px]">
                      <IconMessage className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{thread.title || "Untitled Session"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {thread.updatedAt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredThreads.length === 0 && query.trim() && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No threads found matching &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer shortcuts matching Jan reference */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">esc</kbd>
            <span>to close</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
