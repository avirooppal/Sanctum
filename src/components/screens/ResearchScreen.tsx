"use client";

import React, { useState } from "react";
import { Check, LoaderCircle, Download, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

export const ResearchScreen: React.FC = () => {
  const { dossiers, activeDossierId, startNewDeepResearch, isResearchRunning } = useAppStore();
  const [query, setQuery] = useState("");

  const currentDossier = dossiers.find((d) => d.id === activeDossierId) || dossiers[0];

  const handleStart = () => {
    if (!query.trim()) return;
    startNewDeepResearch(query, "standard");
    setQuery("");
  };

  const handleExport = () => {
    if (!currentDossier) return;
    const blob = new Blob([currentDossier.generatedDocument || currentDossier.title], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentDossier.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex p-8 flex-col flex-1 gap-6 overflow-y-auto">
      {/* Top Query & Progress Bar Card */}
      <Card className="shadow-sm rounded-xl bg-card border border-border p-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label
              htmlFor="research-query"
              className="font-medium text-card-foreground text-sm mb-2 block"
            >
              What do you want to research?
            </label>
            <Input
              id="research-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="e.g. Distributed consensus algorithms, AVX-512 SIMD, Quantum error correction..."
              className="rounded-lg bg-background h-11"
            />
          </div>
          <Button
            type="button"
            disabled={isResearchRunning || !query.trim()}
            onClick={handleStart}
            className="rounded-lg px-5 h-11"
          >
            {isResearchRunning ? "Researching..." : "Start research"}
          </Button>
        </div>

        {/* 4-Step Pipeline Status */}
        <div className="grid mt-6 gap-4 grid-cols-2 md:grid-cols-4">
          <div>
            <div className="rounded-full bg-primary mb-2 h-1.5" />
            <div className="text-foreground text-sm flex items-center gap-2">
              <Check className="text-primary size-4" />
              <span>Planning</span>
              <span className="text-muted-foreground text-xs font-mono">
                {currentDossier ? "complete" : "ready"}
              </span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-primary mb-2 h-1.5" />
            <div className="text-foreground text-sm flex items-center gap-2">
              <Check className="text-primary size-4" />
              <span>Searching sources</span>
              <span className="text-muted-foreground text-xs font-mono">
                {currentDossier ? "complete" : "ready"}
              </span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-primary mb-2 h-1.5" />
            <div className="font-medium text-foreground text-sm flex items-center gap-2">
              {isResearchRunning ? (
                <LoaderCircle className="text-primary size-4 animate-spin" />
              ) : (
                <Check className="text-primary size-4" />
              )}
              <span>Reading extracts</span>
              <span className="text-muted-foreground text-xs font-mono">
                {isResearchRunning ? "active" : currentDossier ? "complete" : "standby"}
              </span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-muted mb-2 h-1.5" />
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <span className="rounded-full border border-border size-4" />
              <span>Writing summary</span>
              <span className="text-xs font-mono">
                {currentDossier?.status === "completed" ? "complete" : "upcoming"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Split Section: Real Sources (Left) and Real Dossier Artifact (Right) */}
      {currentDossier ? (
        <div className="grid flex-1 gap-6 grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] min-h-0">
          {/* Left Column: Verified Sources */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-base">Sources</h2>
              <span className="text-muted-foreground text-sm">
                {currentDossier.citations.length} retrieved
              </span>
            </div>

            {currentDossier.citations.length > 0 ? (
              currentDossier.citations.map((src, idx) => (
                <Card key={idx} className="shadow-sm rounded-xl bg-card border border-border p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sm text-foreground hover:underline flex items-center gap-1.5"
                      >
                        <span>{src.title}</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </a>
                      <p className="text-muted-foreground text-xs leading-5 mt-2 line-clamp-3">
                        {src.snippet}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-5 text-xs text-muted-foreground">
                Retrieving encyclopedia sources...
              </Card>
            )}
          </section>

          {/* Right Column: Research Dossier Artifact */}
          <Card className="shadow-sm rounded-xl bg-card border border-border flex flex-col min-h-0">
            <div className="border-b border-border flex px-6 py-4 justify-between items-center">
              <div>
                <h2 className="font-semibold text-lg">{currentDossier.title}</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Synthesized via local model with verified citations
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                className="rounded-lg gap-2 text-xs"
              >
                <Download className="size-3.5" />
                <span>Export document</span>
              </Button>
            </div>

            <article className="text-card-foreground text-sm leading-7 px-8 py-7 max-w-3xl overflow-y-auto space-y-4">
              {currentDossier.generatedDocument ? (
                <div className="whitespace-pre-wrap font-sans">
                  {currentDossier.generatedDocument}
                </div>
              ) : (
                <div className="text-muted-foreground italic text-xs animate-pulse">
                  Synthesizing research dossier...
                </div>
              )}
            </article>
          </Card>
        </div>
      ) : (
        <div className="py-16 text-center rounded-xl border border-border/50 bg-muted/10 text-muted-foreground text-sm">
          No research dossiers yet. Enter a topic above to initiate a live multi-step inquiry.
        </div>
      )}
    </main>
  );
};
