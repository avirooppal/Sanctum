import { toast } from "sonner";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NavigationSlice, createNavigationSlice } from "./slices/navigationSlice";
import { ModelsSlice, createModelsSlice } from "./slices/modelsSlice";
import { ChatSlice, createChatSlice } from "./slices/chatSlice";
import { ArenaSlice, createArenaSlice } from "./slices/arenaSlice";
import { ResearchSlice, createResearchSlice } from "./slices/researchSlice";
import { RagSlice, createRagSlice } from "./slices/ragSlice";
import { TelemetrySlice, createTelemetrySlice } from "./slices/telemetrySlice";
import { AgentSlice, createAgentSlice } from "./slices/agentSlice";
import { globalVectorStore } from "../../core/ai/rag/vectorStore.ts";
import { globalMemoryStore } from "../../core/ai/memory/memory_store.ts";
import {
  clearVaultDb,
  hydrateVectorStoreFromVaultDb,
  stripHeavyPayloadsForLocalStorage,
} from "@/lib/vaultStorage";

export type AppState = NavigationSlice &
  ModelsSlice &
  ChatSlice &
  ArenaSlice &
  ResearchSlice &
  RagSlice &
  TelemetrySlice &
  AgentSlice & {
    resetAllData: () => void;
    exportPortableArchive: () => string;
    importPortableArchive: (json: string) => void;
  };

let storageReadable = true;
let pendingPersistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistEntry: { key: string; value: string } | null = null;

