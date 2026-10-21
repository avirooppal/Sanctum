"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ChatHeader } from "./ChatHeader";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatInputBar } from "./ChatInputBar";
import { VoiceRecorder } from "./VoiceRecorder";

export const ChatCanvas: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    models,
    sendMessage,
    openConfigModal,
    enableRagInChat,
    setEnableRagInChat,
    attachedImage,
    setAttachedImage,
  } = useAppStore();

  const [inputPrompt, setInputPrompt] = useState("");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];
  const activeModel = models.find((m) => m.id === currentSession?.modelId) || models[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const handleSend = () => {
    if (!inputPrompt.trim() && !attachedImage) return;
    const text = inputPrompt.trim() || "Analyze this attached image.";
    sendMessage(text);
    setInputPrompt("");
  };

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-base text-zinc-500 text-xs">
        Select or create a conversation thread to begin.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      <ChatHeader
        session={currentSession}
        activeModel={activeModel}
        enableRagInChat={enableRagInChat}
        onToggleRag={() => setEnableRagInChat(!enableRagInChat)}
        onOpenConfig={() => openConfigModal(activeModel)}
      />

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {currentSession.messages.length === 0 ? (
          <ChatEmptyState onSelectSuggestion={(sug) => setInputPrompt(sug)} />
        ) : (
          currentSession.messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Recorder Overlay */}
      {isVoiceOpen && (
        <div className="px-4 pb-2 max-w-4xl mx-auto w-full">
          <VoiceRecorder
            onClose={() => setIsVoiceOpen(false)}
            onTranscriptionComplete={(text) => {
              setInputPrompt(text);
              setIsVoiceOpen(false);
            }}
          />
        </div>
      )}

      {/* Input Prompt Dock */}
      <ChatInputBar
        inputPrompt={inputPrompt}
        setInputPrompt={setInputPrompt}
        onSend={handleSend}
        modelName={activeModel.name}
        isVoiceOpen={isVoiceOpen}
        onToggleVoice={() => setIsVoiceOpen(!isVoiceOpen)}
        attachedImage={attachedImage}
        onSetAttachedImage={setAttachedImage}
        enableRagInChat={enableRagInChat}
      />
    </div>
  );
};
