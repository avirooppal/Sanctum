import { StateCreator } from "zustand";
import { ArenaPaneState } from "@/types";
import { LocalEngineClient } from "@/lib/engine";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export interface ArenaSlice {
  arenaPanes: ArenaPaneState[];
  arenaPrompt: string;
  arenaSplitMode: "dual" | "triple" | "quad";

  setArenaSplitMode: (mode: "dual" | "triple" | "quad") => void;
  setArenaPrompt: (prompt: string) => void;
  setArenaPaneModel: (index: number, modelId: string) => void;
  triggerArenaPrompt: () => Promise<void>;
}

export const createArenaSlice: StateCreator<any, [], [], ArenaSlice> = (set, get) => ({
  arenaPanes: [],
  arenaPrompt: "",
  arenaSplitMode: "dual",

  setArenaSplitMode: (mode) => {
    const paneCount = mode === "dual" ? 2 : mode === "triple" ? 3 : 4;
    const currentPanes = get().arenaPanes;
    const availableModels = get().models;

    const newPanes: ArenaPaneState[] = Array.from({ length: paneCount }).map((_, i) => {
      if (currentPanes[i]) return currentPanes[i];
      const model = availableModels[i % availableModels.length];
      return {
        modelId: model ? model.id : "",
        temperature: 0.7,
        gpuOffloadRatio: 1.0,
        isGenerating: false,
        currentResponse: "",
        metrics: { tps: 0, ttftMs: 0, totalTokens: 0, vramUsedGB: model ? model.vramRequiredGB : 0 },
      };
    });

    set({ arenaSplitMode: mode, arenaPanes: newPanes });
  },

  setArenaPrompt: (prompt) => set({ arenaPrompt: prompt }),

  setArenaPaneModel: (index, modelId) => {
    set((state: any) => {
      const updated = [...state.arenaPanes];
      if (updated[index]) {
        const model = state.models.find((m: any) => m.id === modelId);
        updated[index] = {
          ...updated[index],
          modelId,
          metrics: {
            ...updated[index].metrics,
            vramUsedGB: model ? model.vramRequiredGB : 0,
          },
        };
      }
      return { arenaPanes: updated };
    });
  },

  triggerArenaPrompt: async () => {
    const prompt = get().arenaPrompt;
    if (!prompt.trim()) return;

    set((state: any) => ({
      arenaPanes: state.arenaPanes.map((p: ArenaPaneState) => ({
        ...p,
        isGenerating: true,
        currentResponse: "",
      })),
    }));

    const panes = get().arenaPanes;
    await Promise.all(
      panes.map(async (pane: ArenaPaneState, idx: number) => {
        if (!pane.modelId) return;
        const messages = [{ role: "user", content: prompt }];

        for await (const chunk of LocalEngineClient.streamChat(pane.modelId, messages, {
          endpoint: DEFAULT_OLLAMA_ENDPOINT,
          temperature: pane.temperature,
        })) {
          set((state: any) => {
            const updated = [...state.arenaPanes];
            if (updated[idx]) {
              updated[idx] = {
                ...updated[idx],
                isGenerating: !chunk.isFinished,
                currentResponse: chunk.text,
                metrics: chunk.metrics,
              };
            }
            return { arenaPanes: updated };
          });
        }
      })
    );
  },
});
