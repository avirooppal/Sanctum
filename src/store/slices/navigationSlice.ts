import { StateCreator } from "zustand";
import { NavModule } from "@/types";

export interface NavigationSlice {
  activeModule: NavModule;
  isExplorerCollapsed: boolean;
  isTelemetryExpanded: boolean;
  hasCompletedOnboarding: boolean;
  userName: string;
  setActiveModule: (module: NavModule) => void;
  toggleExplorer: () => void;
  toggleTelemetryDock: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setUserName: (name: string) => void;
}

export const createNavigationSlice: StateCreator<any, [], [], NavigationSlice> = (set) => ({
  activeModule: "chat",
  isExplorerCollapsed: false,
  isTelemetryExpanded: false,
  hasCompletedOnboarding: false,
  userName: "",
  setActiveModule: (module) => set({ activeModule: module }),
  toggleExplorer: () => set((state: any) => ({ isExplorerCollapsed: !state.isExplorerCollapsed })),
  toggleTelemetryDock: () => set((state: any) => ({ isTelemetryExpanded: !state.isTelemetryExpanded })),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  resetOnboarding: () => set({ hasCompletedOnboarding: false }),
  setUserName: (name) => set({ userName: (name || "").trim().slice(0, 80) }),
});
