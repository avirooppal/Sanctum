"use client";

import React, { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface VaultDropZoneProps {
  onFilesSelected: (files: FileList | null) => void;
}

export const VaultDropZone: React.FC<VaultDropZoneProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFilesSelected(e.dataTransfer.files);
  };

  return (
    <div className="p-4 border-b border-white/5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,.csv,.pdf"
        onChange={(e) => onFilesSelected(e.target.files)}
        className="hidden"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center",
          isDragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
        )}
      >
        <UploadCloud className="w-8 h-8 text-zinc-500 mb-2" />
        <div className="text-xs font-semibold text-zinc-300">Drag & Drop Files into Vault</div>
        <div className="text-[11px] text-zinc-500 mt-1">
          Reads local .md, .txt, .json, .csv with real-time vectorization
        </div>
      </div>
    </div>
  );
};
