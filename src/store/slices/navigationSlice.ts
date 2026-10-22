import { StateCreator } from "zustand";
import { NavModule } from "@/types";

export interface NavigationSlice {
  activeModule: NavModule;
  isExplorerCollapsed: boolean;
  isTelemetryExpanded: boolean;
  hasCompletedOnboarding: boolean;
  setActiveModule: (module: NavModule) => void;
  toggleExplorer: () => void;
  toggleTelemetryDock: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const createNavigationSlice: StateCreator<any, [], [], NavigationSlice> = (set) => ({
  activeModule: "chat",
  isExplorerCollapsed: false,
  isTelemetryExpanded: false,
  hasCompletedOnboarding: false,
  setActiveModule: (module) => set({ activeModule: module }),
  toggleExplorer: () => set((state: any) => ({ isExplorerCollapsed: !state.isExplorerCollapsed })),
  toggleTelemetryDock: () => set((state: any) => ({ isTelemetryExpanded: !state.isTelemetryExpanded })),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  resetOnboarding: () => set({ hasCompletedOnboarding: false }),
});
