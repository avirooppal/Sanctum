import type { StateCreator } from "zustand";
import type { AgentRun } from "../../../contracts/types/index.ts";
import { createHarnessSession, sendHarnessMessage, interruptHarnessRun } from "../../lib/harnessClient.ts";

export type AutonomyMode = "step_by_step" | "auto_reads" | "full_auto";
export type AgentOperationMode = "build" | "plan";

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "general",
    name: "General Local Agent",
    description: "Runs tasks through the host Agent Harness with call-bound approvals.",
    systemPrompt: "You are a strictly local autonomous agent.",
    allowedTools: ["list_directory", "read_file", "read_file_range", "search_files", "edit_file", "create_file", "run_command", "vault_search", "memory_recall", "memory_save"],
  },
];

export interface AgentSlice {
  agentRuns: AgentRun[];
  activeRunId: string;
  isAgentRunning: boolean;
  agentPrompt: string;
  autonomyMode: AutonomyMode;
  agentMode: AgentOperationMode;
  activePresetId: string;
  maxStepBudget: number;

  setAgentPrompt: (prompt: string) => void;
  setActiveRunId: (id: string) => void;
  setAutonomyMode: (mode: AutonomyMode) => void;
  setAgentMode: (mode: AgentOperationMode) => void;
  setActivePresetId: (presetId: string) => void;
  startAgentTask: (goal: string, modelId?: string) => Promise<void>;
  approveNextAction: () => Promise<void>;
  skipStep: (stepId: string) => void;
  retryStep: (stepId: string) => Promise<void>;
  pauseAgent: () => void;
  resumeAgent: () => Promise<void>;
  stopAgent: () => void;
  clearAgentRuns: () => void;
}

export const createAgentSlice: StateCreator<any, [], [], AgentSlice> = (set, get) => ({
  agentRuns: [],
  activeRunId: "",
  isAgentRunning: false,
  agentPrompt: "",
  autonomyMode: "auto_reads",
  agentMode: "build",
  activePresetId: "general",
  maxStepBudget: 12,

  setAgentPrompt: (prompt) => set({ agentPrompt: prompt }),
  setActiveRunId: (id) => set({ activeRunId: id }),
  setAutonomyMode: (mode) => set({ autonomyMode: mode }),
  setAgentMode: (mode) => set({ agentMode: mode }),
  setActivePresetId: (presetId) => set({ activePresetId: presetId }),

  startAgentTask: async (goal, modelId) => {
    if (!goal.trim()) return;
    const chosenModel = modelId || get().activeModelId || get().models?.[0]?.id || "qwen3:1.7b";
    const mode = get().agentMode === "plan" ? "plan" : "build";
    const autonomy = get().autonomyMode === "step_by_step" ? "ask_all" : "auto_reads";
    set({ isAgentRunning: true });
    try {
      const sess = await createHarnessSession({
        title: goal.slice(0, 48),
        mode,
        autonomy,
        model: chosenModel,
      });
      await sendHarnessMessage(sess.sessionId, goal);
      const nowIso = new Date().toISOString();
      const run: AgentRun = {
        id: sess.sessionId,
        goal,
        status: "running",
        steps: [],
        currentStepIndex: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        logs: [],
        modelId: chosenModel,
      };
      set((s: any) => ({
        agentRuns: [run, ...(s.agentRuns || [])],
        activeRunId: sess.sessionId,
        agentPrompt: "",
      }));
    } catch {
      set({ isAgentRunning: false });
    }
  },

  approveNextAction: async () => {},
  skipStep: () => {},
  retryStep: async () => {},
  pauseAgent: () => {
    const id = get().activeRunId;
    if (id) void interruptHarnessRun(id);
    set({ isAgentRunning: false });
  },
  resumeAgent: async () => {},
  stopAgent: () => {
    const id = get().activeRunId;
    if (id) void interruptHarnessRun(id);
    set({ isAgentRunning: false });
  },
  clearAgentRuns: () => set({ agentRuns: [], activeRunId: "", isAgentRunning: false }),
});
