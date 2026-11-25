"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Square,
  ArrowLeftRight,
  X,
  ChevronRight,
  Plus,
  FileText,
  Terminal as TerminalIcon,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { ChatSession } from "@/types";
import { AttachedDoc } from "@/store/slices/chatSlice";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { splitThinking } from "@core/ai/index.ts";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { JanModelHeaderPill } from "@/components/jan/JanModelHeaderPill";
import { ComposerWorkspacePicker } from "@/components/chat/ComposerWorkspacePicker";
import { WorkspaceTools } from "@/components/chat/WorkspaceTools";
import { McpQuickToggle } from "@/components/jan/McpQuickToggle";
import { InteractiveTerminal } from "@/components/terminal/InteractiveTerminal";
import { extractAttachmentText } from "@/lib/attachments";
import {
  handleTitleBarMouseDown,
  handleTitleBarDoubleClick,
  handleTitleBarContextMenu,
} from "@/components/jan/WindowControls";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SplitChatPaneProps {
  splitSession: ChatSession;
  hasWallpaper: boolean;
  isViewerOpen: boolean;
  onToggleDetails: () => void;
  detailsOpen: boolean;
  onOpenMcpSettings?: () => void;
  onSwap: () => void;
  onClose: () => void;
}

const SplitMessageItem: React.FC<{ msg: ChatSession["messages"][number] }> = React.memo(
  ({ msg }) => {
    const [showReasoning, setShowReasoning] = useState(false);

    if (msg.role === "user") {
      return (
        <div className="flex flex-col items-end gap-1">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
            {msg.content}
            {msg.attachments?.map((doc) => (
              <div key={doc.name} className="mt-1.5 text-xs opacity-80">
                📎 {doc.name}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const { thinking, answer } = splitThinking(msg.content);

    return (
      <div className="flex flex-col items-start gap-1.5 w-full min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/90">{msg.modelId || "Assistant"}</span>
          <span>{msg.timestamp}</span>
        </div>

        {thinking && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={cn("size-3.5 transition-transform", showReasoning && "rotate-90")}
              />
              <span>{showReasoning ? "Hide reasoning" : "Show reasoning"}</span>
            </button>
            {showReasoning && (
              <div className="mt-1.5 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {thinking}
              </div>
            )}
          </div>
        )}

        {answer ? (
          <MarkdownRenderer content={answer} className="w-full" />
        ) : (
          !thinking && <div className="text-sm text-muted-foreground animate-pulse">…</div>
        )}
      </div>
    );
  }
);
SplitMessageItem.displayName = "SplitMessageItem";

export const SplitChatPane: React.FC<SplitChatPaneProps> = ({
  splitSession,
  hasWallpaper,
  isViewerOpen,
  onToggleDetails,
  detailsOpen,
  onOpenMcpSettings,
  onSwap,
  onClose,
}) => {
  const {
    sendMessage,
    stopInference,
    activeTrackersBySession,
    models,
    activeModelId,
    documents,
    enableRagInChat,
    setEnableRagInChat,
    clearChatMessages,
    setAgentExecutionMode,
    toggleViewer,
    viewerTabs,
  } = useAppStore(
    useShallow((s) => ({
      sendMessage: s.sendMessage,
      stopInference: s.stopInference,
      activeTrackersBySession: s.activeTrackersBySession,
      models: s.models,
      activeModelId: s.activeModelId,
      documents: s.documents,
      enableRagInChat: s.enableRagInChat,
      setEnableRagInChat: s.setEnableRagInChat,
      clearChatMessages: s.clearChatMessages,
      setAgentExecutionMode: s.setAgentExecutionMode,
      toggleViewer: s.toggleViewer,
      viewerTabs: s.viewerTabs,
    }))
  );

  const [widthPct, setWidthPct] = useState<number>(50);
  const [isDragging, setIsDragging] = useState(false);
  const [draft, setDraft] = useState("");
  const [localDocs, setLocalDocs] = useState<AttachedDoc[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStreaming = Boolean(activeTrackersBySession?.[splitSession.id]);
  const hasModel = Boolean(splitSession.modelId || activeModelId || models[0]?.id);

  const slashCommands = [
    {
      name: "clear",
      syntax: "/clear",
      description: "Clear messages in this split chat",
      execute: () => {
        clearChatMessages(splitSession.id);
        toast.info("Split chat cleared");
      },
    },
    {
      name: "plan",
      syntax: "/plan",
      description: "Switch to Plan mode (write PLAN.md first)",
      execute: () => {
        setAgentExecutionMode("plan");
        toast.info("Switched to Plan mode");
      },
    },
    {
      name: "fast",
      syntax: "/fast",
      description: "Switch to Fast mode (direct execution)",
      execute: () => {
        setAgentExecutionMode("fast");
        toast.info("Switched to Fast mode");
      },
    },
    {
      name: "terminal",
      syntax: "/terminal",
      description: "Toggle interactive terminal in this pane",
      execute: () => setIsTerminalOpen((v) => !v),
    },
    {
      name: "doomscroll",
      aliases: ["doomscrolling", "feed", "instagram"],
      syntax: "/doomscroll",
      description: "Toggle Doomscrolling (Instagram) pane",
      execute: (mode?: string) => {
        window.dispatchEvent(
          new CustomEvent("sanctum:toggle-feed-pane", {
            detail: { mode: mode === "open" ? "open" : "toggle" },
          })
        );
      },
    },
    {
      name: "swap",
      syntax: "/swap",
      description: "Swap left and right chat panes",
      execute: () => onSwap(),
    },
  ];

  const matchingSlash =
    slashQuery !== null
      ? slashCommands.filter((c) => {
          const q = slashQuery.toLowerCase();
          if (!q) return true;
          return (
            c.name.includes(q) ||
            c.syntax.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            ("aliases" in c && Array.isArray(c.aliases) && c.aliases.some((a) => a.includes(q)))
          );
        })
      : [];

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionCandidates([]);
      return;
    }
    let active = true;
    fetch("/api/fs/tree?path=.&depth=2")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.entries) return;
        const flat: string[] = [];
        const walk = (items: any[]) => {
          for (const it of items) {
            if (it.type === "file" && it.path) flat.push(String(it.path));
            if (Array.isArray(it.children)) walk(it.children);
          }
        };
        walk(data.entries);
        const q = mentionQuery.toLowerCase();
        setMentionCandidates(flat.filter((p) => p.toLowerCase().includes(q)).slice(0, 8));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mentionQuery]);

  // Close right-click panel context menu
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  // Smooth drag-to-resize handler
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const parent = asideRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rightPx = rect.right - e.clientX;
      const pct = Math.min(70, Math.max(26, (rightPx / rect.width) * 100));
      setWidthPct(pct);
    };
    const onUp = () => setIsDragging(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [splitSession.messages.length, splitSession.messages[splitSession.messages.length - 1]?.content]);

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File exceeds 10 MB limit.`);
        continue;
      }
      try {
        const text = await extractAttachmentText(file);
        setLocalDocs((prev) => [
          ...prev.filter((d) => d.name !== file.name),
          { name: file.name, size: file.size, content: text },
        ]);
        toast.success(`Attached ${file.name}`);
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || "Could not read file."}`);
      }
    }
  };

  const attachWorkspaceFile = async (relPath: string) => {
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.content === "string") {
        setLocalDocs((prev) => [
          ...prev.filter((d) => d.name !== relPath),
          { name: relPath, size: data.content.length, content: data.content },
        ]);
      }
    } catch {}
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    const slashMatch = val.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setSelectedSlashIdx(0);
    } else {
      setSlashQuery(null);
    }
    const mMatch = val.match(/@([a-zA-Z0-9_./\\-]{1,60})$/);
    setMentionQuery(mMatch ? mMatch[1] : null);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text && localDocs.length === 0) return;

    // /doomscroll works anytime — standalone, inline with a message, or while streaming
    const doomscrollRegex = /(?:^|\s)\/(?:doomscroll|doomscrolling)(?=\s|$)/i;
    if (doomscrollRegex.test(text)) {
      const remaining = text.replace(/(?:^|\s)\/(?:doomscroll|doomscrolling)(?=\s|$)/gi, " ").trim();
      window.dispatchEvent(
        new CustomEvent("sanctum:toggle-feed-pane", {
          detail: { mode: remaining ? "open" : "toggle" },
        })
      );
      if (!remaining && localDocs.length === 0) {
        setDraft("");
        setSlashQuery(null);
        return;
      }
      if (isStreaming || !hasModel) {
        setDraft(remaining);
        setSlashQuery(null);
        return;
      }
      const docsToSend = [...localDocs];
      setDraft("");
      setLocalDocs([]);
      setSlashQuery(null);
      setMentionQuery(null);
      void sendMessage(remaining || "Please analyze the attached document.", splitSession.id, docsToSend);
      return;
    }

    if (isStreaming || !hasModel) return;
    const docsToSend = [...localDocs];
    setDraft("");
    setLocalDocs([]);
    setSlashQuery(null);
    setMentionQuery(null);
    void sendMessage(text || "Please analyze the attached document.", splitSession.id, docsToSend);
  };

  return (
    <aside
      ref={asideRef}
      style={{ width: `${widthPct}%` }}
      onContextMenu={(e) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT") return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "relative hidden md:flex flex-col min-w-[300px] max-w-[70%] h-full overflow-hidden shrink-0 border-l border-border/50",
        hasWallpaper ? "bg-transparent" : "bg-background"
      )}
    >
      {/* Draggable Left Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize split chat pane"
        title="Drag to resize panes"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-30 cursor-col-resize transition-colors",
          isDragging ? "bg-primary/60" : "hover:bg-primary/40"
        )}
      />

      {/* Clean Minimal Top Bar with Terminal, Viewer, and Close */}
      <div
        onMouseDown={handleTitleBarMouseDown}
        onDoubleClick={handleTitleBarDoubleClick}
        onContextMenu={(e) => {
          handleTitleBarContextMenu(e);
        }}
        className={cn(
          "flex items-center justify-end gap-1 px-3 sm:px-5 h-11 shrink-0",
          !isViewerOpen && "pr-32 sm:pr-36"
        )}
      >
        <div className="flex items-center gap-1" data-no-drag>
          <button
            type="button"
            onClick={() => setIsTerminalOpen((v) => !v)}
            aria-label="Toggle split terminal"
            title="Toggle Interactive Terminal"
            className={cn(
              "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
              isTerminalOpen && "bg-primary/15 text-primary"
            )}
          >
            <TerminalIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleViewer}
            aria-label="Toggle workspace viewer panel"
            title="Toggle Artifact & Workspace Viewer (Ctrl+\\)"
            className={cn(
              "flex items-center gap-1 p-1.5 rounded-lg transition-colors",
              isViewerOpen
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {isViewerOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
            {viewerTabs.length > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-mono text-primary">
                {viewerTabs.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close split pane"
            title="Close split view (Right-click panel for Swap)"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {splitSession.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Start a conversation below. Right-click anywhere to swap panes.
          </div>
        ) : (
          splitSession.messages.map((m) => <SplitMessageItem key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Identical Full-Parity Composer Box */}
      <div className="px-4 pb-5 pt-2 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleAttachFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="relative rounded-[20px] border border-border/80 bg-card/90 backdrop-blur-md focus-within:border-primary/45 transition-all shadow-xl">
          {/* Slash Command Popover */}
          {slashQuery !== null && matchingSlash.length > 0 && (
            <div className="absolute bottom-full left-3 mb-2 z-40 w-72 rounded-xl border border-border bg-popover p-1 shadow-2xl">
              {matchingSlash.map((cmd, idx) => (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => {
                    const remaining = draft.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, "").trim();
                    cmd.execute(cmd.name === "doomscroll" && remaining ? "open" : undefined);
                    setDraft(remaining ? `${remaining} ` : "");
                    setSlashQuery(null);
                  }}
                  onMouseEnter={() => setSelectedSlashIdx(idx)}
                  className={cn(
                    "flex flex-col w-full rounded-lg px-2.5 py-1.5 text-left transition-colors",
                    idx === selectedSlashIdx ? "bg-primary/15 text-foreground" : "hover:bg-muted/60 text-muted-foreground"
                  )}
                >
                  <span className="font-mono text-xs font-medium text-foreground">{cmd.syntax}</span>
                  <span className="text-[11px] text-muted-foreground">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* @file Mention Popover */}
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-3 mb-2 z-40 w-72 rounded-xl border border-border bg-popover p-1 shadow-2xl">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace Files (@{mentionQuery})
              </div>
              {mentionCandidates.map((cand) => (
                <button
                  key={cand}
                  type="button"
                  onClick={() => {
                    setDraft((prev) => prev.replace(/@([a-zA-Z0-9_./\\-]{1,60})$/, `@${cand} `));
                    void attachWorkspaceFile(cand);
                    setMentionQuery(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-mono text-foreground hover:bg-muted/70"
                >
                  <FileText className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">{cand}</span>
                </button>
              ))}
            </div>
          )}

          <ComposerWorkspacePicker />

          {localDocs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3.5 pt-2.5 pb-1 border-b border-border/50">
              {localDocs.map((doc) => (
                <div
                  key={doc.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted/40 text-xs"
                >
                  <FileText className="size-3 text-primary" />
                  <span className="max-w-[140px] truncate">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setLocalDocs((prev) => prev.filter((d) => d.name !== doc.name))}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            rows={2}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (slashQuery !== null && matchingSlash.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedSlashIdx((i) => (i + 1) % matchingSlash.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedSlashIdx((i) => (i - 1 + matchingSlash.length) % matchingSlash.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const chosen = matchingSlash[selectedSlashIdx] || matchingSlash[0];
                  const remaining = draft.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, "").trim();
                  chosen?.execute(chosen.name === "doomscroll" && remaining ? "open" : undefined);
                  setDraft(remaining ? `${remaining} ` : "");
                  setSlashQuery(null);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSlashQuery(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={hasModel ? "Ask me anything..." : "Waiting for a local model…"}
            disabled={!hasModel}
            className="block w-full min-h-[54px] max-h-36 resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/65 disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                title="Attach PDF, DOCX, text, or code"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              >
                <Plus className="size-4" />
              </button>

              <JanModelHeaderPill
                onToggleDetails={onToggleDetails}
                detailsOpen={detailsOpen}
                placement="top"
                sessionId={splitSession.id}
              />

              <WorkspaceTools />
              <McpQuickToggle onOpenMcpSettings={onOpenMcpSettings} />

              {(documents.length > 0 || localDocs.length > 0) && (
                <button
                  type="button"
                  onClick={() => setEnableRagInChat(!enableRagInChat)}
                  aria-pressed={enableRagInChat}
                  title="Ground responses in indexed documents"
                  className={cn(
                    "flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border transition-colors",
                    enableRagInChat
                      ? "border-primary/50 bg-primary/15 text-foreground font-medium"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="size-3" />
                  <span>Docs ({documents.length + localDocs.length})</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={isStreaming ? () => stopInference(splitSession.id) : handleSend}
              disabled={!isStreaming && ((!draft.trim() && localDocs.length === 0) || !hasModel)}
              aria-label={isStreaming ? "Stop generation" : "Send message"}
              className={cn(
                "flex items-center justify-center size-7 rounded-full transition-colors shadow-sm",
                isStreaming
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              )}
            >
              {isStreaming ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <InteractiveTerminal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />

      {/* Right-Click Panel Context Menu (Swap / Close Split) */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-50 w-44 rounded-xl border border-border bg-popover p-1 shadow-2xl text-xs"
        >
          <button
            type="button"
            onClick={() => {
              onSwap();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-muted/70 transition-colors"
          >
            <ArrowLeftRight className="size-3.5 text-muted-foreground" />
            <span>Swap Panes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          >
            <X className="size-3.5" />
            <span>Close Split View</span>
          </button>
        </div>
      )}
    </aside>
  );
};
