"use client";

import React, { useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Globe2,
  Hand,
  MousePointer2,
  Terminal,
  Play,
  Pause,
  Square,
  Sparkles,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const AgentsScreen: React.FC = () => {
  const {
    models,
    activeModelId,
    setActiveModelId,
    agentRuns,
    activeRunId,
    isAgentRunning,
    agentPrompt,
    setAgentPrompt,
    startAgentTask,
    approveNextAction,
    pauseAgent,
    resumeAgent,
    stopAgent,
  } = useAppStore();

  const [isTechOpen, setIsTechOpen] = useState(false);

  const activeRun =
    agentRuns.find((r) => r.id === activeRunId) || agentRuns[0];

  const currentStep =
    activeRun?.steps.find(
      (s) => s.status === "waiting_approval" || s.status === "running"
    ) ||
    activeRun?.steps[activeRun.steps.length - 1] ||
    activeRun?.steps[0];

  const isAwaitingApproval =
    activeRun?.status === "waiting_approval" ||
    activeRun?.steps.some((s) => s.status === "waiting_approval");

  const isCompleted = activeRun?.status === "completed";

  const handleStartTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!agentPrompt.trim() || isAgentRunning) return;
    startAgentTask(agentPrompt.trim(), activeModelId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStartTask();
    }
  };

  return (
    <main className="flex p-8 flex-col flex-1 gap-6 overflow-y-auto">
      <div className="grid flex-1 gap-8 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Side: Virtual Sandbox / Browser Canvas */}
        <section className="flex flex-col gap-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col flex-1 gap-2 min-w-[200px]">
              <label
                htmlFor="task"
                className="font-medium text-foreground text-sm"
              >
                Task Goal
              </label>
              <div className="flex gap-2">
                <Input
                  id="task"
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Update checkout button copy and verify the flow..."
                  className="rounded-md bg-card border-input h-10 flex-1"
                />
                <Button
                  type="button"
                  onClick={() => handleStartTask()}
                  disabled={isAgentRunning || !agentPrompt.trim()}
                  className="h-10 px-4 gap-1.5"
                >
                  <Sparkles className="size-4" />
                  <span>Plan</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-56">
              <label className="font-medium text-foreground text-sm">
                Model
              </label>
              <Select
                value={activeModelId || models[0]?.id || "local"}
                onValueChange={(val) => setActiveModelId(val)}
              >
                <SelectTrigger className="rounded-md bg-card border-input h-10">
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
            </div>
            <Badge className="rounded-md bg-muted text-muted-foreground mb-2">
              Consent-Gated Local Execution
            </Badge>
          </div>

          {/* Virtual Browser & Sandbox Window */}
          <div className="shadow-sm rounded-xl bg-card border border-border flex flex-col flex-1 min-h-[360px] overflow-hidden">
            <div className="border-b border-border flex px-5 justify-between items-center h-12 bg-muted/20">
              <div className="flex items-center gap-3">
                <Globe2 className="text-muted-foreground size-4" />
                <span className="font-mono text-muted-foreground text-sm">
                  {currentStep?.toolArgs?.url || "http://localhost:3000"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {activeRun?.status === "running"
                    ? "EXECUTING"
                    : activeRun?.status === "waiting_approval"
                    ? "AWAITING APPROVAL"
                    : isCompleted
                    ? "TASK COMPLETED"
                    : "STANDBY"}
                </span>
              </div>
            </div>

            <div className="bg-muted/30 flex p-8 justify-center items-center flex-1 relative overflow-hidden">
              {/* Dynamic Viewport: Changes based on step context */}
              {currentStep?.toolName?.includes("code") || currentStep?.toolName?.includes("bash") ? (
                <div className="rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 p-6 w-full max-w-xl font-mono text-xs space-y-2 shadow-lg">
                  <div className="flex items-center gap-2 text-zinc-400 pb-2 border-b border-zinc-800">
                    <Terminal className="size-3.5" />
                    <span>sandboxed-environment: bash</span>
                  </div>
                  <div className="text-emerald-400">$ {currentStep?.toolArgs?.command || "node runner.js"}</div>
                  <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {currentStep?.result || "[Running compilation & verification loop...]"}
                  </div>
                </div>
              ) : (
                <div className="shadow-xs rounded-lg bg-background border border-border flex p-12 flex-col justify-center items-center gap-8 size-full max-w-xl max-h-96 relative">
                  <div className="flex flex-col items-center gap-2">
                    <h2 className="font-semibold text-foreground text-2xl">
                      Checkout Flow
                    </h2>
                    <span className="text-muted-foreground text-sm">
                      {isCompleted ? "Order Flow Verified" : "Autonomous agent interacting with DOM"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      "font-medium shadow-xs rounded-md text-sm px-6 py-3 transition-all",
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-primary text-primary-foreground cursor-default"
                    )}
                  >
                    {isCompleted ? "Order Confirmed ✓" : "Submit order"}
                  </button>
                  <MousePointer2
                    aria-label="Cursor marker"
                    className={cn(
                      "text-primary self-end size-5 transition-transform",
                      activeRun?.status === "running" && "animate-bounce"
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Side: What Sanctum is doing */}
        <section className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-accent text-accent-foreground flex justify-center items-center size-9">
                  <Bot className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-card-foreground text-lg">
                    What Sanctum is doing
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Supervised execution loop
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {activeRun?.steps.filter((s) => s.status === "completed").length} / {activeRun?.steps.length || 0} steps
              </Badge>
            </div>

            <div className="flex mt-6 flex-col gap-4">
              {activeRun?.steps && activeRun.steps.length > 0 ? (
                activeRun.steps.map((step, idx) => {
                  const isStepDone = step.status === "completed";
                  const isStepCurrent = step.status === "waiting_approval" || step.status === "running";

                  return (
                    <div
                      key={step.id || idx}
                      className={cn(
                        "flex gap-3.5 items-start p-3 rounded-lg border transition-colors",
                        isStepCurrent
                          ? "bg-primary/5 border-primary/40 shadow-xs"
                          : isStepDone
                          ? "bg-muted/20 border-border/60"
                          : "border-transparent opacity-60"
                      )}
                    >
                      {isStepDone ? (
                        <div className="rounded-full bg-emerald-500/15 text-emerald-500 flex justify-center items-center shrink-0 size-5 mt-0.5">
                          <Check className="size-3.5" />
                        </div>
                      ) : isStepCurrent ? (
                        <div className="rounded-full bg-background border-2 border-primary shrink-0 size-5 mt-0.5 animate-pulse" />
                      ) : (
                        <div className="rounded-full bg-muted border border-border shrink-0 size-5 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium leading-snug",
                              isStepDone
                                ? "text-muted-foreground line-through decoration-muted-foreground/40"
                                : "text-foreground"
                            )}
                          >
                            {step.title}
                          </p>
                          {step.executionTimeMs && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {step.executionTimeMs}ms
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  No active agent goals. Type a task on the left and click &quot;Plan&quot;.
                </div>
              )}
            </div>
          </div>

          <div className="flex pt-6 flex-col gap-2.5">
            <button
              type="button"
              disabled={isAgentRunning || isCompleted || !isAwaitingApproval}
              onClick={() => approveNextAction()}
              className={cn(
                "font-semibold shadow-xs rounded-md text-base flex px-5 justify-center items-center gap-2 h-12 transition-colors",
                isAwaitingApproval
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Hand className="size-5" />
              <span>{isCompleted ? "Goal Completed" : "Confirm action"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  activeRun?.status === "paused" ? resumeAgent() : pauseAgent()
                }
                disabled={isCompleted || !activeRun}
                className="font-medium rounded-md bg-secondary text-secondary-foreground text-xs border border-border px-3 h-10 hover:bg-secondary/80 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {activeRun?.status === "paused" ? (
                  <>
                    <Play className="size-3.5" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => stopAgent()}
                disabled={isCompleted || !activeRun}
                className="font-medium rounded-md text-destructive text-xs border border-destructive/40 px-3 h-10 hover:bg-destructive/10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Square className="size-3.5" />
                <span>Stop agent</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsTechOpen(!isTechOpen)}
              className="text-left text-muted-foreground text-xs flex pt-2 items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  isTechOpen && "rotate-90"
                )}
              />
              <span>Technical details & logs</span>
            </button>
            {isTechOpen && (
              <div className="rounded-md bg-muted/60 text-muted-foreground text-[11px] border border-border p-3 font-mono space-y-1.5 max-h-40 overflow-y-auto">
                <div>Tool: `{currentStep?.toolName || "dom_query"}`</div>
                <div>Args: {JSON.stringify(currentStep?.toolArgs || {})}</div>
                <div className="pt-1 border-t border-border/40 text-[10px] space-y-0.5">
                  {activeRun?.logs.map((log, lIdx) => (
                    <div key={lIdx} className="text-zinc-400">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="text-muted-foreground text-xs border-t border-border flex pt-4 justify-center items-center gap-2">
        <ShieldCheck className="size-4 text-emerald-500" />
        <span>Sovereign local sandbox: Human approval required before every active execution.</span>
      </footer>
    </main>
  );
};
