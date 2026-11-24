import { StateCreator } from "zustand";

export interface WorkspaceSettingsOverrides {
  defaultModel?: string;
  autonomyCeiling?: string;
  a2uiMode?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  color: string;
  icon: string;
  rootPath: string | null;
  rootStatus: "ok" | "missing" | "chat_only";
  archived: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  settingsOverrides?: WorkspaceSettingsOverrides;
}

export interface AttentionInboxItem {
  kind: string;
  approvalId: string;
  sessionId: string;
  runId: string;
  callId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  tool: string;
  riskClass: string;
  cardText: string;
}

export interface AttentionInbox {
  totalRunning: number;
  totalAttention: number;
  byWorkspace: Record<string, { runningCount: number; attentionCount: number }>;
  items: AttentionInboxItem[];
}

export interface WorkspaceSlice {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  attentionInbox: AttentionInbox;
  isWorkspaceSwitcherOpen: boolean;
  setWorkspaceSwitcherOpen: (open: boolean) => void;
  loadWorkspaces: () => Promise<void>;
  refreshAttentionInbox: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (opts: {
    name: string;
    rootPath?: string | null;
    color?: string;
    icon?: string;
    copySettingsFromId?: string;
  }) => Promise<{ ok: boolean; workspace?: WorkspaceSummary; error?: string; code?: string; existingWorkspaceId?: string; warnings?: string[] }>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  relocateWorkspace: (id: string, rootPath: string) => Promise<{ ok: boolean; error?: string }>;
  togglePinWorkspace: (id: string, pinned: boolean) => Promise<boolean>;
  archiveWorkspace: (id: string, archived?: boolean) => Promise<boolean>;
}

const EMPTY_INBOX: AttentionInbox = {
  totalRunning: 0,
  totalAttention: 0,
  byWorkspace: {},
  items: [],
};

function notifyHostWorkspaceTitle(name: string) {
  if (typeof window === "undefined") return;
  const label = name ? `Sanctum — ${name}` : "Sanctum";
  try {
    document.title = label;
    (window as any).chrome?.webview?.postMessage(
      JSON.stringify({ type: "setWorkspaceTitle", name: name || "" })
    );
  } catch {
    // non-WebView2 dev mode
  }
}

export const createWorkspaceSlice: StateCreator<any, [], [], WorkspaceSlice> = (set, get) => ({
  workspaces: [],
  activeWorkspaceId: "",
  attentionInbox: EMPTY_INBOX,
  isWorkspaceSwitcherOpen: false,

  setWorkspaceSwitcherOpen: (open) => set({ isWorkspaceSwitcherOpen: open }),

  loadWorkspaces: async () => {
    try {
      const res = await fetch("/v1/workspaces");
      if (!res.ok) return;
      const data = await res.json();
      const list: WorkspaceSummary[] = Array.isArray(data?.workspaces) ? data.workspaces : [];
      const currentActive = get().activeWorkspaceId;
      const nextActive =
        (currentActive && list.some((w) => w.id === currentActive) ? currentActive : "") ||
        data?.lastUsedWorkspaceId ||
        list[0]?.id ||
        "";
      set({ workspaces: list, activeWorkspaceId: nextActive });
      const activeWs = list.find((w) => w.id === nextActive);
      if (activeWs) notifyHostWorkspaceTitle(activeWs.name);
    } catch {
      // non-blocking when daemon not attached
    }
  },

  refreshAttentionInbox: async () => {
    try {
      const res = await fetch("/v1/attention");
      if (!res.ok) return;
      const data = await res.json();
      set({
        attentionInbox: {
          totalRunning: Number(data?.totalRunning || 0),
          totalAttention: Number(data?.totalAttention || 0),
          byWorkspace: data?.byWorkspace || {},
          items: Array.isArray(data?.items) ? data.items : [],
        },
      });
    } catch {
      // ignore
    }
  },

  switchWorkspace: async (workspaceId: string) => {
    const prevId = get().activeWorkspaceId;
    const target = (get().workspaces as WorkspaceSummary[]).find((w) => w.id === workspaceId);
    if (!target) return;

    // 1. Instant client-side view switch (no reload, never interrupts active runs)
    set({ activeWorkspaceId: workspaceId, isWorkspaceSwitcherOpen: false });
    notifyHostWorkspaceTitle(target.name);

    // 2. Persist outgoing workspace UI state to host asynchronously
    if (prevId && prevId !== workspaceId) {
      const st = get();
      fetch(`/v1/workspaces/${encodeURIComponent(prevId)}/ui-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeSessionId: st.activeSessionId || "",
          splitSessionId: st.splitSessionId || "",
          projects: st.projects || [],
        }),
      }).catch(() => {});
    }

    // 3. Touch lastOpenedAt and restore incoming workspace UI state from host
    fetch(`/v1/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ touchOpened: true }),
    }).catch(() => {});

    try {
      const uiRes = await fetch(`/v1/workspaces/${encodeURIComponent(workspaceId)}/ui-state`);
      if (uiRes.ok) {
        const ui = await uiRes.json();
        if (Array.isArray(ui?.projects) && ui.projects.length > 0) {
          set({ projects: ui.projects });
        }
        if (typeof ui?.activeSessionId === "string" && ui.activeSessionId) {
          const exists = (get().chatSessions || []).some((s: any) => s.id === ui.activeSessionId);
          if (exists) set({ activeSessionId: ui.activeSessionId });
        }
      }
    } catch {
      // non-blocking
    }
  },

  createWorkspace: async (opts) => {
    try {
      const res = await fetch("/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data?.error || "Could not create workspace.",
          code: data?.code,
          existingWorkspaceId: data?.existingWorkspaceId,
        };
      }
      await get().loadWorkspaces();
      if (data?.id) await get().switchWorkspace(data.id);
      return { ok: true, workspace: data, warnings: data?.warnings || [] };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  },

  renameWorkspace: async (id, name) => {
    try {
      const res = await fetch(`/v1/workspaces/${encodeURIComponent(id)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return false;
      await get().loadWorkspaces();
      return true;
    } catch {
      return false;
    }
  },

  relocateWorkspace: async (id, rootPath) => {
    try {
      const res = await fetch(`/v1/workspaces/${encodeURIComponent(id)}/relocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data?.error || "Relocate failed." };
      await get().loadWorkspaces();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Relocate failed." };
    }
  },

  togglePinWorkspace: async (id, pinned) => {
    try {
      const res = await fetch(`/v1/workspaces/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) return false;
      await get().loadWorkspaces();
      return true;
    } catch {
      return false;
    }
  },

  archiveWorkspace: async (id, archived = true) => {
    try {
      const res = await fetch(`/v1/workspaces/${encodeURIComponent(id)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) return false;
      await get().loadWorkspaces();
      return true;
    } catch {
      return false;
    }
  },
});
