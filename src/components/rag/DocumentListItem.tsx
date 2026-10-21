"use client";

import React from "react";
import { FileText, Trash2 } from "lucide-react";
import { IngestedDocument } from "@/types";
import { cn, formatBytes } from "@/lib/utils";

interface DocumentListItemProps {
  document: IngestedDocument;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document,
  isSelected,
  onSelect,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2",
        isSelected
          ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
          : "border-transparent bg-zinc-900/50 hover:bg-zinc-800/40 text-zinc-300"
      )}
    >
      <div className="flex items-start gap-2.5">
        <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold line-clamp-1">{document.name}</div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-1">
            <span>{formatBytes(document.sizeBytes)}</span>
            <span>•</span>
            <span className="text-cyan-400">{document.chunkCount} Chunks</span>
            <span>•</span>
            <span>{document.indexedAt}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
          {document.status}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-zinc-500 transition-opacity"
          title="Delete document and purge vectors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
