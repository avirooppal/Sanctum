"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  ChevronRight,
  Mic,
  Paperclip,
  SlidersHorizontal,
  X,
  FileText,
  Square,
  Sparkles,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

const splitThinking = (content: string) => {
  const match = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  return {
    thinking: match ? match[1].trim() : "",
    answer: content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim(),
  };
};

const MessageRow: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [showThinking, setShowThinking] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  const { thinking, answer } = splitThinking(msg.content);

  return (
    <div className="flex gap-3">
      <img
        src="/mascot.jpg"
        alt=""
        className="size-7 rounded-full object-cover bg-white shrink-0 mt-0.5 border border-border"
      />
      <div className="min-w-0 flex-1 space-y-2">
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
          <div className="text-sm leading-7 whitespace-pre-wrap">{answer}</div>
        ) : (
          !thinking && <div className="text-sm text-muted-foreground animate-pulse">…</div>
        )}

        {msg.metrics && msg.metrics.totalTokens > 0 && (
          <div className="text-[11px] font-mono text-muted-foreground/70">
            {msg.metrics.tps} tok/s · {msg.metrics.totalTokens} tokens · {msg.metrics.ttftMs}ms to first token
          </div>
        )}
      </div>
    </div>
  );
};

export const ChatScreen: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    models,
    activeModelId,
    setActiveModelId,
    sendMessage,
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
  } = useAppStore();

  const [prompt, setPrompt] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<string | null>(null);

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
  const isStreaming =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    !messages[messages.length - 1].metrics?.totalTokens;

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

    const messageText = trimmed || (attachedImage ? "Please analyze this image." : "Please analyze the attached document.");
    sendMessage(messageText);
    setPrompt("");
  };

  // --- FILE UPLOAD HANDLING ---
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
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
        // Document / code / text / pdf
        try {
          const text = await file.text();
          let docType: any = "text";
          if (file.name.endsWith(".md")) docType = "markdown";
          else if (file.name.endsWith(".pdf")) docType = "pdf";
          else if (file.name.endsWith(".json")) docType = "json";
          else if (/\.(ts|tsx|js|jsx|py|rs|go|cpp|c|html|css)$/.test(file.name)) docType = "code";

          // Ingest into Document Vault
          uploadDocument(activeCollectionId || "col-default", {
            name: file.name,
            size: file.size,
            type: docType,
            rawContent: text,
          });

          // Add as attached document for immediate contextual prompting
          addAttachedDocument({
            name: file.name,
            size: file.size,
            content: text,
          });

          // Auto-enable RAG
          setEnableRagInChat(true);
        } catch (err) {
          console.error("Failed to read document:", err);
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

      // Start browser Web Speech API for immediate live transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: any) => {
            let interimTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interimTranscript += event.results[i][0].transcript;
            }
            if (interimTranscript.trim()) {
              setPrompt((prev) => {
                const base = prev.trim();
                return base ? `${base} ${interimTranscript.trim()}` : interimTranscript.trim();
              });
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          // ignore web speech startup error
        }
      }
    } catch (err) {
      console.error("Microphone access denied or not supported:", err);
      setWhisperStatus("Microphone access denied. Please grant browser permissions.");
    }
  };

  const stopRecording = () => {
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
        if (data.success && data.text) {
          setPrompt((prev) => (prev ? `${prev} ${data.text}` : data.text));
          setWhisperStatus("WhisperX phoneme-aligned transcript applied.");
        } else {
          setWhisperStatus("Live voice captured. WhisperX server optional on :8000.");
        }
      } else {
        setWhisperStatus("Voice audio captured.");
      }
    } catch (err) {
      setWhisperStatus("Voice audio captured.");
    } finally {
      setIsTranscribing(false);
      setTimeout(() => setWhisperStatus(null), 4000);
    }
  };

  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <main className="relative flex flex-1 min-h-0 w-full overflow-hidden">
      <section className="flex flex-col flex-1 min-w-0">
        {/* Compact toolbar */}
        <div className="flex items-center justify-between gap-3 px-6 h-12 shrink-0 border-b border-border/40">
          {models.length > 0 ? (
            <Select className="w-auto" value={model?.id} onValueChange={setActiveModelId}>
              <SelectTrigger className="h-8 w-auto max-w-[280px] gap-2 border-0 shadow-none px-2 text-sm font-medium hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-72">
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{`${m.name}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground px-2">No model available</span>
          )}

          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-label="Model details"
            aria-pressed={detailsOpen}
            className={cn(
              "p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              detailsOpen && "bg-accent text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-6 py-6 space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-[10vh] gap-4">
                <img
                  src="/mascot.jpg"
                  alt="Sanctum Mascot"
                  className="size-16 rounded-full object-cover bg-white border border-border shadow-md"
                />
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">What would you like to explore?</h2>
                  <p className="text-sm text-muted-foreground">
                    {model ? `Running ${model.name} locally on your hardware.` : "Connect or download a model to begin chatting."}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageRow key={m.id} msg={m} />)
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="px-6 pb-5 pt-2 shrink-0">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.py,.js,.tsx,.ts,.rs,.go,.cpp,.c,.html,.css"
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "mx-auto max-w-2xl rounded-2xl border border-input bg-card focus-within:border-muted-foreground/50 transition-colors shadow-xs",
              isRecording && "border-destructive ring-1 ring-destructive/20"
            )}
          >
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
                  <span>Listening with WhisperX...</span>
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
                  ? "Message Sanctum or drop files here…"
                  : "Waiting for a local model…"
              }
              disabled={!model}
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />

            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                {/* File Upload Button */}
                <button
                  type="button"
                  onClick={handleFileClick}
                  aria-label="Attach file"
                  title="Attach images, documents, code, or PDFs"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Paperclip className="size-4" />
                </button>

                {/* Voice / Mic Button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={isRecording ? "Stop recording" : "Voice input with WhisperX"}
                  title={isRecording ? "Stop recording" : "Voice input with WhisperX"}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    isRecording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {isRecording ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />}
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
                      ? "border-primary/50 bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
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

              {/* Send Button */}
              <Button
                size="icon"
                className="size-8 rounded-full"
                disabled={
                  (!prompt.trim() && !attachedImage && attachedDocuments.length === 0) ||
                  !model ||
                  isStreaming
                }
                onClick={send}
                aria-label="Send message"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* On-demand details slide-over */}
      {detailsOpen && model && (
        <aside className="w-72 shrink-0 border-l border-border bg-background p-5 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Model details</h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              aria-label="Close"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ["Name", model.name],
              ["Parameters", model.parameters],
              ["Quantization", model.quantization],
              ["Size on disk", `${model.fileSizeGB} GB`],
              ["Context window", `${model.config.contextSize.toLocaleString()} tokens`],
              ["Engine", "Ollama · 127.0.0.1:11434"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </main>
  );
};
