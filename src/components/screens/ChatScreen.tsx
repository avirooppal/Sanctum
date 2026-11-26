"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  ChevronRight,
  Mic,
  Plus,
  SlidersHorizontal,
  X,
  FileText,
  Square,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Bookmark,
  Globe,
  Settings,
  Gauge,
  ThumbsUp,
  ThumbsDown,
  PanelRightOpen,
  PanelRightClose,
  Zap,
  FileCheck2,
  Code2,
  PackageCheck,
  HelpCircle,
} from "lucide-react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DownloadPopover } from "@/components/jan/DownloadPopover";
import { JanModelHeaderPill } from "@/components/jan/JanModelHeaderPill";
import { McpQuickToggle } from "@/components/jan/McpQuickToggle";
import { handleTitleBarMouseDown, handleTitleBarDoubleClick, handleTitleBarContextMenu } from "@/components/jan/WindowControls";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { splitThinking, PromptTemplates } from "@core/ai/index.ts";
import { RequestStatusLine } from "@/components/chat/RequestStatusLine";
import { determineDocumentType } from "@core/domain/documents.ts";
import { toast } from "sonner";
import { loadAppearanceConfig, type AppearanceConfig } from "@/lib/appearance";
import { WorkspaceTools, WorkspacePendingPlanBanner } from "@/components/chat/WorkspaceTools";
import { extractAttachmentText } from "@/lib/attachments";
import { AccessScopeBadge } from "@/components/access/AccessScopeBadge";
import { InteractiveTerminal } from "@/components/terminal/InteractiveTerminal";
import { Terminal as TerminalIcon } from "lucide-react";
import { fetchWithApproval } from "@/lib/hostBridge";
import { ToolApprovalModal } from "@/components/chat/ToolApprovalModal";
import { ArtifactViewerPanel } from "@/components/viewer/ArtifactViewerPanel";
import { WorkspaceHeaderActions } from "@/components/viewer/WorkspaceHeaderActions";
import { TurnChangesSummaryCard, DiffReviewModal } from "@/components/viewer/DiffReviewModal";
import { detectCandidateFilePaths } from "@core/infra/security/content_sanitizer.ts";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ComposerWorkspacePicker } from "@/components/chat/ComposerWorkspacePicker";
import { SplitChatPane } from "@/components/chat/SplitChatPane";
import { normalizeChecklistItems } from "@core/ai/tools/agent_workflows.ts";

interface ChatScreenProps {
  onNavigate?: (module: "chat" | "hub" | "settings") => void;
  onOpenMcpSettings?: () => void;
}

