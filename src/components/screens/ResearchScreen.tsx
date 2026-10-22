"use client";

import React, { useState } from "react";
import { Check, LoaderCircle, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/useAppStore";

export const ResearchScreen: React.FC = () => {
  const { startNewDeepResearch, isResearchRunning } = useAppStore();
  const [query, setQuery] = useState("How are small teams adopting local AI in 2025?");
  const [sources, setSources] = useState([
    {
      title: "The Verge",
      snippet:
        "Small teams are turning to local AI tools for faster iteration, lower costs, and more control over sensitive work.",
      checked: true,
    },
    {
      title: "Mozilla Foundation",
      snippet:
        "Open and locally run models can give smaller organizations practical ways to keep data close and workflows transparent.",
      checked: true,
    },
    {
      title: "Stanford HAI",
      snippet:
        "Research on AI adoption shows that focused teams benefit when implementation follows clear, narrow use cases.",
      checked: true,
    },
  ]);

  const handleStart = () => {
    if (!query.trim()) return;
    startNewDeepResearch(query, "standard");
  };

  const handleExport = () => {
    const text = `# Local AI for small teams\n\nCross-checking sources on: "${query}"\n\n### A practical shift toward private, focused tools\n\nIn 2025, small teams are adopting local AI less as a wholesale replacement for cloud services and more as a dependable layer inside specific workflows...`;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `research_dossier.md`;
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
              className="rounded-lg bg-background h-11"
            />
          </div>
          <Button
            type="button"
            disabled={isResearchRunning}
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
              <span className="text-muted-foreground text-xs font-mono">complete</span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-primary mb-2 h-1.5" />
            <div className="text-foreground text-sm flex items-center gap-2">
              <Check className="text-primary size-4" />
              <span>Searching sources</span>
              <span className="text-muted-foreground text-xs font-mono">complete</span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-primary mb-2 h-1.5" />
            <div className="font-medium text-foreground text-sm flex items-center gap-2">
              <LoaderCircle className="text-primary size-4 animate-spin" />
              <span>Reading extracts</span>
              <span className="text-muted-foreground text-xs font-mono">active</span>
            </div>
          </div>

          <div>
            <div className="rounded-full bg-muted mb-2 h-1.5" />
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <span className="rounded-full border border-border size-4" />
              <span>Writing summary</span>
              <span className="text-xs font-mono">upcoming</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Split Section: Sources List (Left) and Dossier Artifact (Right) */}
      <div className="grid flex-1 gap-6 grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] min-h-0">
        {/* Left Column: Verified Sources */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base">Sources</h2>
            <span className="text-muted-foreground text-sm">
              {sources.filter((s) => s.checked).length} reviewed
            </span>
          </div>

          {sources.map((src, idx) => (
            <Card key={idx} className="shadow-sm rounded-xl bg-card border border-border p-5">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-medium text-sm text-foreground">{src.title}</h3>
                  <p className="text-muted-foreground text-sm leading-6 mt-2">
                    {src.snippet}
                  </p>
                </div>
                <Checkbox
                  checked={src.checked}
                  onCheckedChange={(checked) => {
                    const next = [...sources];
                    next[idx].checked = Boolean(checked);
                    setSources(next);
                  }}
                  aria-label={`Mark ${src.title} as checked`}
                />
              </div>
            </Card>
          ))}
        </section>

        {/* Right Column: Research Dossier Artifact */}
        <Card className="shadow-sm rounded-xl bg-card border border-border flex flex-col min-h-0">
          <div className="border-b border-border flex px-6 py-4 justify-between items-center">
            <div>
              <h2 className="font-semibold text-lg">Local AI for small teams</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Cross-checking 8 sources
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

          <article className="text-card-foreground text-sm leading-7 px-8 py-7 max-w-3xl overflow-y-auto space-y-5">
            <h3 className="font-semibold text-xl leading-8">
              A practical shift toward private, focused tools
            </h3>
            <p>
              In 2025, small teams are adopting local AI less as a wholesale
              replacement for cloud services and more as a dependable layer
              inside specific workflows. Teams are using compact models for
              drafting, retrieval, coding assistance, and internal knowledge work
              where speed and privacy matter most.
            </p>
            <p>
              The strongest adoption patterns combine a narrow purpose with
              clear human review. Local deployment can reduce latency and
              recurring costs, while giving teams more control over sensitive
              material. The tradeoff is that teams must invest in evaluation,
              maintenance, and choosing models that fit their hardware and task
              requirements.
              <sup className="text-primary font-bold ml-1">[1]</sup>
              <sup className="text-primary font-bold ml-1">[2]</sup>
            </p>
            <div className="text-muted-foreground text-xs leading-5 border-t border-border pt-5 space-y-2">
              <p>
                [1] The Verge, research on small-team adoption of local AI tools.
              </p>
              <p>
                [2] Mozilla Foundation and Stanford HAI, perspectives on open,
                private, and responsible AI adoption.
              </p>
            </div>
          </article>
        </Card>
      </div>
    </main>
  );
};
