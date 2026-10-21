"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";
import { ResearchStep } from "@/types";
import { cn } from "@/lib/utils";

interface ResearchStepCardProps {
  step: ResearchStep;
  index: number;
}

export const ResearchStepCard: React.FC<ResearchStepCardProps> = ({ step, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/70 p-3.5 space-y-2 transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </div>
          <span className="text-xs font-semibold text-zinc-200">{step.title}</span>
        </div>

        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded capitalize shrink-0",
            step.status === "completed"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400 animate-pulse"
          )}
        >
          {step.status}
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed pl-7">{step.detail}</p>

      <div className="flex items-center justify-between pl-7 text-[10px] font-mono text-zinc-500 pt-1">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{step.durationMs}ms</span>
        </div>
        {step.logs.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1"
          >
            <span>{isExpanded ? "Hide Logs" : `Logs (${step.logs.length})`}</span>
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 p-2.5 rounded-lg bg-zinc-950 font-mono text-[10px] text-zinc-400 border border-white/5 space-y-1">
          {step.logs.map((log, lIdx) => (
            <div key={lIdx} className="leading-tight">
              <span className="text-indigo-500 mr-1.5">$</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
