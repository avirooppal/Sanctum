import { create } from "zustand";
import { NavigationSlice, createNavigationSlice } from "./slices/navigationSlice";
import { ModelsSlice, createModelsSlice } from "./slices/modelsSlice";
import { ChatSlice, createChatSlice } from "./slices/chatSlice";
import { ArenaSlice, createArenaSlice } from "./slices/arenaSlice";
import { ResearchSlice, createResearchSlice } from "./slices/researchSlice";
import { RagSlice, createRagSlice } from "./slices/ragSlice";
import { TelemetrySlice, createTelemetrySlice } from "./slices/telemetrySlice";

export type AppState = NavigationSlice &
  ModelsSlice &
  ChatSlice &
  ArenaSlice &
  ResearchSlice &
  RagSlice &
  TelemetrySlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createNavigationSlice(...a),
  ...createModelsSlice(...a),
  ...createChatSlice(...a),
  ...createArenaSlice(...a),
  ...createResearchSlice(...a),
  ...createRagSlice(...a),
  ...createTelemetrySlice(...a),
}));

export * from "./slices/navigationSlice";
export * from "./slices/modelsSlice";
export * from "./slices/chatSlice";
export * from "./slices/arenaSlice";
export * from "./slices/researchSlice";
export * from "./slices/ragSlice";
export * from "./slices/telemetrySlice";
