"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const ResearchExplorer: React.FC = () => {
  const {
    dossiers,
    activeDossierId,
    setActiveDossierId,
    startNewDeepResearch,
    isResearchRunning,
  } = useAppStore();

  const [researchInput, setResearchInput] = useState("");

  const handleLaunch = () => {
    if (researchInput.trim() && !isResearchRunning) {
      startNewDeepResearch(researchInput.trim(), "exhaustive");
      setResearchInput("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-zinc-900/80 border border-indigo-500/20 rounded-xl space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch Deep Inquiry</span>
        </div>
        <input
          type="text"
          placeholder="Topic or research question..."
          value={researchInput}
          onChange={(e) => setResearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLaunch();
          }}
          className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          disabled={isResearchRunning || !researchInput.trim()}
          onClick={handleLaunch}
          className="w-full py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          {isResearchRunning ? "Pipeline Running..." : "Execute Agent Plan"}
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Investigation Archives
        </span>
        <div className="space-y-1">
          {dossiers.map((dossier) => {
            const isActive = activeDossierId === dossier.id;
            return (
              <div
                key={dossier.id}
                onClick={() => setActiveDossierId(dossier.id)}
                className={cn(
                  "p-2.5 rounded-lg cursor-pointer border transition-all text-left space-y-1.5",
                  isActive
                    ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                <div className="text-xs font-medium line-clamp-2">{dossier.title}</div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded capitalize",
                      dossier.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    )}
                  >
                    {dossier.status}
                  </span>
                  <span className="text-zinc-500">{dossier.tokensConsumed} tok</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
