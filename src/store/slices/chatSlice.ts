import type { StateCreator } from "zustand";
import type { ChatSession, ChatMessage, ChatProject, RequestStatusEvent } from "../../../contracts/types/index.ts";
import { reconcileThreadSnapshots } from "../../../core/domain/threads.ts";
import { saveImageToVaultDb } from "../../lib/vaultStorage.ts";
import { globalVectorStore } from "../../../core/ai/rag/vectorStore.ts";
import { globalMemoryStore, LocalMemoryStore } from "../../../core/ai/memory/memory_store.ts";
import { RequestStatusTracker } from "../../../core/ai/request_status.ts";
import {
  probeHarness,
  listHarnessSessions,
  getHarnessSession,
  interruptHarnessRun,
  streamHarnessEvents,
  streamHarnessChat,
  type ToolApprovalResponse,
  type ToolActivity,
} from "../../lib/harnessClient.ts";

export interface PendingToolApproval {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  resolve: (res: ToolApprovalResponse) => void;
}

export interface AttachedDoc {
  name: string;
  size: number;
  content: string;
}

export interface ChatSlice {
  chatSessions: ChatSession[];
  threadsRevision: number;
  threadsUpdatedAt: number;
  activeSessionId: string;
  splitSessionId: string | null;
  projects: ChatProject[];
  activeProjectId: string | null;
  enableRagInChat: boolean;
  toolsEnabled: boolean;
  thinkEnabled: boolean;
  thinkingEffort: "off" | "low" | "medium" | "high";
  agentExecutionMode: "fast" | "plan";
  autoVerifyEnabled: boolean;
  pendingPlanApproval: { sessionId: string; planPath: string; originalPrompt: string } | null;
  setToolsEnabled: (enabled: boolean) => void;
  setThinkEnabled: (enabled: boolean) => void;
  setThinkingEffort: (effort: "off" | "low" | "medium" | "high") => void;
  setAgentExecutionMode: (mode: "fast" | "plan") => void;
  setAutoVerifyEnabled: (enabled: boolean) => void;
  approvePlanAndExecute: () => Promise<void>;
  dismissPlanApproval: () => void;
  attachedImage: { src: string; name: string; width: number; height: number } | null;
  attachedDocuments: AttachedDoc[];
  activeTracker: RequestStatusTracker | null;
  activeAbortController: AbortController | null;
  activeTrackersBySession: Record<string, RequestStatusTracker>;
  activeAbortControllersBySession: Record<string, AbortController>;
  pendingToolApproval: PendingToolApproval | null;
  resolveToolApproval: (decision: "approved" | "denied", scope?: "once" | "session", approvalToken?: string) => void;
  toggleMessageBookmark: (sessionId: string, messageId: string) => void;

  setActiveSessionId: (id: string) => void;
  setSplitSessionId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  createNewChatSession: (projectId?: string) => void;
  deleteChatSession: (id: string) => void;
  renameChatSession: (id: string, title: string) => void;
  togglePinChatSession: (id: string) => void;
  moveChatToProject: (chatId: string, projectId?: string) => void;
  duplicateChatSession: (id: string) => void;
  clearChatMessages: (id: string) => void;
  deleteChatMessage: (sessionId: string, messageId: string) => void;
  deleteAllChatSessions: () => void;
  updateSessionParams: (sessionId: string, params: Partial<Pick<ChatSession, "systemPrompt" | "temperature" | "topP" | "modelId">>) => void;
  createProject: (name: string, assistantId?: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  setEnableRagInChat: (enabled: boolean) => void;
  setAttachedImage: (img: { src: string; name: string; width: number; height: number } | null) => void;
  addAttachedDocument: (doc: AttachedDoc) => void;
  removeAttachedDocument: (name: string) => void;
  sendMessage: (content: string, targetSessionId?: string, overrideAttachments?: AttachedDoc[]) => Promise<void>;
  stopInference: (targetSessionId?: string) => void;
  regenerateLastMessage: () => void;
  syncThreadsFromHost: () => Promise<void>;
}

const syncThreadsToBackend = (sessions: ChatSession[], revision: number = 1, updatedAt: number = Date.now()) => {
  if (typeof window === "undefined" || !(window as any).chrome?.webview) return;
  fetch("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, updatedAt, sessions }),
  }).catch(() => {});
};

