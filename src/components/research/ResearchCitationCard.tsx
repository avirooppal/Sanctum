"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { ResearchCitation } from "@/types";

interface ResearchCitationCardProps {
  citation: ResearchCitation;
}

export const ResearchCitationCard: React.FC<ResearchCitationCardProps> = ({ citation }) => {
  return (
    <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-zinc-700 transition-colors space-y-1">
      <div className="flex items-start justify-between gap-2">
        <a
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-indigo-300 hover:underline flex items-center gap-1 line-clamp-1"
        >
          <span>{citation.title}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
        <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
          {citation.relevanceScore}% rel
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 italic line-clamp-2">
        &quot;{citation.snippet}&quot;
      </p>
      <div className="text-[10px] font-mono text-zinc-500">{citation.domain}</div>
    </div>
  );
};
