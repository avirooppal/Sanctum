"use client";

import React, { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";

export const ArenaScreen: React.FC = () => {
  const {
    models,
    arenaPanes,
    arenaPrompt,
    setArenaPrompt,
    triggerArenaPrompt,
    setArenaPaneModel,
  } = useAppStore();

  const [isExported, setIsExported] = useState(false);

  const isGenerating = arenaPanes.some((p) => p.isGenerating);

  const handleExport = () => {
    let report = `# Sanctum Arena Benchmark\n\nPrompt: "${arenaPrompt}"\n\n`;
    arenaPanes.forEach((p, idx) => {
      const model = models.find((m) => m.id === p.modelId) || models[0];
      report += `### Model ${idx + 1}: ${model?.name || "Local Model"}\n${p.currentResponse || "(No response)"}\nSpeed: ${p.metrics.tps} t/s | TTFT: ${p.metrics.ttftMs}ms | VRAM: ${p.metrics.vramUsedGB}GB\n\n`;
    });
    navigator.clipboard.writeText(report);
    setIsExported(true);
    setTimeout(() => setIsExported(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      triggerArenaPrompt();
    }
  };

  return (
    <main className="flex p-8 flex-col flex-1 overflow-y-auto">
      <div className="flex mx-auto flex-col gap-6 w-full max-w-5xl">
        {/* Comparison Prompt Bar */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="comparison-prompt"
            className="font-medium text-foreground text-sm"
          >
            Prompt
          </label>
          <div className="flex items-center gap-3">
            <Input
              id="comparison-prompt"
              value={arenaPrompt}
              onChange={(e) => setArenaPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explain the tradeoffs of local versus cloud AI for a small team."
              className="bg-card flex-1 h-11"
            />
            <Button
              variant="secondary"
              disabled={isGenerating || !arenaPrompt.trim()}
              onClick={triggerArenaPrompt}
              className="px-5 h-11"
            >
              {isGenerating ? "Evaluating..." : "Run comparison"}
            </Button>
          </div>
        </div>

        {/* Side-by-Side Model Comparison Cards */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* Card 1: Local Model */}
          <Card className="shadow-xs rounded-lg bg-card border-border p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-4">
                <Select
                  value={arenaPanes[0]?.modelId || models[0]?.id || "qwen"}
                  onValueChange={(val) => setArenaPaneModel(0, val)}
                >
                  <SelectTrigger className="font-medium shadow-none bg-transparent text-base border-0 px-0 w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        Ollama · {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="shrink-0 bg-accent text-accent-foreground">
                  Local / Offline
                </Badge>
              </div>

              <div className="text-card-foreground text-sm leading-6 mt-6 min-h-28">
                {arenaPanes[0]?.isGenerating ? (
                  <div className="text-muted-foreground animate-pulse font-mono text-xs">
                    Generating local response stream...
                  </div>
                ) : arenaPanes[0]?.currentResponse ? (
                  <p className="whitespace-pre-wrap">{arenaPanes[0].currentResponse}</p>
                ) : (
                  <p>
                    Local models keep sensitive data on the team’s machines and
                    offer fast, predictable responses without recurring API
                    costs. They require capable hardware and run completely
                    air-gapped.
                  </p>
                )}
              </div>
            </div>

            <div className="text-muted-foreground text-sm border-t border-border flex mt-6 pt-4 flex-wrap gap-x-6 gap-y-2">
              <span>
                Quality{" "}
                <strong className="font-medium text-foreground">4.5/5</strong>
              </span>
              <span>
                Speed{" "}
                <strong className="font-medium text-foreground">
                  {arenaPanes[0]?.metrics?.tps || 38} tok/s
                </strong>
              </span>
              <span>
                Cost{" "}
                <strong className="font-medium text-foreground">$0.000</strong>
              </span>
            </div>
          </Card>

          {/* Card 2: Cloud / Alternate Model */}
          <Card className="shadow-xs rounded-lg bg-card border-border p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-4">
                <Select
                  value={arenaPanes[1]?.modelId || models[1]?.id || "claude"}
                  onValueChange={(val) => setArenaPaneModel(1, val)}
                >
                  <SelectTrigger className="font-medium shadow-none bg-transparent text-base border-0 px-0 w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Anthropic · Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="gpt4o">OpenAI · GPT-4o</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={`sec-${m.id}`} value={m.id}>
                        Local · {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">
                  Cloud API
                </Badge>
              </div>

              <div className="text-card-foreground text-sm leading-6 mt-6 min-h-28">
                {arenaPanes[1]?.isGenerating ? (
                  <div className="text-muted-foreground animate-pulse font-mono text-xs">
                    Generating cloud response stream...
                  </div>
                ) : arenaPanes[1]?.currentResponse ? (
                  <p className="whitespace-pre-wrap">{arenaPanes[1].currentResponse}</p>
                ) : (
                  <p>
                    Cloud models generally deliver richer context, stronger
                    reasoning, and easier scaling with no local hardware to
                    maintain. They depend on external connectivity with usage-based
                    API billing.
                  </p>
                )}
              </div>
            </div>

            <div className="text-muted-foreground text-sm border-t border-border flex mt-6 pt-4 flex-wrap gap-x-6 gap-y-2">
              <span>
                Quality{" "}
                <strong className="font-medium text-foreground">4.8/5</strong>
              </span>
              <span>
                Speed{" "}
                <strong className="font-medium text-foreground">
                  {arenaPanes[1]?.metrics?.tps || 42} tok/s
                </strong>
              </span>
              <span>
                Cost{" "}
                <strong className="font-medium text-foreground">$0.008</strong>
              </span>
            </div>
          </Card>
        </div>

        {/* Verdict Bar */}
        <div className="border-y border-border flex py-4 justify-between items-center text-sm">
          <p className="text-muted-foreground">
            Claude is more nuanced · Qwen is faster and private
          </p>
          <button
            type="button"
            className="text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <Plus className="size-4" />
            <span>Add model</span>
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            2 models ready · Parallel run complete
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            {isExported ? <Check className="size-4 text-primary" /> : null}
            <span>{isExported ? "Comparison copied" : "Export comparison"}</span>
          </button>
        </div>
      </div>
    </main>
  );
};
