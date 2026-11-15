"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DownloadPopover } from "@/components/jan/DownloadPopover";
import { handleTitleBarMouseDown, handleTitleBarDoubleClick, handleTitleBarContextMenu } from "@/components/jan/WindowControls";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { splitThinking, PromptTemplates } from "@core/ai/index.ts";
import { RequestStatusLine } from "@/components/chat/RequestStatusLine";
import { determineDocumentType } from "@core/domain/documents.ts";
import { toast } from "sonner";
import { WorkspaceTools } from "@/components/chat/WorkspaceTools";
import { extractAttachmentText } from "@/lib/attachments";
import { AccessScopeBadge } from "@/components/access/AccessScopeBadge";
import { InteractiveTerminal } from "@/components/terminal/InteractiveTerminal";
import { Terminal as TerminalIcon } from "lucide-react";
import { ToolApprovalModal } from "@/components/chat/ToolApprovalModal";
import { ArtifactViewerPanel } from "@/components/viewer/ArtifactViewerPanel";
import { TurnChangesSummaryCard, DiffReviewModal } from "@/components/viewer/DiffReviewModal";
import { detectCandidateFilePaths } from "@core/infra/security/content_sanitizer.ts";

interface ChatScreenProps {
  onNavigate?: (module: "chat" | "hub" | "settings") => void;
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
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
          {msg.content}
          {msg.image && <img src={msg.image.src} alt={msg.image.name} className="mt-2 max-h-52 rounded-lg" />}
          {msg.attachments?.map((doc) => (
            <div key={doc.name} className="mt-2 text-xs opacity-80">
              📎 {doc.name}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Copy message"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
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
      <div className="min-w-0 flex-1 space-y-2.5">
        {/* Assistant header: Model name + Timestamp */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">{modelName || "Local Model"}</span>
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
              className="group/tool rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-xs"
            >
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-muted-foreground hover:text-foreground">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-foreground/85">
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
                        : "text-muted-foreground"
                    )}
                  >
                    {statusLabel}
                  </span>
                  <ChevronRight className="size-3.5 transition-transform group-open/tool:rotate-90 shrink-0" />
                </div>

                {filePathArg && onOpenFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenFile(filePathArg);
                    }}
                    className="px-1.5 py-0.5 rounded bg-muted/70 hover:bg-accent text-[10px] font-mono text-foreground shrink-0"
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

        {answer ? (
          <div className="text-sm leading-7 whitespace-pre-wrap text-foreground/95">{answer}</div>
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

export const ChatScreen: React.FC<ChatScreenProps> = () => {
  const {
    chatSessions,
    activeSessionId,
    models,
    activeModelId,
    setActiveModelId,
    sendMessage,
    stopInference,
    regenerateLastMessage,
    deleteChatMessage,
    toggleMessageBookmark,
    activeTracker,
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
  } = useAppStore(
    useShallow((s) => ({
      chatSessions: s.chatSessions,
      activeSessionId: s.activeSessionId,
      models: s.models,
      activeModelId: s.activeModelId,
      setActiveModelId: s.setActiveModelId,
      sendMessage: s.sendMessage,
      stopInference: s.stopInference,
      regenerateLastMessage: s.regenerateLastMessage,
      deleteChatMessage: s.deleteChatMessage,
      toggleMessageBookmark: s.toggleMessageBookmark,
      activeTracker: s.activeTracker,
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
    }))
  );

  const [prompt, setPrompt] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(80);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

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
  const isStreaming = Boolean(activeTracker);

  // Estimate context window usage %
  const totalSessionChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + prompt.length;
  const estTokens = Math.max(1, Math.round(totalSessionChars / 4));
  const maxContext = model?.config?.contextSize || 8192;
  const contextPercent = Math.min(100, Math.max(1, Math.round((estTokens / maxContext) * 100)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow composer
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  useEffect(() => {
    const desktop = (window as any).chrome?.webview;
    if (!desktop) return;
    const handleSpeech = (event: any) => {
      const data = event.data;
      if (data?.type === "speechStarted") {
        setIsRecording(true); setRecordingSeconds(0);
        setWhisperStatus("Listening offline. Click the microphone to stop.");
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setRecordingSeconds(value => value + 1), 1000);
      } else if (data?.type === "speechResult") {
        setPrompt(value => value ? `${value} ${data.text}` : data.text);
      } else if (data?.type === "speechError" || data?.type === "speechStopped") {
        setIsRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setWhisperStatus(data.type === "speechError" ? data.text : "Dictation stopped.");
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

  const send = () => {
    const trimmed = prompt.trim();
    if ((!trimmed && !attachedImage && attachedDocuments.length === 0) || !model || isStreaming) return;

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

  // --- WHISPERX & MICROPHONE RECORDING ---
  const startRecording = async () => {
    setWhisperStatus(null);
    const desktop = (window as any).chrome?.webview;
    if (desktop) {
      setWhisperStatus("Starting offline dictation…");
      desktop.postMessage(JSON.stringify({ type: "speechStart" }));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudioWithWhisperX(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);


    } catch (err) {
      console.error("Microphone access denied or not supported:", err);
      setWhisperStatus("Microphone access denied. Please grant browser permissions.");
    }
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
        } else {
          setWhisperStatus(data.error || data.message || "No speech detected. Please try again.");
        }
      } else {
        setWhisperStatus("Transcription failed. Start the local speech service on port 8000, or use the Windows desktop app for offline dictation.");
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

  // Detect @file mention in prompt
  useEffect(() => {
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

  return (
    <main className="relative flex flex-1 min-h-0 w-full overflow-hidden bg-background">
      <section className="relative flex flex-col flex-1 min-w-0 min-h-0">
        {/* Top In-Window Titlebar & Floating Model Selector Pill (Matches Screenshot 2026-10-25 190854.png) */}
        <div
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
          onContextMenu={handleTitleBarContextMenu}
          className="flex items-center justify-between gap-2 px-3 sm:px-4 pr-32 sm:pr-36 h-11 shrink-0"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* When sidebar is collapsed, show the floating pill [DownloadPopover] [Expand Sidebar] */}
            {isExplorerCollapsed && (
              <div className="flex items-center gap-0.5 rounded-xl bg-card/90 border border-border/60 px-1.5 py-0.5 shadow-xs shrink-0">
                <DownloadPopover />
                <button
                  type="button"
                  onClick={toggleExplorer}
                  aria-label="Expand sidebar"
                  title="Expand Sidebar (Ctrl+B)"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <IconChevronRight size={15} />
                </button>
              </div>
            )}

            <AccessScopeBadge />
            {/* Model Selector Pill */}
            <div className="flex items-center gap-1 min-w-0 shrink rounded-xl bg-card/90 border border-border/60 px-2 py-0.5 shadow-xs">
              {models.length > 0 ? (
                <Select className="w-auto min-w-0" value={model?.id} onValueChange={setActiveModelId}>
                  <SelectTrigger aria-label="Select model" disabled={!!activeTracker} className="h-7 w-auto min-w-0 max-w-[140px] sm:max-w-[240px] gap-1.5 border-0 bg-transparent shadow-none px-1.5 text-xs font-medium hover:bg-accent/60 rounded-lg truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-72">
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground px-2 py-1">No model available</span>
              )}

              <button
                type="button"
                onClick={() => setIsTerminalOpen((v) => !v)}
                aria-label="Toggle terminal"
                title="Toggle Interactive Terminal"
                className={cn(
                  "p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors",
                  isTerminalOpen && "bg-accent text-primary"
                )}
              >
                <TerminalIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                aria-label="Model details"
                aria-pressed={detailsOpen}
                title="Model & Session Parameters"
                className={cn(
                  "p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors",
                  detailsOpen && "bg-accent text-foreground"
                )}
              >
                <Settings className="size-3.5" />
              </button>

              <span
                className={cn(
                  "size-2 rounded-full mx-1 shrink-0",
                  model ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted-foreground/40"
                )}
                title={model ? `Active: ${model.name}` : "No active model"}
              />
            </div>

            <button
              type="button"
              onClick={toggleViewer}
              aria-label="Toggle workspace viewer panel"
              title="Toggle Artifact & Workspace Viewer (Ctrl+\\)"
              className={cn(
                "flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-2.5 py-1 text-[11px] font-medium transition-colors shadow-xs",
                isViewerOpen
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isViewerOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
              <span className="hidden sm:inline">Viewer</span>
              {viewerTabs.length > 0 && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-mono text-primary">
                  {viewerTabs.length}
                </span>
              )}
            </button>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-6 py-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-[14vh] gap-4">
                <img
                  src="/mascot.jpg"
                  alt="Sanctum Mascot"
                  width={56}
                  height={56}
                  style={{ width: "56px", height: "56px", maxWidth: "56px", maxHeight: "56px" }}
                  className="size-14 w-14 h-14 rounded-2xl object-cover bg-card border border-border/80 shadow-lg"
                />
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    What would you like to explore?
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

        {/* Composer (Matches Screenshot 2026-10-25 190854.png) */}
        <div className={cn("px-2 sm:px-6 pt-2 shrink-0", isTerminalOpen ? "pb-3" : "pb-5")}>
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
            className={cn(
              "relative mx-auto max-w-2xl rounded-2xl border border-border/80 bg-card/95 focus-within:border-muted-foreground/50 transition-colors shadow-lg",
              isRecording && "border-destructive ring-1 ring-destructive/20"
            )}
          >
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

            <WorkspaceTools />
            <textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
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
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1.5 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {/* + Attach Button */}
                <button
                  type="button"
                  onClick={handleFileClick}
                  aria-label="Attach file"
                  title="Attach PDF, DOCX, images, text, or code"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                >
                  <Plus className="size-4" />
                </button>

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

                <button type="button" onClick={() => setBookmarksOnly(v => !v)}
                  aria-label="Show bookmarked responses" aria-pressed={bookmarksOnly}
                  title="Show bookmarked responses"
                  className={cn("p-1.5 rounded-lg hover:bg-accent/60", bookmarksOnly && "text-primary bg-primary/15")}>
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

                {/* My documents (RAG) Toggle */}
                <button
                  type="button"
                  onClick={() => setEnableRagInChat(!enableRagInChat)}
                  aria-pressed={enableRagInChat}
                  disabled={documents.length === 0 && attachedDocuments.length === 0}
                  title={
                    documents.length === 0 && attachedDocuments.length === 0
                      ? "Attach or add documents in Vault first"
                      : "Ground responses in indexed documents"
                  }
                  className={cn(
                    "ml-1 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs border transition-colors disabled:opacity-40 disabled:pointer-events-none",
                    enableRagInChat
                      ? "border-primary/50 bg-primary/15 text-foreground font-medium"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="size-3.5" />
                  <span>My documents</span>
                  {(documents.length > 0 || attachedDocuments.length > 0) && (
                    <span className="text-[10px] opacity-70">
                      ({documents.length + attachedDocuments.length})
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Context Window % Badge */}
                <div
                  className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground"
                  title={`Estimated context usage: ${estTokens} / ${maxContext.toLocaleString()} tokens`}
                >
                  <span className="inline-block size-2 rounded-full border border-muted-foreground/60" />
                  <span>{contextPercent}%</span>
                </div>

                {/* Send Button */}
                <Button
                  size="icon"
                  className="size-7 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  disabled={!isStreaming && (
                    (!prompt.trim() && !attachedImage && attachedDocuments.length === 0) ||
                    !model
                  )}
                  onClick={isStreaming ? stopInference : send}
                  aria-label={isStreaming ? "Stop generation" : "Send message"}
                >
                  {isStreaming ? <Square className="size-3.5" /> : <ArrowUp className="size-3.5" />}
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
      <ArtifactViewerPanel />
      <DiffReviewModal />
      <ToolApprovalModal />
    </main>
  );
};
