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
    autoVerifyEnabled,
    setAutoVerifyEnabled,
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
      autoVerifyEnabled: s.autoVerifyEnabled,
      setAutoVerifyEnabled: s.setAutoVerifyEnabled,
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
    <div className="flex items-center gap-1 min-w-0" data-no-drag>
      {/* Minimal Mode Toggle: Auto (smart chat + auto-tools + auto-verify) vs Plan */}
      <button
        type="button"
        disabled={!!activeTracker}
        onClick={() =>
          setAgentExecutionMode(agentExecutionMode === "fast" ? "plan" : "fast")
        }
        title={
          agentExecutionMode === "fast"
            ? "Auto mode: smartly activates file tools, browser, and Auto-Verify only when needed. Click for Plan mode."
            : "Plan mode: writes PLAN.md and waits for approval before edits. Click for Auto mode."
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
            <span>Auto</span>
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
