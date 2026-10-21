import { StateCreator } from "zustand";
import { NavModule } from "@/types";

export interface NavigationSlice {
  activeModule: NavModule;
  isExplorerCollapsed: boolean;
  isTelemetryExpanded: boolean;
  setActiveModule: (module: NavModule) => void;
  toggleExplorer: () => void;
  toggleTelemetryDock: () => void;
}

export const createNavigationSlice: StateCreator<any, [], [], NavigationSlice> = (set) => ({
  activeModule: "hub",
  isExplorerCollapsed: false,
  isTelemetryExpanded: false,
  setActiveModule: (module) => set({ activeModule: module }),
  toggleExplorer: () => set((state: any) => ({ isExplorerCollapsed: !state.isExplorerCollapsed })),
  toggleTelemetryDock: () => set((state: any) => ({ isTelemetryExpanded: !state.isTelemetryExpanded })),
});
