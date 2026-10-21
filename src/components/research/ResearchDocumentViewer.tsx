"use client";

import React, { useState } from "react";
import { FileText, Copy, Check, Download } from "lucide-react";

interface ResearchDocumentViewerProps {
  documentContent: string;
  topicTitle: string;
}

export const ResearchDocumentViewer: React.FC<ResearchDocumentViewerProps> = ({
  documentContent,
  topicTitle,
}) => {
  const [copiedDoc, setCopiedDoc] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(documentContent);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([documentContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${topicTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-surface-base">
      <div className="p-3 border-b border-surface-border bg-surface-raised/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Dossier Artifact Document</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMd}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/5 transition-colors"
            title="Download Document as .md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/5 transition-colors"
          >
            {copiedDoc ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedDoc ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-4">
        <article className="prose prose-invert prose-zinc max-w-none text-zinc-200 text-xs leading-relaxed space-y-4">
          <div className="whitespace-pre-wrap font-sans leading-relaxed">{documentContent}</div>
        </article>
      </div>
    </div>
  );
};
