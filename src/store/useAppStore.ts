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
import { globalVectorStore } from "@/lib/vectorStore";

export type AppState = NavigationSlice &
  ModelsSlice &
  ChatSlice &
  ArenaSlice &
  ResearchSlice &
  RagSlice &
  TelemetrySlice &
  AgentSlice;

let storageReadable = true;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createNavigationSlice(...a),
      ...createModelsSlice(...a),
      ...createChatSlice(...a),
      ...createArenaSlice(...a),
      ...createResearchSlice(...a),
      ...createRagSlice(...a),
      ...createTelemetrySlice(...a),
      ...createAgentSlice(...a),
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
          }
          catch { storageReadable = false; toast.error("Saved workspace could not be read. Existing storage is preserved; new changes are not saved.", { id: "storage-error", duration: Infinity }); return null; }
        },
        setItem: (key, value) => {
          if (typeof window === "undefined") return;
          if (!storageReadable) return;
          try { localStorage.setItem(key, value); toast.dismiss("storage-error"); }
          catch { toast.error("Workspace changes could not be saved. Export your chats before closing this tab, and free browser storage.", { id: "storage-error", duration: Infinity }); }
        },
        removeItem: (key) => { if (typeof window !== "undefined") localStorage.removeItem(key); },
      })),
      // Hydrate manually after mount so the first client render matches SSR (no hydration mismatch)
      skipHydration: true,
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        activeModule: state.activeModule,
        isExplorerCollapsed: state.isExplorerCollapsed,
        chatSessions: state.chatSessions,
        activeSessionId: state.activeSessionId,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        enableRagInChat: state.enableRagInChat,
        toolsEnabled: state.toolsEnabled,
        activeModelId: state.activeModelId,
        models: state.models,
        arenaPrompt: state.arenaPrompt,
        arenaSplitMode: state.arenaSplitMode,
        arenaPanes: state.arenaPanes,
        dossiers: state.dossiers,
        activeDossierId: state.activeDossierId,
        collections: state.collections,
        activeCollectionId: state.activeCollectionId,
        documents: state.documents,
        chunkSize: state.chunkSize,
        overlap: state.overlap,
        agentRuns: state.agentRuns,
        activeRunId: state.activeRunId,
        agentPrompt: state.agentPrompt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.documents && state.documents.length > 0) {
          globalVectorStore.clear();
          state.documents.forEach((doc) => {
            if (doc.chunks && doc.chunks.length > 0) {
              doc.chunks.forEach((c) => {
                globalVectorStore.addRawChunk({
                  id: c.id,
                  docId: c.docId,
                  docName: doc.name,
                  chunkIndex: c.chunkIndex,
                  content: c.content,
                  tokenCount: c.tokenCount,
                  vector: globalVectorStore.generateEmbedding(c.content),
                });
              });
            }
          });
        }
        if (state) {
          for (const session of state.chatSessions) {
            for (const message of session.messages) {
              if (message.requestStatus && !["done", "error", "stopped", "cancelled"].includes(message.requestStatus.phase)) {
                message.requestStatus = { ...message.requestStatus, phase: "stopped", detail: "Generation interrupted by reload. Retry to continue." };
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
