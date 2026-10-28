import { StateCreator } from "zustand";
import { LocalModel, ModelCategory } from "@/types";
import { LocalEngineClient } from "@/lib/engine";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export interface DownloadProgress {
  percent: number;
  status: string;
  isDownloading: boolean;
}

export interface ModelsSlice {
  models: LocalModel[];
  selectedCategory: ModelCategory;
  searchModelQuery: string;
  activeModelId: string;
  isFetchingModels: boolean;
  isConfigModalOpen: boolean;
  selectedModelForConfig: LocalModel | null;
  downloadProgressMap: Record<string, DownloadProgress>;

  initModels: () => Promise<void>;
  openConfigModal: (model: LocalModel) => void;
  closeConfigModal: () => void;
  updateModelConfig: (modelId: string, newConfig: Partial<LocalModel["config"]>) => void;
  toggleModelLoad: (modelId: string) => void;
  startModelDownload: (modelName: string) => Promise<boolean>;
  cancelModelDownload: (modelName: string) => void;
  clearDownloadEntry: (modelName: string) => void;
  setSelectedCategory: (cat: ModelCategory) => void;
  setSearchModelQuery: (q: string) => void;
  setActiveModelId: (id: string) => void;
}

export const createModelsSlice: StateCreator<any, [], [], ModelsSlice> = (set, get) => ({
  models: [],
  selectedCategory: "all",
  searchModelQuery: "",
  activeModelId: "",
  isFetchingModels: false,
  isConfigModalOpen: false,
  selectedModelForConfig: null,
  downloadProgressMap: {},

  initModels: async () => {
    set({ isFetchingModels: true });
    try {
      const realModels = await LocalEngineClient.fetchOllamaModels(DEFAULT_OLLAMA_ENDPOINT);
      if (realModels.length > 0) {
        const currentActive = get().activeModelId;
        const isValid = realModels.some((m: any) => m.id === currentActive);
        const activeId = isValid ? currentActive : realModels[0].id;
        set((state: any) => ({
          models: realModels,
          activeModelId: activeId,
          isFetchingModels: false,
          chatSessions: state.chatSessions.map((s: any) => ({
            ...s,
            modelId: realModels.some((m: any) => m.id === s.modelId) ? s.modelId : activeId,
          })),
          arenaPanes: [
            {
              modelId: realModels[0].id,
              temperature: 0.7,
              gpuOffloadRatio: 1.0,
              isGenerating: false,
              currentResponse: "",
              metrics: { tps: 0, ttftMs: 0, totalTokens: 0, vramUsedGB: realModels[0].vramRequiredGB },
            },
            {
              modelId: realModels[1]?.id || realModels[0].id,
              temperature: 0.7,
              gpuOffloadRatio: 1.0,
              isGenerating: false,
              currentResponse: "",
              metrics: { tps: 0, ttftMs: 0, totalTokens: 0, vramUsedGB: (realModels[1] || realModels[0]).vramRequiredGB },
            },
          ],
        }));
      } else {
        set({ isFetchingModels: false });
      }
    } catch {
      set({ isFetchingModels: false });
    }
  },

  openConfigModal: (model) => set({ isConfigModalOpen: true, selectedModelForConfig: model }),
  closeConfigModal: () => set({ isConfigModalOpen: false, selectedModelForConfig: null }),

  updateModelConfig: (modelId, newConfig) =>
    set((state: any) => ({
      models: state.models.map((m: LocalModel) =>
        m.id === modelId ? { ...m, config: { ...m.config, ...newConfig } } : m
      ),
    })),

  toggleModelLoad: (modelId) =>
    set((state: any) => ({
      models: state.models.map((m: LocalModel) =>
        m.id === modelId ? { ...m, isLoaded: !m.isLoaded } : m
      ),
    })),

  startModelDownload: async (modelName) => {
    set((state: any) => ({
      downloadProgressMap: {
        ...state.downloadProgressMap,
        [modelName]: { percent: 1, status: "Starting download...", isDownloading: true },
      },
    }));

    const success = await LocalEngineClient.pullOllamaModel(
      modelName,
      DEFAULT_OLLAMA_ENDPOINT,
      (pct, status) => {
        set((state: any) => ({
          downloadProgressMap: {
            ...state.downloadProgressMap,
            [modelName]: {
              percent: pct,
              status: status || "Downloading layers...",
              isDownloading: pct < 100,
            },
          },
        }));
      }
    );

    set((state: any) => ({
      downloadProgressMap: {
        ...state.downloadProgressMap,
        [modelName]: {
          percent: 100,
          status: success ? "Installed successfully" : "Download failed",
          isDownloading: false,
        },
      },
    }));

    await get().initModels();
    return success;
  },

  cancelModelDownload: (modelName: string) => {
    set((state: any) => {
      const nextMap = { ...state.downloadProgressMap };
      delete nextMap[modelName];
      return { downloadProgressMap: nextMap };
    });
  },

  clearDownloadEntry: (modelName: string) => {
    set((state: any) => {
      const nextMap = { ...state.downloadProgressMap };
      delete nextMap[modelName];
      return { downloadProgressMap: nextMap };
    });
  },

  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchModelQuery: (q) => set({ searchModelQuery: q }),
  setActiveModelId: (id) => set({ activeModelId: id }),
});