const MessageRow: React.FC<{
  msg: ChatMessage;
  modelName?: string;
  onStop?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onBookmark?: () => void;
  onOpenFile?: (path: string) => void;
  onOpenDiffReview?: (checkpointId?: string) => void;
}> = React.memo(({ msg, modelName, onStop, onRetry, onDelete, onBookmark, onOpenFile, onOpenDiffReview }) => {
  const [showThinking, setShowThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [verifiedPaths, setVerifiedPaths] = useState<string[]>([]);
  const bookmarked = Boolean(msg.bookmarked);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Select the message text and copy it manually.");
    }
  };

  const { thinking, answer } = splitThinking(msg.content);

  // Detect and verify mentioned file paths against workspace scope before linking
  useEffect(() => {
    if (msg.role !== "assistant" || !answer) return;
    const candidates = detectCandidateFilePaths(answer);
    if (candidates.length === 0) {
      setVerifiedPaths([]);
      return;
    }
    let active = true;
    Promise.all(
      candidates.slice(0, 8).map(async (p) => {
        try {
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(p)}&maxBytes=1024`);
          if (!res.ok) return null;
          const body = await res.json();
          return body?.exists ? String(body.path || p) : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (active) {
        setVerifiedPaths(results.filter((r): r is string => Boolean(r)));
      }
    });
    return () => {
      active = false;
    };
  }, [msg.role, answer]);

  if (msg.role === "user") {
    return (
      <div id={`msg-${msg.id}`} className="flex flex-col items-end gap-1 group">
        <div className="max-w-[78%] rounded-[20px] rounded-br-md bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)]">
          {msg.content}
          {msg.image && <img src={msg.image.src} alt={msg.image.name} className="mt-2 max-h-52 rounded-xl" />}
          {msg.attachments?.map((doc) => (
            <div key={doc.name} className="mt-2 text-xs opacity-85">
              📎 {doc.name}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
            title="Copy message"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-card/60 transition-colors"
              title="Delete message"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const mutatingActivities = (msg.toolActivities || []).filter(
    (a) =>
      a.status === "success" &&
      ["create_file", "edit_file", "apply_patch", "move_path", "delete_path"].includes(a.name)
  );

  let latestCheckpointId: string | undefined;
  for (const act of mutatingActivities) {
    if (act.output) {
      try {
        const parsed = JSON.parse(act.output);
        if (parsed?.checkpointId) latestCheckpointId = String(parsed.checkpointId);
      } catch {}
    }
  }

  return (
    <div id={`msg-${msg.id}`} className="flex gap-3 group">
      <div className="min-w-0 flex-1 space-y-2.5 rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-xl px-4 py-3.5 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {/* Assistant header: Model name + Timestamp */}
        <div className="flex items-center gap-2 text-xs">
          <span className="size-1.5 rounded-full bg-primary/85 shrink-0" />
          <span className="font-semibold tracking-tight text-foreground">{modelName || "Local Model"}</span>
          {msg.timestamp && (
            <span className="text-[11px] text-muted-foreground/70">{msg.timestamp}</span>
          )}
        </div>

        {/* Collapsible Tool-Step Rows ("Ran <name> finished >") */}
        {msg.toolActivities?.map((activity) => {
          const targetLabel = String(
            activity.arguments?.path ||
              activity.arguments?.command ||
              activity.arguments?.query ||
              ""
          );
          const statusLabel =
            activity.status === "success"
              ? "finished"
              : activity.status === "running"
              ? "running…"
              : activity.status;
          const filePathArg =
            typeof activity.arguments?.path === "string" &&
            activity.arguments.path !== "."
              ? String(activity.arguments.path)
              : null;

          return (
            <details
              key={activity.id}
              className="group/tool rounded-xl border border-white/[0.08] bg-background/45 backdrop-blur-md px-3 py-2 text-xs transition-colors hover:border-white/[0.14]"
            >
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-muted-foreground hover:text-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      activity.status === "error"
                        ? "bg-destructive"
                        : activity.status === "running"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-emerald-400"
                    )}
                  />
                  <span className="font-medium text-foreground/90">
                    Ran {String(activity.arguments.action || activity.name)}
                  </span>
                  {targetLabel && (
                    <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[260px]">
                      {targetLabel}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[11px]",
                      activity.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground/80"
                    )}
                  >
                    {statusLabel}
                  </span>
                  <ChevronRight className="size-3.5 transition-transform group-open/tool:rotate-90 shrink-0 opacity-70" />
                </div>

                {filePathArg && onOpenFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenFile(filePathArg);
                    }}
                    className="px-2 py-0.5 rounded-lg border border-white/[0.08] bg-muted/60 hover:bg-accent text-[10px] font-mono text-foreground shrink-0 transition-colors"
                  >
                    Open {filePathArg.split("/").pop()}
                  </button>
                )}
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(activity.arguments, null, 2)}
                {activity.output ? `\n\n${activity.output}` : ""}
              </pre>
            </details>
          );
        })}

        {thinking && (
          <div>
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={cn("size-3.5 transition-transform", showThinking && "rotate-90")}
              />
              {answer ? "Show reasoning" : "Thinking…"}
            </button>
            {showThinking && (
              <div className="mt-2 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {thinking}
              </div>
            )}
          </div>
        )}

        {/* Live Task Checklist Card (from latest set_checklist tool call) */}
        {(() => {
          const latestChecklist = [...(msg.toolActivities || [])]
            .reverse()
            .find((a) => a.name === "set_checklist");
          if (!latestChecklist) return null;
          let items = normalizeChecklistItems(latestChecklist.arguments?.items);
          if (items.length === 0 && latestChecklist.output) {
            try {
              const parsed = JSON.parse(latestChecklist.output);
              items = normalizeChecklistItems(parsed?.items);
            } catch {}
          }
          if (items.length === 0) return null;
          const doneCount = items.filter((it) => it.status === "done").length;
          return (
            <div className="mb-2.5 rounded-xl border border-border/70 bg-card/80 px-3.5 py-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-foreground/90">
                <span>Task Checklist</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {doneCount}/{items.length} done
                </span>
              </div>
              <ul className="space-y-1">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        "font-mono shrink-0",
                        it.status === "done"
                          ? "text-emerald-400"
                          : it.status === "in_progress"
                          ? "text-amber-400"
                          : it.status === "failed"
                          ? "text-rose-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {it.status === "done"
                        ? "[✓]"
                        : it.status === "in_progress"
                        ? "[•]"
                        : it.status === "failed"
                        ? "[×]"
                        : "[ ]"}
                    </span>
                    <span
                      className={cn(
                        it.status === "done"
                          ? "line-through text-muted-foreground"
                          : "text-foreground/90"
                      )}
                    >
                      {it.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {answer ? (
          <MarkdownRenderer content={answer} />
        ) : (
          !thinking && !msg.requestStatus && <div className="text-sm text-muted-foreground animate-pulse">…</div>
        )}

        {/* Clickable Verified Workspace File Pills */}
        {verifiedPaths.length > 0 && onOpenFile && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {verifiedPaths.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onOpenFile(p)}
                className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 hover:bg-accent px-2.5 py-1 text-xs font-mono text-foreground transition-colors"
              >
                <FileText className="size-3 text-sky-400 shrink-0" />
                <span>{p}</span>
              </button>
            ))}
          </div>
        )}

        {/* "N files changed +X -Y [Review]" Summary Card */}
        {mutatingActivities.length > 0 && onOpenDiffReview && (
          <div className="pt-1">
            <TurnChangesSummaryCard
              checkpointId={latestCheckpointId}
              changedFilesCount={mutatingActivities.length}
              onOpenReview={(cpId) => onOpenDiffReview(cpId || "latest")}
            />
          </div>
        )}

        {/* Live Request Status Indicator */}
        {msg.requestStatus && (
          <div className="pt-1 pb-0.5">
            <RequestStatusLine
              status={msg.requestStatus}
              onStop={onStop}
              onRetry={onRetry}
            />
          </div>
        )}

        {/* Message Action Bar: Timestamp + Copy + Thumbs + Bookmark + Telemetry */}
        {(!msg.requestStatus || ["done", "stopped", "error", "cancelled"].includes(msg.requestStatus.phase)) && (answer || thinking) && (
          <div className="flex items-center justify-between gap-2 pt-1 text-muted-foreground">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors"
                title="Copy response"
                aria-label="Copy response"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
                aria-label="Helpful response"
                aria-pressed={feedback === "up"}
                className={cn(
                  "p-1 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors",
                  feedback === "up" && "text-emerald-400"
                )}
              >
                <ThumbsUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
                aria-label="Unhelpful response"
                aria-pressed={feedback === "down"}
                className={cn(
                  "p-1 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors",
                  feedback === "down" && "text-rose-400"
                )}
              >
                <ThumbsDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onBookmark?.();
                  toast.success(bookmarked ? "Removed bookmark" : "Response bookmarked");
                }}
                className={cn(
                  "p-1 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors",
                  bookmarked && "text-primary"
                )}
                title="Bookmark response"
                aria-label="Bookmark response"
                aria-pressed={bookmarked}
              >
                <Bookmark className="size-3.5" />
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 rounded-md hover:bg-destructive/15 hover:text-destructive transition-colors"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="p-1 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors"
                  title="Regenerate response"
                  aria-label="Regenerate response"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}

              {msg.metrics && msg.metrics.totalTokens > 0 && (
                <div className="ml-2 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/75">
                  <Gauge className="size-3" />
                  <span>
                    {msg.metrics.tps} tokens/sec ({msg.metrics.totalTokens} tokens)
                  </span>
                </div>
              )}
            </div>

            {msg.timestamp && (
              <span className="text-[11px] text-muted-foreground/60">{msg.timestamp}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
MessageRow.displayName = "MessageRow";

export const ChatScreen: React.FC<ChatScreenProps> = ({ onNavigate, onOpenMcpSettings }) => {
  const {
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    splitSessionId,
    setSplitSessionId,
    models,
    activeModelId,
    setActiveModelId,
    sendMessage,
    stopInference,
    regenerateLastMessage,
    deleteChatMessage,
    toggleMessageBookmark,
    activeTracker,
    activeTrackersBySession,
    updateSessionParams,
    enableRagInChat,
    setEnableRagInChat,
    documents,
    activeCollectionId,
    uploadDocument,
    attachedImage,
    setAttachedImage,
    attachedDocuments,
    addAttachedDocument,
    removeAttachedDocument,
    isExplorerCollapsed,
    toggleExplorer,
    isViewerOpen,
    toggleViewer,
    viewerTabs,
    openFileTab,
    setActiveDiffCheckpointId,
    createNewChatSession,
    duplicateChatSession,
    agentExecutionMode,
    setAgentExecutionMode,
    userName,
  } = useAppStore(
    useShallow((s) => ({
      chatSessions: s.chatSessions,
      activeSessionId: s.activeSessionId,
      setActiveSessionId: s.setActiveSessionId,
      splitSessionId: s.splitSessionId,
      setSplitSessionId: s.setSplitSessionId,
      models: s.models,
      activeModelId: s.activeModelId,
      setActiveModelId: s.setActiveModelId,
      sendMessage: s.sendMessage,
      stopInference: s.stopInference,
      regenerateLastMessage: s.regenerateLastMessage,
      deleteChatMessage: s.deleteChatMessage,
      toggleMessageBookmark: s.toggleMessageBookmark,
      activeTracker: s.activeTracker,
      activeTrackersBySession: s.activeTrackersBySession,
      updateSessionParams: s.updateSessionParams,
      enableRagInChat: s.enableRagInChat,
      setEnableRagInChat: s.setEnableRagInChat,
      documents: s.documents,
      activeCollectionId: s.activeCollectionId,
      uploadDocument: s.uploadDocument,
      attachedImage: s.attachedImage,
      setAttachedImage: s.setAttachedImage,
      attachedDocuments: s.attachedDocuments,
      addAttachedDocument: s.addAttachedDocument,
      removeAttachedDocument: s.removeAttachedDocument,
      isExplorerCollapsed: s.isExplorerCollapsed,
      toggleExplorer: s.toggleExplorer,
      isViewerOpen: s.isViewerOpen,
      toggleViewer: s.toggleViewer,
      viewerTabs: s.viewerTabs,
      openFileTab: s.openFileTab,
      setActiveDiffCheckpointId: s.setActiveDiffCheckpointId,
      createNewChatSession: s.createNewChatSession,
      duplicateChatSession: s.duplicateChatSession,
      agentExecutionMode: s.agentExecutionMode,
      setAgentExecutionMode: s.setAgentExecutionMode,
      userName: s.userName,
    }))
  );

  const [prompt, setPrompt] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(80);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const splitSession = splitSessionId
    ? chatSessions.find((s) => s.id === splitSessionId) || null
    : null;
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [appearanceCfg, setAppearanceCfg] = useState<AppearanceConfig>(() => loadAppearanceConfig());

  useEffect(() => {
    const sync = (cfg?: AppearanceConfig) => setAppearanceCfg(cfg || loadAppearanceConfig());
    sync();
    const handler = (e: Event) => sync((e as CustomEvent<AppearanceConfig>).detail);
    window.addEventListener("sanctum-appearance-updated", handler);
    return () => window.removeEventListener("sanctum-appearance-updated", handler);
  }, []);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const session = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];
  const model = models.find((m) => m.id === (activeModelId || session?.modelId)) || models[0];
  const messages = session?.messages ?? [];
  const isStreaming = Boolean(activeTrackersBySession?.[activeSessionId]);

  // Estimate context window usage %
  const totalSessionChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + prompt.length;
  const estTokens = Math.max(1, Math.round(totalSessionChars / 4));
  const maxContext = model?.config?.contextSize || 8192;
  const contextPercent = Math.min(100, Math.max(1, Math.round((estTokens / maxContext) * 100)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow composer (Jan-style generous comfortable height)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 220)}px`;
  }, [prompt]);

  useEffect(() => {
    const desktop = (window as any).chrome?.webview;
    if (!desktop) return;
    const handleSpeech = (event: any) => {
      const data =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;
      if (!data?.type) return;
      if (data.type === "speechStarted") {
        setIsRecording(true);
        setRecordingSeconds(0);
        setWhisperStatus("Listening offline… Speak now, then click the microphone to finish.");
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
      } else if (data.type === "speechInterim") {
        if (data.text) {
          setWhisperStatus(`Hearing: "${data.text}"`);
        }
      } else if (data.type === "speechResult") {
        if (data.text && String(data.text).trim()) {
          const text = String(data.text).trim();
          setPrompt((value) => (value ? `${value} ${text}` : text));
          setWhisperStatus(`Transcript added: "${text}"`);
        }
      } else if (data.type === "speechError" || data.type === "speechStopped") {
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setWhisperStatus(data.type === "speechError" ? data.text : null);
      }
    };
    desktop.addEventListener("message", handleSpeech);
    return () => {
      desktop.removeEventListener("message", handleSpeech);
      desktop.postMessage(JSON.stringify({ type: "speechStop" }));
    };
  }, []);

  // Cleanup audio recorder on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const SLASH_COMMANDS = [
    {
      name: "plan",
      aliases: ["planning"],
      syntax: "/plan",
      description: "Switch to Plan Mode (writes PLAN.md before changes)",
      requiresArg: false,
      execute: () => {
        setAgentExecutionMode("plan");
        toast.success("Plan Mode active.");
      },
    },
    {
      name: "fast",
      aliases: ["direct"],
      syntax: "/fast",
      description: "Switch to Fast Mode (direct execution)",
      requiresArg: false,
      execute: () => {
        setAgentExecutionMode("fast");
        toast.success("Fast Mode active.");
      },
    },
    {
      name: "browser",
      aliases: ["browse", "web"],
      syntax: "/browser <goal or url>",
      description: "Run autonomous web browser agent",
      requiresArg: true,
      execute: (arg?: string) => {
        if (!arg) {
          setPrompt("/browser ");
          textareaRef.current?.focus();
          return;
        }
        sendMessage(`Please use the browser_task tool to browse and complete this task: "${arg}"`);
      },
    },
    {
      name: "terminal",
      aliases: ["term", "cmd"],
      syntax: "/terminal",
      description: "Toggle integrated terminal",
      requiresArg: false,
      execute: () => {
        setIsTerminalOpen((v) => !v);
      },
    },
    {
      name: "doomscroll",
      aliases: ["doomscrolling", "feed", "instagram"],
      syntax: "/doomscroll",
      description: "Toggle Doomscrolling (Instagram) pane",
      requiresArg: false,
      execute: (mode?: string) => {
        window.dispatchEvent(
          new CustomEvent("sanctum:toggle-feed-pane", {
            detail: { mode: mode === "open" ? "open" : "toggle" },
          })
        );
      },
    },
    {
      name: "clear",
      aliases: ["new", "reset"],
      syntax: "/clear",
      description: "Start a fresh chat",
      requiresArg: false,
      execute: () => {
        createNewChatSession();
      },
    },
  ];

  const matchingSlashCommands = SLASH_COMMANDS.filter((cmd) => {
    if (slashQuery === null) return false;
    if (!slashQuery) return true;
    return (
      cmd.name.toLowerCase().includes(slashQuery) ||
      cmd.syntax.toLowerCase().includes(slashQuery) ||
      cmd.description.toLowerCase().includes(slashQuery) ||
      cmd.aliases?.some((a) => a.toLowerCase().includes(slashQuery))
    );
  });

  const send = () => {
    const trimmed = prompt.trim();
    if (!trimmed && !attachedImage && attachedDocuments.length === 0) return;

    // /doomscroll works anytime — standalone, inline with a message, or while a chat is streaming
    const doomscrollRegex = /(?:^|\s)\/(?:doomscroll|doomscrolling)(?=\s|$)/i;
    if (doomscrollRegex.test(trimmed)) {
      const remaining = trimmed.replace(/(?:^|\s)\/(?:doomscroll|doomscrolling)(?=\s|$)/gi, " ").trim();
      window.dispatchEvent(
        new CustomEvent("sanctum:toggle-feed-pane", {
          detail: { mode: remaining ? "open" : "toggle" },
        })
      );
      if (!remaining && !attachedImage && attachedDocuments.length === 0) {
        setPrompt("");
        setSlashQuery(null);
        return;
      }
      if (isStreaming || !model) {
        setPrompt(remaining);
        setSlashQuery(null);
        return;
      }
      const messageText = remaining || (attachedImage ? PromptTemplates.ANALYZE_IMAGE : PromptTemplates.ANALYZE_DOCUMENT);
      sendMessage(messageText);
      setPrompt("");
      setSlashQuery(null);
      return;
    }

    if (!model || isStreaming) return;

    // Check direct slash command execution:
    if (trimmed.startsWith("/")) {
      const match = trimmed.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
      if (match) {
        const cmdName = match[1].toLowerCase();
        const cmdArg = (match[2] || "").trim();

        if (cmdName === "browser" || cmdName === "browse" || cmdName === "web") {
          if (!cmdArg) {
            toast.info("Please provide a URL or goal, e.g. /browser extract pricing from https://example.com");
            return;
          }
          const promptMessage = `Please use the browser_task tool to browse and complete this task: "${cmdArg}"`;
          sendMessage(promptMessage);
          setPrompt("");
          return;
        }

        const found = SLASH_COMMANDS.find(
          (c) => c.name.toLowerCase() === cmdName || c.aliases?.includes(cmdName)
        );
        if (found) {
          void found.execute(cmdArg);
          setPrompt("");
          return;
        }
      }
    }

    const messageText = trimmed || (attachedImage ? PromptTemplates.ANALYZE_IMAGE : PromptTemplates.ANALYZE_DOCUMENT);
    sendMessage(messageText);
    setPrompt("");
  };

  // --- FILE UPLOAD HANDLING ---
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: maximum attachment size is 10 MB.`);
        continue;
      }
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setAttachedImage({
            src: result,
            name: file.name,
            width: 0,
            height: 0,
          });
        };
        reader.readAsDataURL(file);
      } else {
        try {
          const text = await extractAttachmentText(file);
          if (!text.trim() || text.includes("\0")) {
            toast.error(`${file.name}: file is empty or contains binary data.`);
            continue;
          }
          const docType = determineDocumentType(file.name);

          uploadDocument(activeCollectionId || "col-default", {
            name: file.name,
            size: file.size,
            type: docType,
            rawContent: text,
          });

          addAttachedDocument({
            name: file.name,
            size: file.size,
            content: text,
          });

          setEnableRagInChat(true);
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "Could not read file. Please retry."}`);
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- NEURAL STT & MICROPHONE RECORDING ---
  const startRecording = async () => {
    setWhisperStatus(null);
    const savedSttMode =
      typeof window !== "undefined" ? localStorage.getItem("sanctum.sttMode") || "recommended" : "recommended";
    const desktop = (window as any).chrome?.webview;

    // 1. Check if local neural HTTP STT server (Qwen3-ASR / Nemotron / WhisperX) is online
    let httpServerOnline = false;
    let activeSttModel = "qwen3-asr-0.6b";
    try {
      const probe = await fetch("/api/audio/whisperx", { signal: AbortSignal.timeout(1200) });
      if (probe.ok) {
        const info = await probe.json();
        httpServerOnline = Boolean(info?.httpServerOnline);
        if (info?.model) activeSttModel = String(info.model);
      }
    } catch {}

    // 2. Priority 1: Use local neural HTTP STT server or Custom STT endpoint via MediaRecorder
    if (httpServerOnline || savedSttMode === "custom") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
          stream.getTracks().forEach((track) => track.stop());
          await processAudioWithWhisperX(audioBlob);
        };

        mediaRecorder.start(250);
        setIsRecording(true);
        setRecordingSeconds(0);
        setWhisperStatus(`Recording for ${activeSttModel}… Click mic again to transcribe.`);
        timerRef.current = setInterval(() => setRecordingSeconds((prev) => prev + 1), 1000);
        return;
      } catch {
        // Fall through to local offline Windows Speech (no cloud browser speech fallback)
      }
    }

    // 3. Local Offline Windows Speech fallback (strictly local-only; browser cloud SpeechRecognition removed)
    if (desktop) {
      setWhisperStatus("Offline Windows Speech active (start local Qwen3-ASR server on :8000 for neural offline accuracy).");
      desktop.postMessage(JSON.stringify({ type: "speechStart" }));
      return;
    }

    setWhisperStatus("Local Speech Recognition not available in this environment.");
  };

  const stopRecording = () => {
    (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: "speechStop" }));
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processAudioWithWhisperX = async (blob: Blob) => {
    setIsTranscribing(true);
    setWhisperStatus("Transcribing via WhisperX...");

    try {
      const formData = new FormData();
      formData.append("file", blob, "voice_input.webm");

      const res = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.text === "string" && data.text.trim()) {
          setPrompt((prev) => (prev ? `${prev} ${data.text}` : data.text));
          setWhisperStatus("Transcript added.");
        } else if (data.delegatedToNativeSpeech) {
          setIsRecording(true);
          setWhisperStatus(data.message || "Listening via Windows Offline Speech…");
        } else {
          setWhisperStatus(data.error || data.message || "No speech detected. Please try again.");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setWhisperStatus(err.error || "Transcription failed. Test or configure STT in Settings > Capabilities.");
      }
    } catch {
      setWhisperStatus("Transcription failed. Start the local speech service on port 8000, or use the Windows desktop app for offline dictation.");
    } finally {
      setIsTranscribing(false);

    }
  };

  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Attach workspace file by relative path (via drag-from-tree or @file mention)
  const attachWorkspaceFile = async (relPath: string) => {
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(relPath)}&maxBytes=524288`);
      const data = await res.json();
      if (!res.ok || data.binary || typeof data.content !== "string") {
        toast.error(data.error || `${relPath}: cannot attach binary file as text.`);
        return;
      }
      const name = relPath.split("/").pop() || relPath;
      addAttachedDocument({
        name: relPath,
        size: data.size || data.content.length,
        content: data.content,
      });
      uploadDocument(activeCollectionId || "col-default", {
        name,
        size: data.size || data.content.length,
        type: determineDocumentType(name),
        rawContent: data.content,
      });
      setEnableRagInChat(true);
    } catch {
      toast.error(`Could not attach ${relPath}`);
    }
  };

  // Detect slash command or @file mention in prompt
  useEffect(() => {
    const slashMatch = prompt.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setSelectedSlashIndex(0);
      setMentionQuery(null);
      setMentionCandidates([]);
      return;
    } else {
      setSlashQuery(null);
    }

    const match = prompt.match(/(?:^|\s)@([a-zA-Z0-9_./\\-]{1,60})$/);
    if (!match) {
      setMentionQuery(null);
      setMentionCandidates([]);
      return;
    }
    const q = match[1].toLowerCase();
    setMentionQuery(match[1]);
    let cancelled = false;
    fetch("/api/fs/tree?path=")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.entries)) return;
        const files = data.entries
          .filter((e: any) => e.type === "file" && String(e.path).toLowerCase().includes(q))
          .slice(0, 6)
          .map((e: any) => String(e.path));
        setMentionCandidates(files);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prompt]);

  const isEmptyChat = messages.length === 0;
  const hasWallpaper = Boolean((appearanceCfg.wallpaper || "").trim());

  return (
    <main
      className={cn(
        "relative flex flex-1 min-h-0 w-full overflow-hidden",
        hasWallpaper ? "bg-transparent" : "bg-background"
      )}
    >
      <section className="relative flex flex-col flex-1 min-w-0 min-h-0">
        {/* Left-Edge Hover Reveal Zone (opens collapsed sidebar automatically on hover) */}
        {isExplorerCollapsed && (
          <div
            onMouseEnter={toggleExplorer}
            onClick={toggleExplorer}
            aria-label="Hover left edge to open sidebar"
            title="Hover or click to open sidebar (Ctrl+B)"
            className="fixed left-0 top-10 bottom-0 w-3.5 z-30 group cursor-e-resize flex items-center"
          >
            <div className="h-14 w-1 rounded-r-full bg-primary/0 group-hover:bg-primary/60 transition-all duration-200" />
          </div>
        )}

        {/* Ultra-Clean Top Drag Bar (zero distracting pills; model selector lives in composer) */}
        <div
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
          onContextMenu={handleTitleBarContextMenu}
          className={cn(
            "flex items-center justify-between gap-2 px-3 sm:px-5 h-11 shrink-0",
            !isViewerOpen && !splitSession && "pr-32 sm:pr-36"
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0" data-no-drag>
              <WorkspaceHeaderActions
                onOpenSettings={() => onNavigate?.("settings")}
                sessionTitle={session?.title}
                expanded={false}
                hideBreadcrumb
              />
            </div>

            <div className="ml-auto flex items-center gap-1 shrink-0" data-no-drag>
              <button
                type="button"
                onClick={() => setIsTerminalOpen((v) => !v)}
                aria-label="Toggle terminal"
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
            </div>
          </div>
        </div>

        {/* Thin Conversation Outline Strip for Long Threads */}
        {messages.length > 2 && (
          <div
            aria-label="Conversation outline"
            className="hidden sm:flex flex-col items-center gap-1.5 absolute left-2 top-1/2 -translate-y-1/2 z-10 py-2 px-1 rounded-full bg-card/60 border border-border/40 backdrop-blur-xs"
          >
            {messages.slice(-20).map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`msg-${m.id}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                title={`${m.role === "user" ? "You" : "Assistant"}: ${(m.content || "").slice(0, 60)}`}
                className={cn(
                  "w-1.5 rounded-full transition-all",
                  m.role === "user"
                    ? "h-1.5 bg-muted-foreground/50 hover:bg-foreground"
                    : "h-2.5 bg-primary/60 hover:bg-primary"
                )}
              />
            ))}
          </div>
        )}

        {/* Messages + Centered-to-Bottom Composer Flow (Jan full-width max-w-3xl) */}
        <div
          className={cn(
            "transition-all duration-300",
            isEmptyChat
              ? "flex-1 flex flex-col justify-end pb-3"
              : "flex-1 overflow-y-auto"
          )}
        >
          <div className={cn("mx-auto w-full max-w-3xl px-6", isEmptyChat ? "py-3" : "py-6 space-y-6")}>
            {isEmptyChat ? (
              <div className="flex flex-col items-center text-center gap-3.5">
                <img
                  src={appearanceCfg.customIcon || "/logo.jpg"}
                  alt={appearanceCfg.customBrandName || "Sanctum Logo"}
                  width={56}
                  height={56}
                  style={{ width: "56px", height: "56px", maxWidth: "56px", maxHeight: "56px" }}
                  className="size-14 w-14 h-14 rounded-2xl object-cover bg-card border border-border/80 shadow-lg"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.endsWith("/logo.jpg")) {
                      target.src = "/mascot.jpg";
                    } else if (target.src.endsWith("/mascot.jpg")) {
                      target.src = "/assets/icons/icon-128.png";
                    }
                  }}
                />
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {userName
                      ? `What would you like to explore, ${userName}?`
                      : "What would you like to explore?"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {model
                      ? `Running ${model.name} (${model.parameters} · ${model.quantization}) locally on your hardware.`
                      : "Connect or download a model to begin chatting."}
                  </p>
                </div>
              </div>
            ) : (() => {
              const filtered = messages.filter(m => !bookmarksOnly || m.bookmarked);
              const hiddenCount = Math.max(0, filtered.length - visibleLimit);
              const visibleMessages = hiddenCount > 0 ? filtered.slice(hiddenCount) : filtered;
              return (
                <>
                  {hiddenCount > 0 && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((v) => v + 80)}
                        className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Show earlier messages ({hiddenCount} hidden)
                      </button>
                    </div>
                  )}
                  {visibleMessages.map((m) => (
                    <div id={`msg-${m.id}`} key={m.id}>
                      <MessageRow
                        msg={m}
                        modelName={m.modelId || model?.name}
                        onStop={stopInference}
                        onRetry={!isStreaming && m.id === messages.at(-1)?.id ? regenerateLastMessage : undefined}
                        onDelete={!isStreaming && session ? () => deleteChatMessage(session.id, m.id) : undefined}
                        onBookmark={session ? () => toggleMessageBookmark(session.id, m.id) : undefined}
                        onOpenFile={(p) => openFileTab(p)}
                        onOpenDiffReview={(cpId) => setActiveDiffCheckpointId(cpId || "latest")}
                      />
                    </div>
                  ))}
                </>
              );
            })()}
            {bookmarksOnly && !messages.some(m => m.bookmarked) && <p className="text-sm text-muted-foreground py-6">No bookmarked responses in this chat. Save a response using its bookmark button.</p>}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer (Jan-style wide max-w-3xl tactile card; centered when empty, bottom when active) */}
        <div
          className={cn(
            "w-full px-4 sm:px-8 transition-all duration-300",
            isEmptyChat ? "flex-1 flex flex-col items-center justify-start pt-3 pb-12" : "shrink-0 pt-2",
            !isEmptyChat && (isTerminalOpen ? "pb-3" : "pb-5")
          )}
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept="image/png,image/jpeg,image/webp,.pdf,.docx,.txt,.md,.json,.csv,.py,.js,.tsx,.ts,.rs,.go,.cpp,.c,.html,.css"
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const sanctumPath = e.dataTransfer.getData("application/x-sanctum-path");
              if (sanctumPath) {
                void attachWorkspaceFile(sanctumPath);
                return;
              }
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
              }
            }}
            style={{ width: "100%", maxWidth: "768px" }}
            className={cn(
              "relative mx-auto w-full max-w-3xl rounded-[24px] border border-white/[0.10] bg-card/80 backdrop-blur-2xl shadow-[0_16px_44px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:border-primary/45 focus-within:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(234,88,12,0.18)] transition-all duration-200",
              isRecording && "border-destructive ring-1 ring-destructive/20"
            )}
          >
            {/* Docked Project / Workspace Selector Strip */}
            <ComposerWorkspacePicker />

            {/* Slash Command Autocomplete Popover (Minimal, icon-free) */}
            {slashQuery !== null && matchingSlashCommands.length > 0 && (
              <div className="absolute bottom-full left-3 mb-2 z-40 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1 shadow-2xl">
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {matchingSlashCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedSlashIndex;
                    return (
                      <button
                        key={cmd.name}
                        type="button"
                        onClick={() => {
                          if (cmd.requiresArg) {
                            setPrompt(`/${cmd.name} `);
                            setSlashQuery(null);
                            textareaRef.current?.focus();
                          } else {
                            const remaining = prompt.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, "").trim();
                            void cmd.execute(cmd.name === "doomscroll" && remaining ? "open" : undefined);
                            setPrompt(remaining ? `${remaining} ` : "");
                            setSlashQuery(null);
                            textareaRef.current?.focus();
                          }
                        }}
                        onMouseEnter={() => setSelectedSlashIndex(idx)}
                        className={cn(
                          "flex flex-col w-full rounded-lg px-2.5 py-1.5 text-left transition-colors",
                          isSelected
                            ? "bg-primary/15 text-foreground"
                            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="font-mono text-xs font-medium text-foreground">
                          {cmd.syntax}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {cmd.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* @file Mention Autocomplete Popover */}
            {mentionQuery !== null && mentionCandidates.length > 0 && (
              <div className="absolute bottom-full left-3 mb-1.5 z-30 w-72 rounded-xl border border-border/80 bg-popover p-1 shadow-xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspace Files (@{mentionQuery})
                </div>
                {mentionCandidates.map((cand) => (
                  <button
                    key={cand}
                    type="button"
                    onClick={() => {
                      setPrompt((prev) => prev.replace(/@([a-zA-Z0-9_./\\-]{1,60})$/, `@${cand} `));
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
            {/* Attached Files & Image Previews */}
            {(attachedImage || attachedDocuments.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 px-3.5 pt-3 pb-1 border-b border-border/50">
                {attachedImage && (
                  <div className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-muted/40 text-xs">
                    <img
                      src={attachedImage.src}
                      alt="Attachment preview"
                      className="size-8 rounded object-cover"
                    />
                    <span className="max-w-[120px] truncate text-foreground font-medium">
                      {attachedImage.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedImage(null)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {attachedDocuments.map((doc) => (
                  <div
                    key={doc.name}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs"
                  >
                    <FileText className="size-3.5 text-primary shrink-0" />
                    <span className="max-w-[140px] truncate text-foreground font-medium">
                      {doc.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(doc.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachedDocument(doc.name)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Live Recording Status Bar */}
            {isRecording && (
              <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 text-destructive text-xs font-medium rounded-t-xl animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-destructive animate-ping" />
                  <span>Listening…</span>
                </div>
                <span className="font-mono">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}

            {/* Transcription Status */}
            {isTranscribing && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-xs font-medium">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Transcribing audio via WhisperX...</span>
              </div>
            )}

            {whisperStatus && !isTranscribing && !isRecording && (
              <div className="px-4 py-1 text-[11px] text-muted-foreground bg-muted/20">
                {whisperStatus}
              </div>
            )}

            <WorkspacePendingPlanBanner />
            <textarea
              ref={textareaRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (slashQuery !== null && matchingSlashCommands.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedSlashIndex((prev) => (prev + 1) % matchingSlashCommands.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedSlashIndex((prev) => (prev - 1 + matchingSlashCommands.length) % matchingSlashCommands.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const chosen = matchingSlashCommands[selectedSlashIndex] || matchingSlashCommands[0];
                    if (chosen) {
                      if (chosen.requiresArg) {
                        setPrompt(`/${chosen.name} `);
                        setSlashQuery(null);
                        textareaRef.current?.focus();
                      } else {
                        const remaining = prompt.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, "").trim();
                        void chosen.execute(chosen.name === "doomscroll" && remaining ? "open" : undefined);
                        setPrompt(remaining ? `${remaining} ` : "");
                        setSlashQuery(null);
                      }
                    }
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
                  send();
                }
              }}
              placeholder={
                isRecording
                  ? "Speaking now..."
                  : model
                  ? "Ask me anything..."
                  : "Waiting for a local model…"
              }
              disabled={!model}
              className="block w-full min-h-[58px] resize-none bg-transparent px-4 pt-3.5 pb-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/55 disabled:opacity-50"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-1.5">
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {/* + Attach Button */}
                <button
                  type="button"
                  onClick={handleFileClick}
                  aria-label="Attach file"
                  title="Attach PDF, DOCX, images, text, or code"
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors"
                >
                  <Plus className="size-4" />
                </button>

                {/* Active Model Selector Pill (in chat composer, opens upward) */}
                <JanModelHeaderPill
                  onToggleDetails={() => setDetailsOpen((v) => !v)}
                  detailsOpen={detailsOpen}
                  placement="top"
                  sessionId={activeSessionId}
                />

                {/* Inline Model + Effort + Tools + Fast/Plan Pills */}
                <WorkspaceTools />

                {/* External MCP Connectors Quick-Toggle */}
                <McpQuickToggle onOpenMcpSettings={onOpenMcpSettings} />

                {/* My documents (RAG) Toggle — only shown when documents exist */}
                {(documents.length > 0 || attachedDocuments.length > 0) && (
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
                    <span>Docs ({documents.length + attachedDocuments.length})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Model & Sampling Parameters Toggle */}
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-label="Sampling parameters"
                  title="Configure temperature, system prompt, and model settings"
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    detailsOpen
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setBookmarksOnly((v) => !v)}
                  aria-label="Show bookmarked responses"
                  aria-pressed={bookmarksOnly}
                  title="Show bookmarked responses"
                  className={cn(
                    "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60",
                    bookmarksOnly && "text-primary bg-primary/15"
                  )}
                >
                  <Bookmark className="size-3.5" />
                </button>

                {/* Voice / Mic Button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={isRecording ? "Stop recording" : "Voice input"}
                  title={isRecording ? "Stop recording" : "Voice input"}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isRecording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  {isRecording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
                </button>

                {/* Context Window % Badge */}
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10.5px] font-mono text-muted-foreground"
                  title={`Estimated context usage: ${estTokens} / ${maxContext.toLocaleString()} tokens`}
                >
                  <span>{contextPercent}%</span>
                </div>

                {/* Send Button */}
                <Button
                  size="icon"
                  className="size-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_2px_12px_rgba(234,88,12,0.35)] transition-transform active:scale-95"
                  disabled={!isStreaming && (
                    (!prompt.trim() && !attachedImage && attachedDocuments.length === 0) ||
                    !model
                  )}
                  onClick={isStreaming ? () => stopInference(activeSessionId) : send}
                  aria-label={isStreaming ? "Stop generation" : "Send message"}
                >
                  {isStreaming ? <Square className="size-3.5" /> : <ArrowUp className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <InteractiveTerminal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
      </section>

      {/* On-demand Model & Session Parameters slide-over */}
      {detailsOpen && model && (
        <aside className="absolute right-0 top-0 bottom-0 z-30 w-72 max-w-full shrink-0 border-l border-border/70 bg-sidebar p-5 pt-12 overflow-y-auto animate-in slide-in-from-right-4 duration-150 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Model & Parameters
            </h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              aria-label="Close"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>

          <dl className="space-y-2.5 text-xs rounded-xl border border-border/60 bg-card/70 p-3.5">
            {[
              ["Name", model.name],
              ["Parameters", model.parameters],
              ["Quantization", model.quantization],
              ["Size on disk", `${model.fileSizeGB} GB`],
              ["Context window", `${model.config.contextSize.toLocaleString()} tok`],
              ["Engine", "Local Runtime"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-mono text-foreground truncate">{v}</dd>
              </div>
            ))}
          </dl>

          {session && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Temperature</span>
                  <span className="font-mono text-foreground">{session.temperature.toFixed(2)}</span>
                </div>
                <input
                  aria-label="Temperature"
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={session.temperature}
                  onChange={(e) =>
                    updateSessionParams(session.id, { temperature: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Top-P</span>
                  <span className="font-mono text-foreground">{session.topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  aria-label="Top-P"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={session.topP}
                  onChange={(e) =>
                    updateSessionParams(session.id, { topP: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">System Instructions</span>
                <textarea
                  aria-label="System Instructions"
                  rows={4}
                  value={session.systemPrompt}
                  onChange={(e) =>
                    updateSessionParams(session.id, { systemPrompt: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none focus:border-primary/60 resize-none"
                />
              </div>
            </div>
          )}
        </aside>
      )}
      {splitSession && (
        <SplitChatPane
          splitSession={splitSession}
          hasWallpaper={hasWallpaper}
          isViewerOpen={isViewerOpen}
          onToggleDetails={() => setDetailsOpen((v) => !v)}
          detailsOpen={detailsOpen}
          onOpenMcpSettings={onOpenMcpSettings}
          onSwap={() => {
            const prevActive = activeSessionId;
            setActiveSessionId(splitSession.id);
            setSplitSessionId(prevActive);
          }}
          onClose={() => setSplitSessionId(null)}
        />
      )}
      <ArtifactViewerPanel />
      <DiffReviewModal />
      <ToolApprovalModal />
    </main>
  );
};
