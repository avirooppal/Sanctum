"use client";

import React, { useRef } from "react";
import { Send, Image as ImageIcon, Mic } from "lucide-react";
import { VisionInspector } from "./VisionInspector";
import { cn } from "@/lib/utils";

interface ChatInputBarProps {
  inputPrompt: string;
  setInputPrompt: (val: string) => void;
  onSend: () => void;
  modelName: string;
  isVoiceOpen: boolean;
  onToggleVoice: () => void;
  attachedImage: { src: string; name: string; width: number; height: number } | null;
  onSetAttachedImage: (img: { src: string; name: string; width: number; height: number } | null) => void;
  enableRagInChat: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputPrompt,
  setInputPrompt,
  onSend,
  modelName,
  isVoiceOpen,
  onToggleVoice,
  attachedImage,
  onSetAttachedImage,
  enableRagInChat,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onSetAttachedImage({
          src,
          name: file.name,
          width: img.width,
          height: img.height,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 border-t border-surface-border bg-surface-raised/60">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Multimodal Image Preview */}
        {attachedImage && (
          <VisionInspector
            imageSrc={attachedImage.src}
            imageName={attachedImage.name}
            imageDimensions={{ width: attachedImage.width, height: attachedImage.height }}
            onRemove={() => onSetAttachedImage(null)}
          />
        )}

        <div className="relative flex items-end bg-zinc-950 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors shadow-subtle">
          <textarea
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Send message to ${modelName} (Enter to send, Shift+Enter for newline)...`}
            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 resize-none px-3 py-1 focus:outline-none max-h-32"
          />
          <div className="flex items-center gap-1 pb-1 pr-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Attach Image for Computer Vision OCR"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleVoice}
              className={cn(
                "p-2 rounded-xl transition-colors",
                isVoiceOpen
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
              title="Speak via Local Whisper Voice Recognition"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              onClick={onSend}
              disabled={!inputPrompt.trim() && !attachedImage}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-colors"
              title="Transmit prompt to local model"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-2">
          <span>
            {enableRagInChat
              ? "RAG Active: Automatically retrieving local vector chunks"
              : "Standard Prompt Mode"}
          </span>
          <span>Air-Gapped: Private Local Session</span>
        </div>
      </div>
    </div>
  );
};
