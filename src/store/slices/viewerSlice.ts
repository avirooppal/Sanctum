import type { StateCreator } from "zustand";

export interface ViewerTab {
  id: string;
  path: string;
  title: string;
  mode: "preview" | "raw";
  allowScripts?: boolean;
  allowRemoteImages?: boolean;
  dirtyContent?: string | null;
  diskRevision?: string;
  changedOnDisk?: boolean;
  jumpLine?: number;
  refreshCounter: number;
}

export interface DeliverableItem {
  id: string;
  path: string;
  title: string;
  timestamp: string;
  sessionId?: string;
}

export interface ViewerSlice {
  isViewerOpen: boolean;
  viewerWidth: number;
  isTreeOpen: boolean;
  showIgnoredFiles: boolean;
  treeSearchQuery: string;
  viewerTabs: ViewerTab[];
  activeViewerTabId: string | null;
  deliverables: DeliverableItem[];
  activeDiffCheckpointId: string | null;

  openFileTab: (
    filePath: string,
    opts?: {
      title?: string;
      mode?: "preview" | "raw";
      line?: number;
      addDeliverable?: boolean;
      sessionId?: string;
    }
  ) => void;
  closeViewerTab: (tabId: string) => void;
  setActiveViewerTab: (tabId: string) => void;
  reorderViewerTabs: (fromIndex: number, toIndex: number) => void;
  updateViewerTab: (tabId: string, patch: Partial<ViewerTab>) => void;
  refreshViewerTab: (tabId: string) => void;
  setIsViewerOpen: (open: boolean) => void;
  toggleViewer: () => void;
  setViewerWidth: (width: number) => void;
  setIsTreeOpen: (open: boolean) => void;
  toggleTree: () => void;
  setShowIgnoredFiles: (show: boolean) => void;
  setTreeSearchQuery: (q: string) => void;
  setActiveDiffCheckpointId: (cpId: string | null) => void;
  markPathChangedOnDisk: (relPath: string) => void;
}

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function getBaseName(p: string): string {
  const norm = normalizeRelPath(p);
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] || norm;
}

export const createViewerSlice: StateCreator<any, [], [], ViewerSlice> = (set, get) => ({
  isViewerOpen: false,
  viewerWidth: 560,
  isTreeOpen: true,
  showIgnoredFiles: true,
  treeSearchQuery: "",
  viewerTabs: [],
  activeViewerTabId: null,
  deliverables: [],
  activeDiffCheckpointId: null,

  openFileTab: (filePath, opts) => {
    const normPath = normalizeRelPath(filePath);
    if (!normPath) return;

    const existing = (get().viewerTabs as ViewerTab[]).find(
      (t) => t.path.toLowerCase() === normPath.toLowerCase()
    );

    if (existing) {
      set((state: any) => ({
        isViewerOpen: true,
        activeViewerTabId: existing.id,
        viewerTabs: state.viewerTabs.map((t: ViewerTab) =>
          t.id === existing.id
            ? {
                ...t,
                ...(opts?.mode ? { mode: opts.mode } : {}),
                ...(opts?.line !== undefined ? { jumpLine: opts.line } : {}),
                refreshCounter: t.refreshCounter + 1,
              }
            : t
        ),
        deliverables: opts?.addDeliverable
          ? [
              {
                id: `deliv-${Date.now()}`,
                path: normPath,
                title: opts.title || getBaseName(normPath),
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                sessionId: opts.sessionId || state.activeSessionId,
              },
              ...state.deliverables.filter(
                (d: DeliverableItem) => d.path.toLowerCase() !== normPath.toLowerCase()
              ),
            ]
          : state.deliverables,
      }));
      return;
    }

    const newTab: ViewerTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      path: normPath,
      title: opts?.title || getBaseName(normPath),
      mode: opts?.mode || "preview",
      allowScripts: false,
      allowRemoteImages: false,
      dirtyContent: null,
      changedOnDisk: false,
      jumpLine: opts?.line,
      refreshCounter: 0,
    };

    set((state: any) => ({
      isViewerOpen: true,
      viewerTabs: [...state.viewerTabs, newTab],
      activeViewerTabId: newTab.id,
      deliverables: opts?.addDeliverable
        ? [
            {
              id: `deliv-${Date.now()}`,
              path: normPath,
              title: opts.title || getBaseName(normPath),
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              sessionId: opts.sessionId || state.activeSessionId,
            },
            ...state.deliverables.filter(
              (d: DeliverableItem) => d.path.toLowerCase() !== normPath.toLowerCase()
            ),
          ]
        : state.deliverables,
    }));
  },

  closeViewerTab: (tabId) =>
    set((state: any) => {
      const idx = state.viewerTabs.findIndex((t: ViewerTab) => t.id === tabId);
      if (idx === -1) return state;
      const nextTabs = state.viewerTabs.filter((t: ViewerTab) => t.id !== tabId);
      let nextActive = state.activeViewerTabId;
      if (state.activeViewerTabId === tabId) {
        const neighbor = nextTabs[Math.min(idx, nextTabs.length - 1)];
        nextActive = neighbor ? neighbor.id : null;
      }
      return {
        viewerTabs: nextTabs,
        activeViewerTabId: nextActive,
      };
    }),

  setActiveViewerTab: (tabId) => set({ activeViewerTabId: tabId, isViewerOpen: true }),

  reorderViewerTabs: (fromIndex, toIndex) =>
    set((state: any) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.viewerTabs.length ||
        toIndex >= state.viewerTabs.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const next = [...state.viewerTabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { viewerTabs: next };
    }),

  updateViewerTab: (tabId, patch) =>
    set((state: any) => ({
      viewerTabs: state.viewerTabs.map((t: ViewerTab) =>
        t.id === tabId ? { ...t, ...patch } : t
      ),
    })),

  refreshViewerTab: (tabId) =>
    set((state: any) => ({
      viewerTabs: state.viewerTabs.map((t: ViewerTab) =>
        t.id === tabId
          ? { ...t, changedOnDisk: false, refreshCounter: t.refreshCounter + 1 }
          : t
      ),
    })),

  setIsViewerOpen: (open) => set({ isViewerOpen: open }),
  toggleViewer: () => set((state: any) => ({ isViewerOpen: !state.isViewerOpen })),
  setViewerWidth: (width) => set({ viewerWidth: Math.max(320, Math.min(960, width)) }),
  setIsTreeOpen: (open) => set({ isTreeOpen: open }),
  toggleTree: () => set((state: any) => ({ isTreeOpen: !state.isTreeOpen })),
  setShowIgnoredFiles: (show) => set({ showIgnoredFiles: show }),
  setTreeSearchQuery: (q) => set({ treeSearchQuery: q }),
  setActiveDiffCheckpointId: (cpId) => set({ activeDiffCheckpointId: cpId }),

  markPathChangedOnDisk: (relPath) => {
    const norm = normalizeRelPath(relPath).toLowerCase();
    set((state: any) => ({
      viewerTabs: state.viewerTabs.map((t: ViewerTab) => {
        if (t.path.toLowerCase() !== norm) return t;
        const hasUnsaved = t.dirtyContent !== null && t.dirtyContent !== undefined;
        return hasUnsaved
          ? { ...t, changedOnDisk: true }
          : { ...t, changedOnDisk: false, refreshCounter: t.refreshCounter + 1 };
      }),
    }));
  },
});
