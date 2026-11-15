"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Zap,
  FileCheck2,
  Brain,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Wrench,
  FolderOpen,
  RotateCcw,
} from "lucide-react";

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
  if (
    m?.supportsVision ||
    s.includes("vl") ||
    s.includes("vision") ||
    s.includes("llava") ||
    s.includes("gemma3")
  ) {
    tags.push("Vision");
  }
  if (modelSupportsThinking(m?.id, m?.name)) {
    tags.push("Thinking");
  }
  return tags;
}

export function WorkspacePendingPlanBanner() {
  const { pendingPlanApproval, approvePlanAndExecute, dismissPlanApproval, openFileTab, activeTracker } =
    useAppStore(
      useShallow((s) => ({
        pendingPlanApproval: s.pendingPlanApproval,
        approvePlanAndExecute: s.approvePlanAndExecute,
        dismissPlanApproval: s.dismissPlanApproval,
        openFileTab: s.openFileTab,
        activeTracker: s.activeTracker,
      }))
    );

  if (!pendingPlanApproval) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-primary/10 border-b border-primary/30 px-3.5 py-2 text-xs rounded-t-2xl">
      <div className="flex items-center gap-2 min-w-0">
        <FileCheck2 className="size-3.5 text-primary shrink-0" />
        <span className="font-medium text-foreground truncate">
          Plan ready in{" "}
          <button
            type="button"
            onClick={() => openFileTab(pendingPlanApproval.planPath)}
            className="underline font-mono text-primary hover:opacity-80"
          >
            {pendingPlanApproval.planPath}
          </button>
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
  );
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

  const effortLabel =
    thinkingEffort === "off"
      ? null
      : thinkingEffort.charAt(0).toUpperCase() + thinkingEffort.slice(1);

  return (
    <div className="flex items-center gap-1.5 min-w-0" data-no-drag>
      {/* Unified Model + Effort Selector Pill (Antigravity style: "✦ qwen3:1.7b Medium ⌄") */}
      <div className="relative">
        <button
          type="button"
          disabled={!!activeTracker}
          onClick={() => setModelPickerOpen((v) => !v)}
          className="flex items-center gap-1.5 h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          title="Select model, reasoning effort, and workspace settings"
        >
          <Sparkles className="size-3.5 text-primary/80 shrink-0" />
          <span className="font-medium text-foreground/90 max-w-[130px] truncate">
            {activeModel?.name || "Select Model"}
          </span>
          {effortLabel && (
            <span className="text-[11px] text-muted-foreground font-normal">
              {effortLabel}
            </span>
          )}
          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>

        {modelPickerOpen && (
          <div className="absolute left-0 bottom-full mb-2 z-40 w-80 rounded-2xl border border-border/80 bg-popover p-3 shadow-2xl space-y-3 text-xs">
            {/* 1. Local & Cloud Models */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Local Models (Ollama / GGUF)
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {localModels.map((m: any) => {
                  const caps = getModelCapabilityTags(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveModelId(m.id);
                      }}
                      className={cn(
                        "flex flex-col w-full gap-1 rounded-xl px-2.5 py-1.5 text-left hover:bg-muted/70 transition-colors",
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
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-1 border-t border-border/50">
                    Configured Cloud Models
                  </div>
                  <div className="space-y-1">
                    {cloudModels.map((m: any) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveModelId(m.id)}
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-muted/70"
                      >
                        <span className="font-medium text-foreground text-xs">{m.name}</span>
                        <span className="text-[10px] font-mono text-sky-400">Cloud</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 2. Reasoning Effort Picker */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Brain className="size-3" />
                  Reasoning Effort
                </span>
                <button
                  type="button"
                  onClick={() => setThinkEnabled?.(!thinkEnabled)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Reasoning {thinkEnabled ? "on" : "off"}
                </button>
              </div>
              <div
                className={cn(
                  "grid grid-cols-4 gap-1 rounded-xl bg-background/70 border border-border/60 p-1",
                  !supportsThinking && "opacity-50"
                )}
                title={
                  supportsThinking
                    ? "Reasoning token budget (Off, Low, Medium, High)"
                    : "Selected model does not support extended thinking"
                }
              >
                {(["off", "low", "medium", "high"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    disabled={!!activeTracker || !supportsThinking}
                    onClick={() => setThinkingEffort(lvl)}
                    className={cn(
                      "py-1 rounded-lg text-[11px] font-medium capitalize transition-colors",
                      thinkingEffort === lvl
                        ? "bg-primary/20 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Workspace Folder & Undo Trash */}
            {root && (
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="text-[10px] text-muted-foreground font-mono truncate px-1" title={root}>
                  {root}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!!activeTracker}
                    onClick={() => {
                      (window as any).chrome?.webview?.postMessage(
                        JSON.stringify({ type: "selectToolWorkspace" })
                      );
                      setModelPickerOpen(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border/70 bg-card/70 hover:bg-muted py-1 text-[11px] text-foreground"
                  >
                    <FolderOpen className="size-3" />
                    <span>Choose folder</span>
                  </button>
                  {toolsEnabled && (
                    <button
                      type="button"
                      disabled={!!activeTracker || undoBusy}
                      onClick={handleUndoTrash}
                      className="flex items-center justify-center gap-1 rounded-lg border border-border/70 bg-card/70 hover:bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3" />
                      <span>Undo trash</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact Tools Toggle Pill */}
      <button
        type="button"
        aria-pressed={toolsEnabled}
        disabled={!!activeTracker}
        onClick={() => setToolsEnabled(!toolsEnabled)}
        title="Enable/disable workspace file, terminal, and browser tools"
        className={cn(
          "flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border transition-colors shrink-0",
          toolsEnabled
            ? "border-primary/40 bg-primary/15 text-primary font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        <Wrench className="size-3" />
        <span>Tools {toolsEnabled ? "on" : "off"}</span>
      </button>

      {/* Compact Fast vs Plan Pill (cycles Fast <-> Plan on click) */}
      <button
        type="button"
        disabled={!!activeTracker}
        onClick={() =>
          setAgentExecutionMode(agentExecutionMode === "fast" ? "plan" : "fast")
        }
        title={
          agentExecutionMode === "fast"
            ? "Fast mode: act directly. Click to switch to Plan mode (PLAN.md first)."
            : "Plan mode: writes PLAN.md and waits for approval. Click to switch to Fast mode."
        }
        className={cn(
          "flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border transition-colors shrink-0",
          agentExecutionMode === "plan"
            ? "border-sky-500/40 bg-sky-500/15 text-sky-300 font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        {agentExecutionMode === "fast" ? (
          <>
            <Zap className="size-3 text-amber-400" />
            <span>Fast</span>
          </>
        ) : (
          <>
            <FileCheck2 className="size-3 text-sky-400" />
            <span>Plan</span>
          </>
        )}
      </button>
    </div>
  );
}