const requestHostApprovalToken = (toolName: string): Promise<string | undefined> => {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  const wv = (window as any).chrome?.webview;
  if (!wv?.postMessage || !wv?.addEventListener) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const requestId = `tok-${crypto.randomUUID()}`;
    const timer = setTimeout(() => {
      wv.removeEventListener("message", onMsg);
      resolve(undefined);
    }, 2000);
    const onMsg = (event: { data: unknown }) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : (event.data as any);
        if (msg?.type === "approvalTokenIssued" && msg.requestId === requestId) {
          clearTimeout(timer);
          wv.removeEventListener("message", onMsg);
          resolve(typeof msg.token === "string" ? msg.token : undefined);
        }
      } catch {}
    };
    wv.addEventListener("message", onMsg);
    wv.postMessage(JSON.stringify({ type: "requestApprovalToken", requestId, toolName }));
  });
};

export const createChatSlice: StateCreator<any, [], [], ChatSlice> = (set, get) => ({
  chatSessions: [
    {
      id: "chat-default",
      title: "Local Inference Session",
      modelId: "",
      createdAt: "Today",
      updatedAt: "Just now",
      systemPrompt: "You are a private local assistant running entirely on-device.",
      temperature: 0.7,
      topP: 0.9,
      messages: [],
    },
  ],
  threadsRevision: 0,
  threadsUpdatedAt: 0,
  activeSessionId: "chat-default",
  splitSessionId: null,
  projects: [
    {
      id: "proj-default",
      name: "General Workspace",
      createdAt: "Today",
    },
  ],
  activeProjectId: null,
  enableRagInChat: false,
  toolsEnabled: false,
  thinkEnabled: false,
  thinkingEffort: "off",
  agentExecutionMode: "fast",
  autoVerifyEnabled: true,
  pendingPlanApproval: null,
  setToolsEnabled: (enabled) => set({ toolsEnabled: enabled }),
  setThinkEnabled: (enabled) =>
    set((state: any) => ({
      thinkEnabled: enabled,
      thinkingEffort: enabled ? (state.thinkingEffort === "off" ? "medium" : state.thinkingEffort) : "off",
    })),
  setThinkingEffort: (effort) =>
    set({
      thinkingEffort: effort,
      thinkEnabled: effort !== "off",
    }),
  setAgentExecutionMode: (mode) =>
    set((state: any) => ({
      agentExecutionMode: mode,
      toolsEnabled: mode === "plan" ? true : state.toolsEnabled,
    })),
  setAutoVerifyEnabled: (enabled) => set({ autoVerifyEnabled: enabled }),
  approvePlanAndExecute: async () => {
    const pending = get().pendingPlanApproval;
    set({ pendingPlanApproval: null, agentExecutionMode: "fast", toolsEnabled: true });
    const planPath = pending?.planPath || "PLAN.md";
    await get().sendMessage(`Approved ${planPath}. Proceed to execute the plan step by step.`);
  },
  dismissPlanApproval: () => set({ pendingPlanApproval: null }),
  attachedImage: null,
  attachedDocuments: [],
  activeTracker: null,
  activeAbortController: null,
  activeTrackersBySession: {},
  activeAbortControllersBySession: {},
  pendingToolApproval: null,
  resolveToolApproval: (decision, scope = "once", approvalToken) => {
    const pending = get().pendingToolApproval;
    if (!pending) return;
    set({ pendingToolApproval: null });
    if (decision === "approved" && !approvalToken) {
      void requestHostApprovalToken(pending.toolName).then((tok) => {
        pending.resolve({ decision, scope, approvalToken: tok });
      });
      return;
    }
    pending.resolve({ decision, scope, approvalToken });
  },
  toggleMessageBookmark: (sessionId, messageId) =>
    set((state: any) => ({
      chatSessions: state.chatSessions.map((s: ChatSession) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
              ),
            }
          : s
      ),
    })),

  setActiveSessionId: (id) => {
    const session = get().chatSessions.find((s: ChatSession) => s.id === id);
    if (session) set({ activeSessionId: id, activeModelId: session.modelId });
  },
  setSplitSessionId: (id) => set({ splitSessionId: id }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setEnableRagInChat: (enabled) => set({ enableRagInChat: enabled }),
  setAttachedImage: (img) => set({ attachedImage: img }),
  addAttachedDocument: (doc) =>
    set((state: any) => ({
      attachedDocuments: [...state.attachedDocuments.filter((d: AttachedDoc) => d.name !== doc.name), doc],
    })),
  removeAttachedDocument: (name) =>
    set((state: any) => ({
      attachedDocuments: state.attachedDocuments.filter((d: AttachedDoc) => d.name !== name),
    })),

  createNewChatSession: (projectId) => {
    const newId = `chat-${crypto.randomUUID()}`;
    const targetProject = projectId !== undefined ? projectId : get().activeProjectId || undefined;
    const fallbackModel = get().activeModelId || get().models[0]?.id || "";
    const newSession: ChatSession = {
      id: newId,
      title: "New Chat",
      modelId: fallbackModel,
      createdAt: "Just now",
      updatedAt: "Just now",
      systemPrompt: "You are a private local assistant running entirely on-device.",
      temperature: 0.7,
      topP: 0.9,
      projectId: targetProject,
      pinned: false,
      messages: [],
    };
    set((state: any) => {
      const updated = [newSession, ...state.chatSessions];
      syncThreadsToBackend(updated);
      return {
        chatSessions: updated,
        activeSessionId: newId,
      };
    });
  },

  deleteChatSession: (id) =>
    set((state: any) => {
      const filtered = state.chatSessions.filter((s: ChatSession) => s.id !== id);
      if (filtered.length === 0) {
        const fallbackId = `chat-${crypto.randomUUID()}`;
        const fallbackModel = state.activeModelId || state.models[0]?.id || "";
        const fallback: ChatSession = {
          id: fallbackId,
          title: "New Chat",
          modelId: fallbackModel,
          createdAt: "Just now",
          updatedAt: "Just now",
          systemPrompt: "You are a private local assistant running entirely on-device.",
          temperature: 0.7,
          topP: 0.9,
          messages: [],
        };
        syncThreadsToBackend([fallback]);
        return {
          chatSessions: [fallback],
          activeSessionId: fallbackId,
        };
      }
      syncThreadsToBackend(filtered);
      return {
        chatSessions: filtered,
        activeSessionId: state.activeSessionId === id ? filtered[0].id : state.activeSessionId,
        activeModelId: state.activeSessionId === id ? filtered[0].modelId : state.activeModelId,
      };
    }),

  renameChatSession: (id, title) =>
    set((state: any) => {
      const trimmed = title.trim();
      if (!trimmed) return state;
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === id ? { ...s, title: trimmed, updatedAt: "Just now" } : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    }),

  togglePinChatSession: (id) =>
    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === id ? { ...s, pinned: !s.pinned } : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    }),

  moveChatToProject: (chatId, projectId) =>
    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === chatId ? { ...s, projectId: projectId || undefined, updatedAt: "Just now" } : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    }),

  duplicateChatSession: (id) =>
    set((state: any) => {
      const target = state.chatSessions.find((s: ChatSession) => s.id === id);
      if (!target) return state;
      const copyId = `chat-${crypto.randomUUID()}`;
      const copy: ChatSession = {
        ...target,
        id: copyId,
        title: `${target.title} (Copy)`,
        createdAt: "Just now",
        updatedAt: "Just now",
        messages: target.messages.map((m: ChatMessage, idx: number) => ({ ...m, id: `msg-${Date.now()}-${idx}` })),
      };
      const updated = [copy, ...state.chatSessions];
      syncThreadsToBackend(updated);
      return {
        chatSessions: updated,
        activeSessionId: copyId,
        activeModelId: copy.modelId,
      };
    }),

  clearChatMessages: (id) =>
    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === id ? { ...s, messages: [], updatedAt: "Just now" } : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    }),

  deleteChatMessage: (sessionId, messageId) =>
    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === sessionId
          ? { ...s, messages: s.messages.filter((m) => m.id !== messageId), updatedAt: "Just now" }
          : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    }),

  deleteAllChatSessions: () =>
    set((state: any) => {
      const freshId = `chat-${crypto.randomUUID()}`;
      const freshModel = state.activeModelId || state.models[0]?.id || "";
      const fresh: ChatSession = {
        id: freshId,
        title: "New Chat",
        modelId: freshModel,
        createdAt: "Just now",
        updatedAt: "Just now",
        systemPrompt: "You are a private local assistant running entirely on-device.",
        temperature: 0.7,
        topP: 0.9,
        messages: [],
      };
      syncThreadsToBackend([fresh]);
      return {
        chatSessions: [fresh],
        activeSessionId: freshId,
      };
    }),

  updateSessionParams: (sessionId, params) =>
    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === sessionId ? { ...s, ...params, updatedAt: "Just now" } : s
      );
      syncThreadsToBackend(updated);
      return {
        chatSessions: updated,
        ...(sessionId === state.activeSessionId && params.modelId ? { activeModelId: params.modelId } : {}),
      };
    }),

  createProject: (name, assistantId) =>
    set((state: any) => {
      const trimmed = name.trim();
      if (!trimmed) return state;
      const newProj: ChatProject = {
        id: `proj-${crypto.randomUUID()}`,
        name: trimmed,
        assistantId,
        createdAt: "Just now",
      };
      return {
        projects: [...state.projects, newProj],
        activeProjectId: newProj.id,
      };
    }),

  renameProject: (id, name) =>
    set((state: any) => {
      const trimmed = name.trim();
      if (!trimmed) return state;
      return {
        projects: state.projects.map((p: ChatProject) => (p.id === id ? { ...p, name: trimmed } : p)),
      };
    }),

  deleteProject: (id) =>
    set((state: any) => {
      const updatedSessions = state.chatSessions.map((s: ChatSession) =>
        s.projectId === id ? { ...s, projectId: undefined } : s
      );
      syncThreadsToBackend(updatedSessions);
      return {
        projects: state.projects.filter((p: ChatProject) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        chatSessions: updatedSessions,
      };
    }),

  stopInference: (targetSessionId) => {
    const targetId = targetSessionId || get().activeSessionId;
    if (targetId && targetId.startsWith("s_")) {
      void interruptHarnessRun(targetId);
    }
    get().pendingToolApproval?.resolve({ decision: "denied", scope: "once" });
    set({ pendingToolApproval: null });
    const ctrl =
      (targetId ? get().activeAbortControllersBySession?.[targetId] : null) ||
      get().activeAbortController;
    ctrl?.abort();
    const tracker =
      (targetId ? get().activeTrackersBySession?.[targetId] : null) ||
      get().activeTracker;
    if (tracker) {
      tracker.transition("stopped", { detail: "User stopped generation" });
      tracker.destroy();
    }
    set((state: any) => {
      const nextTrackers = { ...(state.activeTrackersBySession || {}) };
      const nextControllers = { ...(state.activeAbortControllersBySession || {}) };
      if (targetId) {
        delete nextTrackers[targetId];
        delete nextControllers[targetId];
      }
      const remainingTrackers = Object.values(nextTrackers) as RequestStatusTracker[];
      const remainingControllers = Object.values(nextControllers) as AbortController[];
      return {
        activeTrackersBySession: nextTrackers,
        activeAbortControllersBySession: nextControllers,
        activeTracker: remainingTrackers[0] || null,
        activeAbortController: remainingControllers[0] || null,
      };
    });
  },

  sendMessage: async (content, targetSessionId, overrideAttachments) => {
    const resolvedSessionId = targetSessionId || get().activeSessionId;
    if (get().activeTrackersBySession?.[resolvedSessionId] || !content.trim()) return;
    const session = get().chatSessions.find((s: ChatSession) => s.id === resolvedSessionId);
    if (!session) return;

    const requestId = `req-${crypto.randomUUID()}`;
    const userMsgId = `${requestId}-user`;
    const assistantMsgId = `${requestId}-assistant`;

    // Initialize RequestStatusTracker
    const tracker = new RequestStatusTracker({
      requestId,
      threadId: session.id,
      messageId: assistantMsgId,
    });

    const updateAssistantStatus = (event: RequestStatusEvent) => {
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === session.id
            ? {
                ...s,
                messages: s.messages.map((m: ChatMessage) =>
                  m.id === assistantMsgId ? { ...m, requestStatus: event } : m
                ),
              }
            : s
        ),
      }));
    };

    tracker.subscribe(updateAssistantStatus);
    const controller = new AbortController();
    set((state: any) => ({
      activeTracker: tracker,
      activeAbortController: controller,
      activeTrackersBySession: { ...(state.activeTrackersBySession || {}), [session.id]: tracker },
      activeAbortControllersBySession: { ...(state.activeAbortControllersBySession || {}), [session.id]: controller },
    }));

    // Auto-extract explicit memory instructions (e.g. "Remember that...", "Always use...")
    const memoryScope = session.projectId || "default";
    const candidateFact = LocalMemoryStore.extractCandidateFact(content);
    if (candidateFact && globalMemoryStore.isEnabled()) {
      try {
        globalMemoryStore.saveFact({
          content: candidateFact.content,
          category: candidateFact.category,
          workspaceId: memoryScope,
          pinned: true,
        });
      } catch {}
    }

    // Step 1: Optimistic render of user message + initial assistant message
    const isSecondaryPane = Boolean(targetSessionId && targetSessionId !== get().activeSessionId);
    const effectiveAttachments =
      overrideAttachments !== undefined
        ? overrideAttachments
        : isSecondaryPane
        ? []
        : get().attachedDocuments || [];
    const attachedImg = isSecondaryPane ? null : get().attachedImage;
    if (attachedImg?.src && attachedImg.src.startsWith("data:")) {
      void saveImageToVaultDb({
        id: `idb:${userMsgId}`,
        src: attachedImg.src,
        name: attachedImg.name,
        width: attachedImg.width,
        height: attachedImg.height,
      });
    }
    const userMsg: ChatMessage = {
      attachments: effectiveAttachments,
      image: attachedImg || undefined,
      id: userMsgId,
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      metrics: { tps: 0, ttftMs: 0, totalTokens: 0, vramUsedGB: 0 },
      requestStatus: tracker.getLastEvent(),
    };

    const autoTitle =
      session.messages.length === 0 &&
      (session.title === "New Chat" || session.title === "New Local Session" || session.title === "Local Inference Session")
        ? content.trim().slice(0, 40) + (content.trim().length > 40 ? "…" : "")
        : session.title;

    set((state: any) => {
      const updated = state.chatSessions.map((s: ChatSession) =>
        s.id === session.id
          ? { ...s, title: autoTitle, messages: [...s.messages, userMsg, initialAssistantMsg], updatedAt: "Just now" }
          : s
      );
      syncThreadsToBackend(updated);
      return { chatSessions: updated };
    });

    tracker.transition("reading_message");
    let ragContextSnippet = "";
    const attachedDocs = effectiveAttachments;
    const MAX_ATTACHED_DOC_CHARS = 12000;
    const formatDocForPrompt = (doc: AttachedDoc) => {
      const body =
        doc.content.length > MAX_ATTACHED_DOC_CHARS
          ? `${doc.content.slice(0, MAX_ATTACHED_DOC_CHARS)}\n\n[Truncated remaining boilerplate beyond ${MAX_ATTACHED_DOC_CHARS} chars]`
          : doc.content;
      return `[Attached Document: ${doc.name}]\n${body}`;
    };
    if (attachedDocs.length > 0) {
      ragContextSnippet += attachedDocs.map(formatDocForPrompt).join("\n\n");
    }

    if (get().enableRagInChat) {
      tracker.transition("searching_documents", {
        detail: "Searching local Vault via Hybrid (Dense + BM25 RRF) retriever...",
      });
      const allowedDocIds = new Set<string>(
        (get().documents || [])
          .filter((d: any) => d.collectionId === get().activeCollectionId)
          .map((d: any) => String(d.id))
      );
      const hybridRetrieved = globalVectorStore.hybridSearch(
        content,
        4,
        allowedDocIds,
        get().activeCollectionId || "default"
      );
      if (hybridRetrieved.length > 0) {
        const vaultContext = hybridRetrieved
          .map(
            (r, i) =>
              `[Vault Reference ${i + 1} (${r.docName}, score=${r.score.toFixed(3)})]:\n${r.content}`
          )
          .join("\n\n");
        ragContextSnippet = ragContextSnippet ? `${ragContextSnippet}\n\n${vaultContext}` : vaultContext;
        tracker.transition("searching_documents", {
          detail: `Retrieved ${hybridRetrieved.length} relevant passages`,
          progress: { current: hybridRetrieved.length, total: hybridRetrieved.length, unit: "docs" },
        });
      }
    }

    // Inject persistent 2-tier memory facts & relevant episodic recall into context
    if (globalMemoryStore.isEnabled()) {
      const coreMemories = globalMemoryStore.formatCoreMemoriesForPrompt(memoryScope);
      const recalled = globalMemoryStore.recall(content, { workspaceId: memoryScope, topK: 2 });
      const epLines = recalled.episodes
        .filter((e) => e.score > 0.015)
        .map((e) => `[Past Chat "${e.sessionTitle}"]: ${e.content.slice(0, 300)}`)
        .join("\n");
      const memBlock = [coreMemories, epLines ? `Recalled Past Conversations:\n${epLines}` : ""]
        .filter(Boolean)
        .join("\n\n");
      if (memBlock) {
        ragContextSnippet = ragContextSnippet ? `${ragContextSnippet}\n\n${memBlock}` : memBlock;
      }
    }

    const effectiveModelId = session.modelId || get().activeModelId;
    const activeModel =
      get().models.find((m: any) => m.id === effectiveModelId) ||
      get().models.find((m: any) => m.id === session.modelId) ||
      get().models[0];

    if (!activeModel) {
      tracker.transition("error", {
        error: {
          code: "NO_ACTIVE_MODEL",
          message: "No model selected or local engine is offline. Start Ollama with `ollama serve`.",
          recovery_actions: ["switch_model", "retry"],
        },
      });
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === session.id
            ? {
                ...s,
                messages: s.messages.map((m: ChatMessage) =>
                  m.id === assistantMsgId
                    ? { ...m, content: "No model selected or local engine is offline. Start Ollama with `ollama serve`." }
                    : m
                ),
              }
            : s
        ),
      }));
      tracker.destroy();
      set({ activeTracker: null });
      return;
    }

    set((state: any) => ({
      chatSessions: state.chatSessions.map((s: ChatSession) =>
        s.id === session.id
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMsgId ? { ...m, modelId: activeModel.id } : m
              ),
            }
          : s
      ),
    }));

    // Keep session synchronized with the answering model
    if (session.modelId !== activeModel.id) {
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === session.id ? { ...s, modelId: activeModel.id } : s
        ),
      }));
    }

    tracker.transition("reading_message", {
      detail: `Dispatching prompt to ${activeModel.name}...`,
    });

    const historyPayload = session.messages.flatMap((m: ChatMessage) => {
      const message = {
        role: m.role,
        ...(m.image?.src ? { images: [m.image.src.replace(/^data:image\/[^;]+;base64,/, "")] } : {}),
        content: m.attachments?.length
          ? `${m.content}\n\n${m.attachments
              .map(formatDocForPrompt)
              .join("\n\n")}`
          : m.content,
      };
      const activities = m.toolActivities?.filter((a) => a.status !== "running") || [];
      if (!get().toolsEnabled || !activities.length) return [message];
      return [
        {
          role: "assistant",
          content: "",
          tool_calls: activities.map((a) => ({ function: { name: a.name, arguments: a.arguments } })),
        },
        ...activities.map((a) => ({
          role: "tool",
          tool_name: a.name,
          content: a.output || "No result recorded",
        })),
        message,
      ];
    });
    if (session.systemPrompt) historyPayload.unshift({ role: "system", content: session.systemPrompt });
    const isPlanMode = get().agentExecutionMode === "plan";
    if (isPlanMode) {
      historyPayload.unshift({
        role: "system",
        content:
          "[PLAN MODE ACTIVE]: Do NOT modify existing source code files yet. First, inspect the workspace, write a structured step-by-step plan to 'PLAN.md' using create_file or edit_file, call present_file({ path: 'PLAN.md' }), and wait for user approval before executing changes.",
      });
    }
    historyPayload.push({ role: "user", content });

    const imageBase64 = attachedImg?.src;
    let finalAssistantText = "";
    let writeToolsExecuted = false;
    let planArtifactWritten = false;

    if (!isSecondaryPane) {
      set({ attachedImage: null, attachedDocuments: [] });
    }
    try {
      for await (const chunk of streamHarnessChat(activeModel.id, historyPayload, {
        uiSessionId: session.id,
        planMode: isPlanMode,
        ragContext: ragContextSnippet || undefined,
        numCtx:
          ragContextSnippet || session.messages.some((m: ChatMessage) => (m.attachments?.length || 0) > 0)
            ? Math.max(activeModel.config.contextSize || 4096, 8192)
            : activeModel.config.contextSize,
        think: get().thinkEnabled,
        signal: controller.signal,
        onApprovalRequest: ({ toolName, arguments: toolArgs }) =>
          new Promise<ToolApprovalResponse>((resolve) => {
            set({
              pendingToolApproval: {
                id: `appr-${crypto.randomUUID()}`,
                toolName,
                arguments: toolArgs,
                resolve,
              },
            });
          }),
        onActivity: (activity: ToolActivity) => {
          if (
            activity.status === "success" &&
            ["create_file", "edit_file", "patch_file", "move_file", "delete_file"].includes(activity.name)
          ) {
            writeToolsExecuted = true;
            const targetPath = String(activity.arguments?.path || "");
            if (targetPath && activity.name !== "delete_file") {
              get().addDeliverableItem?.(targetPath, undefined, session.id);
            }
            if (targetPath.toLowerCase().endsWith("plan.md")) {
              planArtifactWritten = true;
            }
          }
          if (activity.status === "success" && activity.name === "present_file") {
            const targetPath = String(activity.arguments?.path || "");
            if (targetPath) {
              get().addDeliverableItem?.(targetPath, undefined, session.id);
            }
            if (targetPath.toLowerCase().endsWith("plan.md")) {
              planArtifactWritten = true;
            }
          }
          tracker.transition("using_tool", {
            detail: `${activity.arguments.action || activity.name}: ${
              activity.arguments.path || activity.arguments.query || ""
            } (${activity.status})`,
          });
          set((state: any) => ({
            chatSessions: state.chatSessions.map((s: ChatSession) =>
              s.id === session.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            toolActivities: [
                              ...(m.toolActivities || []).filter((a) => a.id !== activity.id),
                              activity,
                            ],
                          }
                        : m
                    ),
                  }
                : s
            ),
          }));
        },
      })) {
        if (controller.signal.aborted) break;
        finalAssistantText = chunk.text;
        if (tracker.getCurrentPhase() !== "writing_answer" && !chunk.isFinished) {
          tracker.transition("writing_answer", {
            detail: `Streaming response from ${activeModel.name}`,
            stats: {
              tokens_generated: chunk.metrics.totalTokens,
              tokens_per_second: chunk.metrics.tps,
            },
          });
        } else if (!chunk.isFinished) {
          tracker.transition("writing_answer", {
            stats: {
              tokens_generated: chunk.metrics.totalTokens,
              tokens_per_second: chunk.metrics.tps,
            },
          });
        }

        set((state: any) => ({
          chatSessions: state.chatSessions.map((s: ChatSession) =>
            s.id === session.id
              ? {
                  ...s,
                  messages: s.messages.map((m: ChatMessage) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: chunk.text,
                          metrics: chunk.metrics,
                        }
                      : m
                  ),
                }
              : s
          ),
          telemetry: {
            ...state.telemetry,
            activeTps: chunk.metrics.tps || state.telemetry.activeTps,
          },
        }));

        if (chunk.isFinished) {
          tracker.transition("finishing", { detail: "Saving context..." });
          tracker.transition("done", {
            stats: {
              tokens_generated: chunk.metrics.totalTokens,
              tokens_per_second: chunk.metrics.tps,
            },
          });
        }
      }

      if (isPlanMode && (planArtifactWritten || finalAssistantText.trim().length > 0)) {
        set({
          pendingPlanApproval: {
            sessionId: session.id,
            planPath: "PLAN.md",
            originalPrompt: content,
          },
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sanctum:open-file", { detail: { path: "PLAN.md" } }));
        }
      }

      if (writeToolsExecuted) {
        try {
          const cpRes = await fetch("/api/checkpoints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              turnIndex: session.messages.length,
              label: autoTitle,
            }),
          });
          if (cpRes.ok) {
            const cpData = await cpRes.json();
            const cp = cpData.checkpoint;
            if (cp && cp.filesChanged > 0) {
              set((state: any) => ({
                chatSessions: state.chatSessions.map((s: ChatSession) =>
                  s.id === session.id
                    ? {
                        ...s,
                        messages: s.messages.map((m: ChatMessage) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                turnChanges: {
                                  checkpointId: cp.id,
                                  filesCount: cp.filesChanged,
                                  addedLines: cp.totalAdded || 0,
                                  removedLines: cp.totalRemoved || 0,
                                  files: (cp.fileDiffs || []).map((f: any) => ({
                                    path: f.path,
                                    status: f.existedBefore === false ? "added" : "modified",
                                    added: f.added || 0,
                                    removed: f.removed || 0,
                                  })),
                                },
                              }
                            : m
                        ),
                      }
                    : s
                ),
              }));
            }
          }
        } catch {}
      }

      // Save turn to episodic cross-chat memory
      if (finalAssistantText && globalMemoryStore.isEnabled()) {
        globalMemoryStore.addEpisode({
          sessionId: session.id,
          sessionTitle: autoTitle,
          role: "user",
          content: `Q: ${content}\nA: ${finalAssistantText.slice(0, 600)}`,
          workspaceId: memoryScope,
        });
      }
    } catch (err: any) {
      if (!controller.signal.aborted)
        tracker.transition("error", {
          error: {
            code: "ENGINE_STREAM_ERROR",
            message: err?.message || "Failed to communicate with local inference daemon",
            recovery_actions: ["retry"],
          },
        });
    } finally {
      get().pendingToolApproval?.resolve({ decision: "denied", scope: "once" });
      tracker.destroy();
      set((state: any) => {
        const nextTrackers = { ...(state.activeTrackersBySession || {}) };
        const nextControllers = { ...(state.activeAbortControllersBySession || {}) };
        if (nextControllers[session.id] === controller) {
          delete nextTrackers[session.id];
          delete nextControllers[session.id];
        }
        const remainingTrackers = Object.values(nextTrackers) as RequestStatusTracker[];
        const remainingControllers = Object.values(nextControllers) as AbortController[];
        return {
          activeTrackersBySession: nextTrackers,
          activeAbortControllersBySession: nextControllers,
          activeTracker: remainingTrackers[0] || null,
          activeAbortController: remainingControllers[0] || null,
          pendingToolApproval: state.activeAbortController === controller ? null : state.pendingToolApproval,
        };
      });
      const nextRev = (get().threadsRevision || 0) + 1;
      const nextTs = Date.now();
      set({ threadsRevision: nextRev, threadsUpdatedAt: nextTs });
      syncThreadsToBackend(get().chatSessions, nextRev, nextTs);
    }
  },

  syncThreadsFromHost: async () => {
    if (typeof window === "undefined" || !(window as any).chrome?.webview) return;
    // Phase 1c temporary adapter (removal scheduled in Phase 5): host harness session store always wins when online
    try {
      const probe = await probeHarness();
      if (probe.available) {
        const hostSessions = await listHarnessSessions();
        if (hostSessions.length > 0) {
          const projected: ChatSession[] = [];
          for (const hs of hostSessions.slice(0, 50)) {
            const snap = await getHarnessSession(hs.sessionId);
            const msgs: ChatMessage[] = [];
            for (const ev of snap?.events || []) {
              if (ev.type === "user_message") {
                msgs.push({
                  id: `ev-${ev.seq}`,
                  role: "user",
                  content: String(ev.payload?.content || ""),
                  timestamp: ev.ts,
                });
              } else if (ev.type === "assistant_message") {
                msgs.push({
                  id: `ev-${ev.seq}`,
                  role: "assistant",
                  content: String(ev.payload?.content || ""),
                  timestamp: ev.ts,
                  modelId: hs.model,
                });
              }
            }
            projected.push({
              id: hs.sessionId,
              title: hs.title || "New Chat",
              modelId: hs.model || get().activeModelId || "",
              createdAt: hs.createdAt,
              updatedAt: hs.updatedAt,
              systemPrompt: "You are a private local assistant running entirely on-device.",
              temperature: 0.7,
              topP: 0.9,
              pinned: false,
              messages: msgs,
            });
          }
          const currentActive = get().activeSessionId;
          const activeExists = projected.some((s) => s.id === currentActive);
          set({
            chatSessions: projected,
            activeSessionId: activeExists ? currentActive : projected[0].id,
          });

          // Live reattach to any session that has an active host-side run (window-close survival!)
          for (const hs of hostSessions) {
            if (!hs.activeRunId) continue;
            const ctrl = new AbortController();
            let liveBuf = "";
            void streamHarnessEvents(hs.sessionId, hs.lastSeq, ctrl.signal, (ev) => {
              if (ev.type === "message_delta") {
                liveBuf += String(ev.payload?.delta || "");
                set((state: any) => ({
                  chatSessions: state.chatSessions.map((s: ChatSession) => {
                    if (s.id !== hs.sessionId) return s;
                    const existing = s.messages.find((m) => m.id === `live-${hs.activeRunId}`);
                    const nextMsgs = existing
                      ? s.messages.map((m) => (m.id === `live-${hs.activeRunId}` ? { ...m, content: liveBuf } : m))
                      : [...s.messages, { id: `live-${hs.activeRunId}`, role: "assistant" as const, content: liveBuf, timestamp: ev.ts, modelId: hs.model }];
                    return { ...s, messages: nextMsgs };
                  }),
                }));
              } else if (ev.type === "run_finished") {
                void get().syncThreadsFromHost();
              }
            }).catch(() => {});
          }
          return;
        }
      }
    } catch {}

    try {
      const res = await fetch("/api/threads");
      if (!res.ok) return;
      const hostRaw = await res.json();
      let alreadyMigrated = false;
      try { alreadyMigrated = localStorage.getItem("sanctum-threads-migrated-v1") === "1"; } catch {}
      const result = reconcileThreadSnapshots(
        hostRaw,
        {
          revision: get().threadsRevision || 0,
          updatedAt: get().threadsUpdatedAt || 0,
          sessions: get().chatSessions || [],
        },
        alreadyMigrated
      );
      try { localStorage.setItem("sanctum-threads-migrated-v1", "1"); } catch {}
      if (result.winner === "host" && result.snapshot.sessions.length > 0) {
        const currentActive = get().activeSessionId;
        const activeExists = result.snapshot.sessions.some((s) => s.id === currentActive);
        set({
          chatSessions: result.snapshot.sessions,
          threadsRevision: result.snapshot.revision,
          threadsUpdatedAt: result.snapshot.updatedAt,
          activeSessionId: activeExists ? currentActive : result.snapshot.sessions[0].id,
        });
      } else if (result.shouldPushToHost) {
        set({
          threadsRevision: result.snapshot.revision,
          threadsUpdatedAt: result.snapshot.updatedAt,
        });
        syncThreadsToBackend(result.snapshot.sessions, result.snapshot.revision, result.snapshot.updatedAt);
      }
    } catch {}
  },

  regenerateLastMessage: () => {
    const session = get().chatSessions.find((s: ChatSession) => s.id === get().activeSessionId);
    if (get().activeTracker || !session || session.messages.length < 2) return;
    const last = session.messages[session.messages.length - 1];
    if (last.role === "assistant") {
      const lastUser = session.messages[session.messages.length - 2];
      if (lastUser.role !== "user") return;
      const popped = session.messages.slice(0, -2);
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === state.activeSessionId ? { ...s, messages: popped } : s
        ),
      }));
      if (lastUser) {
        set({ attachedDocuments: lastUser.attachments || [], attachedImage: lastUser.image || null });
        get().sendMessage(lastUser.content);
      }
    }
  },
});