function flushPendingPersist() {
  if (pendingPersistTimer) {
    clearTimeout(pendingPersistTimer);
    pendingPersistTimer = null;
  }
  if (!pendingPersistEntry || typeof window === "undefined" || !storageReadable) return;
  const { key, value } = pendingPersistEntry;
  pendingPersistEntry = null;
  try {
    localStorage.setItem(key, value);
    toast.dismiss("storage-error");
  } catch {
    toast.error(
      "Workspace changes could not be saved. Export your chats before closing this tab, and free browser storage.",
      { id: "storage-error", duration: Infinity }
    );
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPendingPersist);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNavigationSlice(set, get, api),
      ...createModelsSlice(set, get, api),
      ...createChatSlice(set, get, api),
      ...createArenaSlice(set, get, api),
      ...createResearchSlice(set, get, api),
      ...createRagSlice(set, get, api),
      ...createTelemetrySlice(set, get, api),
      ...createAgentSlice(set, get, api),

      resetAllData: () => {
        try {
          get().stopInference?.();
          get().stopAgent?.();
          globalVectorStore.clear();
          globalMemoryStore.clear();
          void clearVaultDb();
        } catch {}

        set({
          hasCompletedOnboarding: false,
          activeModule: "chat",
          chatSessions: [
            {
              id: "chat-default",
              title: "New Chat",
              modelId: "",
              createdAt: "Just now",
              updatedAt: "Just now",
              systemPrompt: "You are a private local assistant running entirely on-device.",
              temperature: 0.7,
              topP: 0.9,
              messages: [],
            },
          ],
          activeSessionId: "chat-default",
          projects: [
            {
              id: "proj-default",
              name: "General Workspace",
              createdAt: "Just now",
            },
          ],
          activeProjectId: null,
          enableRagInChat: false,
          toolsEnabled: false,
          thinkEnabled: false,
          documents: [],
          dossiers: [],
          agentRuns: [],
          activeRunId: "",
        });

        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("sanctum-platform-state");
            localStorage.removeItem("sanctum-memory-store-v1");
            localStorage.clear();
          }
        } catch {}
      },

      exportPortableArchive: () => {
        const s = get();
        const archive = {
          format: "sanctum-portable-archive-v1",
          exportedAt: new Date().toISOString(),
          chatSessions: s.chatSessions,
          projects: s.projects,
          collections: s.collections,
          documents: s.documents,
          dossiers: s.dossiers,
          agentRuns: s.agentRuns,
          memory: globalMemoryStore.exportData(),
        };
        return JSON.stringify(archive, null, 2);
      },

      importPortableArchive: (json: string) => {
        const parsed = JSON.parse(json);
        if (parsed.memory) {
          globalMemoryStore.importData(parsed.memory);
        }
        set((state) => ({
          chatSessions: Array.isArray(parsed.chatSessions) && parsed.chatSessions.length
            ? parsed.chatSessions
            : state.chatSessions,
          activeSessionId: Array.isArray(parsed.chatSessions) && parsed.chatSessions[0]?.id
            ? parsed.chatSessions[0].id
            : state.activeSessionId,
          projects: Array.isArray(parsed.projects) ? parsed.projects : state.projects,
          collections: Array.isArray(parsed.collections) ? parsed.collections : state.collections,
          documents: Array.isArray(parsed.documents) ? parsed.documents : state.documents,
          dossiers: Array.isArray(parsed.dossiers) ? parsed.dossiers : state.dossiers,
          agentRuns: Array.isArray(parsed.agentRuns) ? parsed.agentRuns : state.agentRuns,
        }));
      },
    }),
    {
      name: "sanctum-platform-state",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          if (typeof window === "undefined") return null;
          try {
            const value = localStorage.getItem(key);
            if (value !== null) JSON.parse(value);
            storageReadable = true;
            return value;
          } catch {
            storageReadable = false;
            toast.error(
              "Saved workspace could not be read. Existing storage is preserved; new changes are not saved.",
              { id: "storage-error", duration: Infinity }
            );
            return null;
          }
        },
        setItem: (key, value) => {
          if (typeof window === "undefined") return;
          if (!storageReadable) return;
          pendingPersistEntry = { key, value };
          if (pendingPersistTimer) clearTimeout(pendingPersistTimer);
          pendingPersistTimer = setTimeout(flushPendingPersist, 500);
        },
        removeItem: (key) => {
          if (typeof window !== "undefined") localStorage.removeItem(key);
        },
      })),
      // Hydrate manually after mount so the first client render matches SSR (no hydration mismatch)
      skipHydration: true,
      partialize: (state) => {
        const stripped = stripHeavyPayloadsForLocalStorage(state.documents, state.chatSessions);
        return {
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        activeModule: state.activeModule,
        isExplorerCollapsed: state.isExplorerCollapsed,
        chatSessions: stripped.chatSessions,
        threadsRevision: state.threadsRevision,
        threadsUpdatedAt: state.threadsUpdatedAt,
        activeSessionId: state.activeSessionId,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        enableRagInChat: state.enableRagInChat,
        toolsEnabled: state.toolsEnabled,
        thinkEnabled: state.thinkEnabled,
        activeModelId: state.activeModelId,
        models: state.models,
        arenaPrompt: state.arenaPrompt,
        arenaSplitMode: state.arenaSplitMode,
        arenaPanes: state.arenaPanes,
        dossiers: state.dossiers,
        activeDossierId: state.activeDossierId,
        collections: state.collections,
        activeCollectionId: state.activeCollectionId,
        documents: stripped.documents,
        chunkSize: state.chunkSize,
        overlap: state.overlap,
        agentRuns: state.agentRuns,
        activeRunId: state.activeRunId,
        agentPrompt: state.agentPrompt,
        autonomyMode: state.autonomyMode,
        activePresetId: state.activePresetId,
      };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const docsWithLegacyChunks = (state.documents || []).filter((d) => d.chunks && d.chunks.length > 0);
          globalVectorStore.clear();
          setTimeout(() => {
            void hydrateVectorStoreFromVaultDb(docsWithLegacyChunks);
          }, 0);
          for (const session of state.chatSessions) {
            for (const message of session.messages) {
              if (
                message.requestStatus &&
                !["done", "error", "stopped", "cancelled"].includes(message.requestStatus.phase)
              ) {
                message.requestStatus = {
                  ...message.requestStatus,
                  phase: "stopped",
                  detail: "Generation interrupted by reload. Retry to continue.",
                };
              }
            }
          }
          state.initModels?.();
        }
      },
    }
  )
);

export * from "./slices/navigationSlice";
export * from "./slices/modelsSlice";
export * from "./slices/chatSlice";
export * from "./slices/arenaSlice";
export * from "./slices/researchSlice";
export * from "./slices/ragSlice";
export * from "./slices/telemetrySlice";
export * from "./slices/agentSlice";
