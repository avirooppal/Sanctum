"use client";

import React, { useState } from "react";
import {
  SearchCode,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileText,
  Copy,
  Check,
  Download,
  Terminal,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ResearchStep, ResearchCitation } from "@/types";
import { cn } from "@/lib/utils";

export const DeepResearchWorkspace: React.FC = () => {
  const { dossiers, activeDossierId, isResearchRunning } = useAppStore();
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<string | null>(null);

  const currentDossier = dossiers.find((d) => d.id === activeDossierId) || dossiers[0];

  const handleCopy = () => {
    if (!currentDossier) return;
    navigator.clipboard.writeText(currentDossier.generatedDocument);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadMd = () => {
    if (!currentDossier) return;
    const blob = new Blob([currentDossier.generatedDocument], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentDossier.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/5 transition-colors"
            title="Download Document as .md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/5 transition-colors"
          >
            {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedDoc ? "Copied" : "Copy Markdown"}</span>
          </button>
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
            {currentDossier.steps.map((step, idx) => {
              const isExpanded = activeStepTab === step.id;

              return (
                <div
                  key={step.id}
                  className="rounded-xl border border-white/5 bg-zinc-900/70 p-3.5 space-y-2 transition-all hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
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
                        onClick={() => setActiveStepTab(isExpanded ? null : step.id)}
                        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>{isExpanded ? "Hide Logs" : `Logs (${step.logs.length})`}</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded Step Log Details */}
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
            })}

            {/* Citations & Evidence Panel */}
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Source Evidences ({currentDossier.citations.length})</span>
              </span>

              <div className="space-y-2">
                {currentDossier.citations.map((citation) => (
                  <div
                    key={citation.id}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-zinc-700 transition-colors space-y-1"
                  >
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
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Generated Document Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-surface-base">
          <div className="p-3 border-b border-surface-border bg-surface-raised/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dossier Artifact Document</span>
            </span>
            <div className="text-[10px] font-mono text-zinc-500">Rendered via Client Markdown</div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-4">
            <article className="prose prose-invert prose-zinc max-w-none text-zinc-200 text-xs leading-relaxed space-y-4">
              <div className="whitespace-pre-wrap font-sans leading-relaxed">
                {currentDossier.generatedDocument}
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};
