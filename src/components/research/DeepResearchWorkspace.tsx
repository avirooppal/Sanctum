"use client";

import React from "react";
import { SearchCode, Terminal, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ResearchStepCard } from "./ResearchStepCard";
import { ResearchCitationCard } from "./ResearchCitationCard";
import { ResearchDocumentViewer } from "./ResearchDocumentViewer";
import { cn } from "@/lib/utils";

export const DeepResearchWorkspace: React.FC = () => {
  const { dossiers, activeDossierId } = useAppStore();

  const currentDossier = dossiers.find((d) => d.id === activeDossierId) || dossiers[0];

  if (!currentDossier) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-base text-center space-y-4">
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <SearchCode className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-200">Autonomous Deep Research Engine</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Dispatches live multi-step research queries across public encyclopedias and your local Ollama models. Launch a new investigation from the sidebar explorer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
            <SearchCode className="w-4 h-4 text-indigo-400" />
            <span>Autonomous Deep Research Engine</span>
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded-full border capitalize",
                currentDossier.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}
            >
              {currentDossier.status}
            </span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{currentDossier.topic}</p>
        </div>
      </div>

      {/* Main Split Layout: Agent Step Pipeline (Left) & Document Reader (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Col: Step Timeline & Agent Log Trace (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full border-r border-surface-border bg-surface-raised/40 overflow-hidden">
          <div className="p-3 border-b border-white/5 bg-zinc-900/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Multi-Agent Execution Pipeline</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {currentDossier.tokensConsumed} tokens processed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {currentDossier.steps.map((step, idx) => (
              <ResearchStepCard key={step.id} step={step} index={idx} />
            ))}

            {/* Citations & Evidence Panel */}
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Source Evidences ({currentDossier.citations.length})</span>
              </span>

              <div className="space-y-2">
                {currentDossier.citations.map((citation) => (
                  <ResearchCitationCard key={citation.id} citation={citation} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Generated Document Preview (7 cols) */}
        <ResearchDocumentViewer
          documentContent={currentDossier.generatedDocument}
          topicTitle={currentDossier.title}
        />
      </div>
    </div>
  );
};
