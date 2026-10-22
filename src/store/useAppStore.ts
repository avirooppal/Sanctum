import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NavigationSlice, createNavigationSlice } from "./slices/navigationSlice";
import { ModelsSlice, createModelsSlice } from "./slices/modelsSlice";
import { ChatSlice, createChatSlice } from "./slices/chatSlice";
import { ArenaSlice, createArenaSlice } from "./slices/arenaSlice";
import { ResearchSlice, createResearchSlice } from "./slices/researchSlice";
import { RagSlice, createRagSlice } from "./slices/ragSlice";
import { TelemetrySlice, createTelemetrySlice } from "./slices/telemetrySlice";
import { globalVectorStore } from "@/lib/vectorStore";

export type AppState = NavigationSlice &
  ModelsSlice &
  ChatSlice &
  ArenaSlice &
  ResearchSlice &
  RagSlice &
  TelemetrySlice;

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
    }),
    {
      name: "sanctum-platform-state",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : ({} as any))),
      // Hydrate manually after mount so the first client render matches SSR (no hydration mismatch)
      skipHydration: true,
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        activeModule: state.activeModule,
        isExplorerCollapsed: state.isExplorerCollapsed,
        chatSessions: state.chatSessions,
        activeSessionId: state.activeSessionId,
        enableRagInChat: state.enableRagInChat,
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
