import { StateCreator } from "zustand";
import { LocalModel, ModelCategory } from "@/types";
import { LocalEngineClient } from "@/lib/engine";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export interface ModelsSlice {
  models: LocalModel[];
  selectedCategory: ModelCategory;
  searchModelQuery: string;
  activeModelId: string;
  isFetchingModels: boolean;
  isConfigModalOpen: boolean;
  selectedModelForConfig: LocalModel | null;

  initModels: () => Promise<void>;
  openConfigModal: (model: LocalModel) => void;
  closeConfigModal: () => void;
  updateModelConfig: (modelId: string, newConfig: Partial<LocalModel["config"]>) => void;
  toggleModelLoad: (modelId: string) => void;
  startModelDownload: (modelName: string) => Promise<void>;
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

  initModels: async () => {
    set({ isFetchingModels: true });
    try {
      const realModels = await LocalEngineClient.fetchOllamaModels(DEFAULT_OLLAMA_ENDPOINT);
      if (realModels.length > 0) {
        const activeId = realModels[0].id;
        set((state: any) => ({
          models: realModels,
          activeModelId: activeId,
          isFetchingModels: false,
          chatSessions: state.chatSessions.map((s: any) => ({ ...s, modelId: activeId })),
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
      models: [
        ...state.models,
        {
          id: modelName,
          name: modelName,
          author: "Ollama Registry",
          description: `Pulling ${modelName} from Ollama registry...`,
          parameters: "Downloading...",
          category: "general",
          quantization: "Q4_K_M",
          availableQuantizations: ["Q4_K_M"],
          contextWindow: 32768,
          ramRequiredGB: 4.0,
          vramRequiredGB: 4.0,
          fileSizeGB: 4.0,
          downloaded: false,
          downloadProgress: 1,
          isLoaded: false,
          architecture: "llama",
          config: {
            gpuLayers: 33,
            maxGpuLayers: 64,
            contextSize: 32768,
            threads: 8,
            temperature: 0.7,
            topP: 0.9,
            repeatPenalty: 1.05,
            flashAttention: true,
            mlock: true,
            numa: false,
          },
        },
      ],
    }));

    await LocalEngineClient.pullOllamaModel(modelName, DEFAULT_OLLAMA_ENDPOINT, (pct) => {
      set((state: any) => ({
        models: state.models.map((m: LocalModel) =>
          m.id === modelName ? { ...m, downloadProgress: pct, downloaded: pct >= 100 } : m
        ),
      }));
    });

    await get().initModels();
  },

  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchModelQuery: (q) => set({ searchModelQuery: q }),
  setActiveModelId: (id) => set({ activeModelId: id }),
});
