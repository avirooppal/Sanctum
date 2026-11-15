"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Zap, FileCheck2, Brain, Sparkles, Check, X } from "lucide-react";

function modelSupportsThinking(modelId?: string, modelName?: string): boolean {
  const s = `${modelId || ""} ${modelName || ""}`.toLowerCase();
  if (!s.trim()) return true;
  return (
    s.includes("qwen3") ||
    s.includes("deepseek") ||
    s.includes("r1") ||
    s.includes("qwq") ||
    s.includes("think") ||
    s.includes("o1") ||
    s.includes("o3") ||
    s.includes("claude-3-7") ||
    s.includes("gemini-2.5")
  );
}

function getModelCapabilityTags(m: any): string[] {
  const tags: string[] = ["Tools"];
  const s = `${m?.id || ""} ${m?.name || ""}`.toLowerCase();
  if (m?.supportsVision || s.includes("vl") || s.includes("vision") || s.includes("llava") || s.includes("gemma3")) {
    tags.push("Vision");
  }
  if (modelSupportsThinking(m?.id, m?.name)) {
    tags.push("Thinking");
  }
  return tags;
}

export function WorkspaceTools() {
  const {
    models,
    activeModelId,
    setActiveModelId,
    toolsEnabled,
    setToolsEnabled,
    thinkEnabled,
    setThinkEnabled,
    thinkingEffort,
    setThinkingEffort,
    agentExecutionMode,
    setAgentExecutionMode,
    pendingPlanApproval,
    approvePlanAndExecute,
    dismissPlanApproval,
    openFileTab,
    activeTracker,
  } = useAppStore(
    useShallow((s) => ({
      models: s.models,
      activeModelId: s.activeModelId,
      setActiveModelId: s.setActiveModelId,
      toolsEnabled: s.toolsEnabled,
      setToolsEnabled: s.setToolsEnabled,
      thinkEnabled: s.thinkEnabled,
      setThinkEnabled: s.setThinkEnabled,
      thinkingEffort: s.thinkingEffort,
      setThinkingEffort: s.setThinkingEffort,
      agentExecutionMode: s.agentExecutionMode,
      setAgentExecutionMode: s.setAgentExecutionMode,
      pendingPlanApproval: s.pendingPlanApproval,
      approvePlanAndExecute: s.approvePlanAndExecute,
      dismissPlanApproval: s.dismissPlanApproval,
      openFileTab: s.openFileTab,
      activeTracker: s.activeTracker,
    }))
  );
  const [root, setRoot] = useState("");
  const [undoBusy, setUndoBusy] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const activeModel =
    models.find((m: any) => m.id === activeModelId) || models[0] || null;
  const supportsThinking = modelSupportsThinking(activeModel?.id, activeModel?.name);

  const localModels = models.filter((m: any) => !m.isCloud);
  const cloudModels = models.filter((m: any) => Boolean(m.isCloud));

  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetch("/api/workspace")
        .then((r) => (r.ok ? r.json() : null))
        .then((w) => {
          if (live) setRoot(w?.root || "");
        })
        .catch(() => {});
    void refresh();
    const bridge = (window as any).chrome?.webview;
    const listener = (e: any) => {
      if (e.data?.type === "toolWorkspaceChanged") void refresh();
    };
    bridge?.addEventListener("message", listener);
    return () => {
      live = false;
      bridge?.removeEventListener("message", listener);
    };
  }, []);

  const handleUndoTrash = async () => {
    if (undoBusy || activeTracker) return;
    setUndoBusy(true);
    try {
      const wsRes = await fetch("/api/workspace");
      const ws = wsRes.ok ? await wsRes.json() : { id: "default" };
      const res = await fetchWithApproval(
        "/api/tools/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "workspace_files",
            workspaceId: ws.id,
            arguments: { action: "undo", path: "." },
          }),
        },
        "undo_last_action"
      );
      const data = await res.json();
      if (res.ok && data.restored) {
        toast.success(`Restored ${data.restored} from tool-trash`);
      } else {
        toast.error(data.error || "Nothing in tool-trash to undo");
      }
    } catch {
      toast.error("Could not undo last file action");
    } finally {
      setUndoBusy(false);
    }
  };

  return (
    <div className="border-b border-border/60" data-no-drag>
      {/* Pending Plan Approval Banner (when Plan Mode generated PLAN.md) */}
      {pendingPlanApproval && (
        <div className="flex items-center justify-between gap-2 bg-primary/10 border-b border-primary/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="size-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate">
              Plan ready in{" "}
              <button
                type="button"
                onClick={() => openFileTab(pendingPlanApproval.planPath)}
                className="underline font-mono text-primary hover:opacity-80"
              >
                {pendingPlanApproval.planPath}
              </button>
              . Review and approve before file changes execute.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!!activeTracker}
              onClick={() => void approvePlanAndExecute()}
              className="flex items-center gap-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-2.5 py-1 text-[11px] font-semibold shadow-xs"
            >
              <Check className="size-3" />
              <span>Approve & Execute</span>
            </button>
            <button
              type="button"
              onClick={dismissPlanApproval}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
              title="Dismiss plan prompt"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs">
        {/* Grouped Model Selector (Local vs Cloud + Size/Quant/Context + Capability Tags) */}
        {models.length > 0 && (
          <div className="relative">
            <button
              type="button"
              disabled={!!activeTracker}
              onClick={() => setModelPickerOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 hover:bg-accent/60 px-2 py-1 text-[11px] font-medium text-foreground shrink-0"
              title="Select Local or Cloud Model"
            >
              <Sparkles className="size-3 text-primary" />
              <span className="max-w-[130px] truncate">
                {activeModel?.name || "Select Model"}
              </span>
              {activeModel?.quantization && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  {activeModel.quantization}
                </span>
              )}
            </button>

            {modelPickerOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 z-40 w-80 rounded-xl border border-border/80 bg-popover p-2 shadow-2xl space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1.5">
                  Local Models (Ollama / GGUF)
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {localModels.map((m: any) => {
                    const caps = getModelCapabilityTags(m);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setActiveModelId(m.id);
                          setModelPickerOpen(false);
                        }}
                        className={cn(
                          "flex flex-col w-full gap-1 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted/70",
                          activeModel?.id === m.id && "bg-primary/10 border border-primary/30"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground text-xs truncate">
                            {m.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            {m.fileSizeGB ? `${m.fileSizeGB} GB` : ""} · {m.quantization || "Q4_K_M"} ·{" "}
                            {((m.config?.contextSize || 8192) / 1024).toFixed(0)}k ctx
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {caps.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {cloudModels.length > 0 && (
                  <>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1.5 pt-1 border-t border-border/50">
                      Configured Cloud Models
                    </div>
                    <div className="space-y-1">
                      {cloudModels.map((m: any) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setActiveModelId(m.id);
                            setModelPickerOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-muted/70"
                        >
                          <span className="font-medium text-foreground text-xs">{m.name}</span>
                          <span className="text-[10px] font-mono text-sky-400">Cloud</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Effort / Thinking Level Picker: Off | Low | Medium | High */}
        <div
          className={cn(
            "flex items-center rounded-lg border border-border/80 bg-background/60 p-0.5 shrink-0",
            !supportsThinking && "opacity-50"
          )}
          title={
            supportsThinking
              ? "Reasoning effort / token budget (Off, Low, Medium, High)"
              : "Selected model does not support extended thinking tokens"
          }
        >
          <Brain className="size-3 text-muted-foreground mx-1" />
          {(["off", "low", "medium", "high"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              disabled={!!activeTracker || !supportsThinking}
              onClick={() => setThinkingEffort(lvl)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium capitalize transition-colors",
                thinkingEffort === lvl
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Fast vs Plan Execution Mode Toggle */}
        <div
          className="flex items-center rounded-lg border border-border/80 bg-background/60 p-0.5 shrink-0"
          title="Fast: act directly. Plan: write PLAN.md first, open in viewer, and wait for approval."
        >
          <button
            type="button"
            disabled={!!activeTracker}
            onClick={() => setAgentExecutionMode("fast")}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              agentExecutionMode === "fast"
                ? "bg-accent text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="size-3 text-amber-400" />
            <span>Fast</span>
          </button>
          <button
            type="button"
            disabled={!!activeTracker}
            onClick={() => setAgentExecutionMode("plan")}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              agentExecutionMode === "plan"
                ? "bg-primary/20 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck2 className="size-3" />
            <span>Plan</span>
          </button>
        </div>

        <button
          type="button"
          aria-pressed={toolsEnabled}
          disabled={!!activeTracker}
          onClick={() => setToolsEnabled(!toolsEnabled)}
          className="rounded border px-2 py-1 font-medium whitespace-nowrap shrink-0"
        >
          Tools {toolsEnabled ? "on" : "off"}
        </button>
        <button
          type="button"
          aria-pressed={Boolean(thinkEnabled)}
          disabled={!!activeTracker || !supportsThinking}
          onClick={() => setThinkEnabled?.(!thinkEnabled)}
          className="rounded border px-2 py-1 whitespace-nowrap shrink-0"
          title={
            supportsThinking
              ? "Toggle model reasoning step"
              : "Selected model does not support reasoning mode"
          }
        >
          Reasoning {thinkEnabled ? "on" : "off"}
        </button>

        {root && (
          <>
            <span className="min-w-[60px] flex-1 truncate text-muted-foreground" title={root}>
              {root}
            </span>
            {toolsEnabled && (
              <button
                type="button"
                disabled={!!activeTracker || undoBusy}
                onClick={handleUndoTrash}
                className="rounded border px-2 py-1 text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
                title="Restore most recently trashed file from tool-trash"
              >
                Undo trash
              </button>
            )}
            <button
              type="button"
              disabled={!!activeTracker}
              onClick={() =>
                (window as any).chrome?.webview?.postMessage(
                  JSON.stringify({ type: "selectToolWorkspace" })
                )
              }
              className="rounded border px-2 py-1 whitespace-nowrap shrink-0"
            >
              Choose folder
            </button>
          </>
        )}
      </div>
    </div>
  );
}
