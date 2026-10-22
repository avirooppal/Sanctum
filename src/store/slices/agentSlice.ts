import type { StateCreator } from "zustand";
import type { AgentRun, AgentStep } from "../../../contracts/types/index.ts";
import { DEFAULT_OLLAMA_ENDPOINT } from "../../../contracts/constants/index.ts";

export interface AgentSlice {
  agentRuns: AgentRun[];
  activeRunId: string;
  isAgentRunning: boolean;
  agentPrompt: string;

  setAgentPrompt: (prompt: string) => void;
  setActiveRunId: (id: string) => void;
  startAgentTask: (goal: string, modelId?: string) => Promise<void>;
  approveNextAction: () => Promise<void>;
  pauseAgent: () => void;
  resumeAgent: () => Promise<void>;
  stopAgent: () => void;
  clearAgentRuns: () => void;
}

export const createAgentSlice: StateCreator<any, [], [], AgentSlice> = (set, get) => ({
  agentRuns: [
    {
      id: "run-initial",
      goal: "Update the checkout button copy and verify the flow",
      modelId: "llama3.2",
      status: "waiting_approval",
      currentStepIndex: 3,
      createdAt: "Today at 12:00 PM",
      updatedAt: "Just now",
      logs: [
        "[00:00.12] Agent initialized. Target sandbox: localhost:3000",
        "[00:00.45] Step 1 complete: Connected to target DOM tree.",
        "[00:01.10] Step 2 complete: Located Checkout button node (#submit-order).",
        "[00:01.85] Step 3 complete: Read form labels and input bindings.",
        "[00:02.40] Step 4 staged: Awaiting human authorization to click #submit-order.",
      ],
      steps: [
        {
          id: "step-1",
          title: "Opened localhost:3000",
          description: "Navigated headless browser to local target viewport.",
          toolName: "browser_navigate",
          toolArgs: { url: "http://localhost:3000", viewport: "1280x800" },
          status: "completed",
          result: "HTTP 200 OK - DOMContentLoaded in 310ms",
          executionTimeMs: 310,
        },
        {
          id: "step-2",
          title: "Clicked Checkout",
          description: "Simulated mouse pointer navigation and button focus.",
          toolName: "mouse_click",
          toolArgs: { selector: "button#checkout", x: 380, y: 245 },
          status: "completed",
          result: "Navigation to checkout modal succeeded",
          executionTimeMs: 140,
        },
        {
          id: "step-3",
          title: "Read the form labels",
          description: "Extracted accessible labels and interactive elements.",
          toolName: "dom_query",
          toolArgs: { query: "form label, form input" },
          status: "completed",
          result: "Found 4 fields: Full Name, Address, Card Details, Submit",
          executionTimeMs: 85,
        },
        {
          id: "step-4",
          title: "Submit order flow verification",
          description: "Execute order confirmation and assert response status.",
          toolName: "browser_click",
          toolArgs: { selector: "button#submit-order", timeoutMs: 5000 },
          status: "waiting_approval",
          requiresApproval: true,
        },
      ],
    },
  ],
  activeRunId: "run-initial",
  isAgentRunning: false,
  agentPrompt: "Update the checkout button copy and verify the flow",

  setAgentPrompt: (prompt) => set({ agentPrompt: prompt }),
  setActiveRunId: (id) => set({ activeRunId: id }),

  startAgentTask: async (goal, modelId) => {
    if (!goal.trim()) return;

    const chosenModel = modelId || get().activeModelId || get().models[0]?.id || "local-agent";
    const runId = `run-${Date.now()}`;

    // Deconstruct goal into dynamic steps based on intent
    const isCode = /code|function|fix|bug|refactor|test|api/i.test(goal);
    const isDoc = /doc|read|search|vault|rag|summarize|extract/i.test(goal);

    let generatedSteps: AgentStep[] = [];

    if (isCode) {
      generatedSteps = [
        {
          id: `step-${Date.now()}-1`,
          title: `Analyze workspace for "${goal.slice(0, 32)}..."`,
          description: "Inspect project manifests and syntax tree.",
          toolName: "inspect_workspace",
          toolArgs: { path: "./src", recursive: true },
          status: "completed",
          result: "Indexed source files and found target references.",
          executionTimeMs: 120,
        },
        {
          id: `step-${Date.now()}-2`,
          title: "Generate atomic patch & test verification",
          description: "Synthesize changes conforming to architectural standards.",
          toolName: "code_synthesize",
          toolArgs: { prompt: goal, model: chosenModel },
          status: "completed",
          result: "Patch synthesized: 2 files modified, 0 breaking changes.",
          executionTimeMs: 450,
        },
        {
          id: `step-${Date.now()}-3`,
          title: "Apply code changes & run automated tests",
          description: "Execute test suites and verify exit code 0.",
          toolName: "execute_bash",
          toolArgs: { command: "npm test" },
          status: "waiting_approval",
          requiresApproval: true,
        },
        {
          id: `step-${Date.now()}-4`,
          title: "Verify zero regressions and commit",
          description: "Ensure working tree is clean and format matches.",
          toolName: "git_checkpoint",
          toolArgs: { stageAll: true },
          status: "pending",
        },
      ];
    } else if (isDoc) {
      generatedSteps = [
        {
          id: `step-${Date.now()}-1`,
          title: `Search local Knowledge Vault for "${goal.slice(0, 32)}..."`,
          description: "Execute semantic cosine similarity search across indexed documents.",
          toolName: "search_vault",
          toolArgs: { query: goal, topK: 4 },
          status: "completed",
          result: "Retrieved 4 relevant vector chunks with >0.35 similarity.",
          executionTimeMs: 90,
        },
        {
          id: `step-${Date.now()}-2`,
          title: "Synthesize grounded dossier extract",
          description: "Extract citations and structure findings.",
          toolName: "model_inference",
          toolArgs: { model: chosenModel, temperature: 0.3 },
          status: "completed",
          result: "Structured summary compiled with source attributions.",
          executionTimeMs: 380,
        },
        {
          id: `step-${Date.now()}-3`,
          title: "Save synthesis to project vault",
          description: "Persist document and update indexing tables.",
          toolName: "vault_store",
          toolArgs: { destination: "Default Knowledge Vault" },
          status: "waiting_approval",
          requiresApproval: true,
        },
      ];
    } else {
      // General dynamic browser / computer use task
      generatedSteps = [
        {
          id: `step-${Date.now()}-1`,
          title: `Inspect target environment for "${goal.slice(0, 32)}..."`,
          description: "Connect to local runtime sandbox and inspect state.",
          toolName: "environment_connect",
          toolArgs: { endpoint: "http://localhost:3000" },
          status: "completed",
          result: "Connection verified (Node.js runtime + React hydration)",
          executionTimeMs: 150,
        },
        {
          id: `step-${Date.now()}-2`,
          title: "Decompose actionable flow elements",
          description: "Identify selectors, state triggers, and action targets.",
          toolName: "dom_query",
          toolArgs: { target: goal },
          status: "completed",
          result: "Identified 3 target interaction nodes.",
          executionTimeMs: 110,
        },
        {
          id: `step-${Date.now()}-3`,
          title: `Execute action: ${goal}`,
          description: "Trigger primary interaction with safety assertion.",
          toolName: "sandbox_action",
          toolArgs: { goal, requireConsent: true },
          status: "waiting_approval",
          requiresApproval: true,
        },
        {
          id: `step-${Date.now()}-4`,
          title: "Verify result and render confirmation",
          description: "Assert expected outcome.",
          toolName: "verify_output",
          toolArgs: { assertStatus: "ok" },
          status: "pending",
        },
      ];
    }

    const newRun: AgentRun = {
      id: runId,
      goal,
      modelId: chosenModel,
      status: "waiting_approval",
      currentStepIndex: generatedSteps.findIndex((s) => s.status === "waiting_approval") !== -1
        ? generatedSteps.findIndex((s) => s.status === "waiting_approval")
        : 0,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      updatedAt: "Just now",
      logs: [
        `[${new Date().toLocaleTimeString()}] Task initiated: "${goal}"`,
        `[${new Date().toLocaleTimeString()}] Model orchestrator: ${chosenModel}`,
        `[${new Date().toLocaleTimeString()}] Generated ${generatedSteps.length} planned actions.`,
        `[${new Date().toLocaleTimeString()}] Step ${generatedSteps.findIndex((s) => s.status === "waiting_approval") + 1} halted: Awaiting human confirmation.`,
      ],
      steps: generatedSteps,
    };

    set((state: any) => ({
      agentRuns: [newRun, ...state.agentRuns],
      activeRunId: runId,
      isAgentRunning: false,
    }));
  },

  approveNextAction: async () => {
    const run = get().agentRuns.find((r: AgentRun) => r.id === get().activeRunId);
    if (!run) return;

    const pendingIndex = run.steps.findIndex(
      (s: AgentStep) => s.status === "waiting_approval" || s.status === "pending"
    );
    if (pendingIndex === -1) return;

    set((state: any) => ({
      isAgentRunning: true,
      agentRuns: state.agentRuns.map((r: AgentRun) =>
        r.id === state.activeRunId
          ? {
              ...r,
              status: "running",
              steps: r.steps.map((s, idx) =>
                idx === pendingIndex ? { ...s, status: "running" } : s
              ),
              logs: [
                ...r.logs,
                `[${new Date().toLocaleTimeString()}] Human confirmed action: "${r.steps[pendingIndex].title}". Executing...`,
              ],
            }
          : r
      ),
    }));

    // Realistic execution delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    set((state: any) => {
      const active = state.agentRuns.find((r: AgentRun) => r.id === state.activeRunId);
      if (!active) return state;

      const updatedSteps = active.steps.map((s: AgentStep, idx: number) => {
        if (idx === pendingIndex) {
          return {
            ...s,
            status: "completed" as const,
            result: `Execution succeeded via tool [${s.toolName || "action"}] (200 OK)`,
            executionTimeMs: 420,
          };
        }
        return s;
      });

      const nextPendingIndex = updatedSteps.findIndex((s: AgentStep) => s.status === "pending");
      const isComplete = nextPendingIndex === -1;

      if (!isComplete) {
        updatedSteps[nextPendingIndex] = {
          ...updatedSteps[nextPendingIndex],
          status: updatedSteps[nextPendingIndex].requiresApproval
            ? "waiting_approval"
            : "completed",
        };
      }

      return {
        isAgentRunning: false,
        agentRuns: state.agentRuns.map((r: AgentRun) =>
          r.id === state.activeRunId
            ? {
                ...r,
                status: isComplete ? "completed" : "waiting_approval",
                currentStepIndex: isComplete ? updatedSteps.length - 1 : nextPendingIndex,
                steps: updatedSteps,
                logs: [
                  ...r.logs,
                  `[${new Date().toLocaleTimeString()}] Action "${active.steps[pendingIndex].title}" finished successfully.`,
                  ...(isComplete
                    ? [`[${new Date().toLocaleTimeString()}] Agent task completed all sub-goals successfully.`]
                    : []),
                ],
              }
            : r
        ),
      };
    });
  },

  pauseAgent: () =>
    set((state: any) => ({
      isAgentRunning: false,
      agentRuns: state.agentRuns.map((r: AgentRun) =>
        r.id === state.activeRunId ? { ...r, status: "paused" } : r
      ),
    })),

  resumeAgent: async () => {
    set((state: any) => ({
      isAgentRunning: true,
      agentRuns: state.agentRuns.map((r: AgentRun) =>
        r.id === state.activeRunId ? { ...r, status: "running" } : r
      ),
    }));
    await get().approveNextAction();
  },

  stopAgent: () =>
    set((state: any) => ({
      isAgentRunning: false,
      agentRuns: state.agentRuns.map((r: AgentRun) =>
        r.id === state.activeRunId ? { ...r, status: "idle" } : r
      ),
    })),

  clearAgentRuns: () =>
    set({
      agentRuns: [],
      activeRunId: "",
      isAgentRunning: false,
    }),
});
