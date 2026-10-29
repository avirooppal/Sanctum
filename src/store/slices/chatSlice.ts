import { streamWorkspaceChat } from "../../../core/ai/tools/workspace_chat.ts";
import type { StateCreator } from "zustand";
import type { ChatSession, ChatMessage, ChatProject, RequestStatusEvent } from "../../../contracts/types/index.ts";
import { globalVectorStore } from "../../../core/ai/rag/vectorStore.ts";
import { LocalEngineClient } from "../../../core/ai/inference/engine.ts";
import { DEFAULT_OLLAMA_ENDPOINT } from "../../../contracts/constants/index.ts";
import { RequestStatusTracker } from "../../../core/ai/request_status.ts";

export interface AttachedDoc {
  name: string;
  size: number;
  content: string;
}

export interface ChatSlice {
  chatSessions: ChatSession[];
  activeSessionId: string;
  projects: ChatProject[];
  activeProjectId: string | null;
  enableRagInChat: boolean;
  toolsEnabled: boolean;
  setToolsEnabled: (enabled: boolean) => void;
  attachedImage: { src: string; name: string; width: number; height: number } | null;
  attachedDocuments: AttachedDoc[];
  activeTracker: RequestStatusTracker | null;
  activeAbortController: AbortController | null;
  toggleMessageBookmark: (sessionId: string, messageId: string) => void;

  setActiveSessionId: (id: string) => void;
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
  sendMessage: (content: string) => Promise<void>;
  stopInference: () => void;
  regenerateLastMessage: () => void;
}

const syncThreadsToBackend = (sessions: ChatSession[]) => {
  if (typeof window === "undefined" || !(window as any).chrome?.webview) return;
  fetch("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessions),
  }).catch(() => {});
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
  activeSessionId: "chat-default",
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
  setToolsEnabled: (enabled) => set({ toolsEnabled: enabled }),
  attachedImage: null,
  attachedDocuments: [],
  activeTracker: null,
  activeAbortController: null,
  toggleMessageBookmark: (sessionId, messageId) => set((state: any) => ({
    chatSessions: state.chatSessions.map((s: ChatSession) => s.id === sessionId
      ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m) } : s),
  })),

  setActiveSessionId: (id) => {
    const session = get().chatSessions.find((s: ChatSession) => s.id === id);
    if (session) set({ activeSessionId: id, activeModelId: session.modelId });
  },
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
      return { chatSessions: updated, ...(sessionId === state.activeSessionId && params.modelId ? { activeModelId: params.modelId } : {}) };
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

  stopInference: () => {
    get().activeAbortController?.abort();
    const tracker = get().activeTracker;
    if (tracker) {
      tracker.transition("stopped", { detail: "User stopped generation" });
      tracker.destroy();
      set({ activeTracker: null });
    }
  },

  sendMessage: async (content) => {
    if (get().activeTracker || !content.trim()) return;
    const session = get().chatSessions.find((s: ChatSession) => s.id === get().activeSessionId);
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
    set({ activeTracker: tracker, activeAbortController: controller });

    // Step 1: Optimistic render of user message + initial assistant message
    const userMsg: ChatMessage = {
      attachments: get().attachedDocuments || [],
      image: get().attachedImage || undefined,
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
    const attachedDocs = get().attachedDocuments || [];
    if (attachedDocs.length > 0) {
      ragContextSnippet += attachedDocs
        .map((doc: AttachedDoc) => `[Attached Document: ${doc.name}]\n${doc.content}`)
        .join("\n\n");
    }

    if (get().enableRagInChat) {
      tracker.transition("searching_documents", {
        detail: "Searching local Vault embeddings...",
      });
      const retrieved = globalVectorStore.search(content, 3, 0.2, new Set((get().documents || []).filter((d: any) => d.collectionId === get().activeCollectionId).map((d: any) => d.id)));
      if (retrieved.length > 0) {
        const vaultContext = retrieved
          .map((r, i) => `[Vault Reference ${i + 1} (${r.docName})]:\n${r.content}`)
          .join("\n\n");
        ragContextSnippet = ragContextSnippet ? `${ragContextSnippet}\n\n${vaultContext}` : vaultContext;
        tracker.transition("searching_documents", {
          detail: `Retrieved ${retrieved.length} relevant passages`,
          progress: { current: retrieved.length, total: retrieved.length, unit: "docs" },
        });
      }
    }

    const effectiveModelId = get().activeModelId || session.modelId;
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

    set((state: any) => ({ chatSessions: state.chatSessions.map((s: ChatSession) => s.id === session.id
      ? { ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, modelId: activeModel.id } : m) } : s) }));

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
        content: m.attachments?.length ? `${m.content}\n\n${m.attachments.map((d: AttachedDoc) => `[Attached Document: ${d.name}]\n${d.content}`).join("\n\n")}` : m.content,
      };
      const activities = m.toolActivities?.filter(a => a.status !== "running") || [];
      if (!get().toolsEnabled || !activities.length) return [message];
      return [
        { role: "assistant", content: "", tool_calls: activities.map(a => ({ function: { name: a.name, arguments: a.arguments } })) },
        ...activities.map(a => ({ role: "tool", tool_name: a.name, content: a.output || "No result recorded" })),
        message,
      ];
    });
    if (session.systemPrompt) historyPayload.unshift({ role: "system", content: session.systemPrompt });
    historyPayload.push({ role: "user", content });

    const imageBase64 = get().attachedImage?.src;

    set({ attachedImage: null, attachedDocuments: [] });
    try {
      const stream = get().toolsEnabled ? streamWorkspaceChat : LocalEngineClient.streamChat.bind(LocalEngineClient);
      for await (const chunk of stream(activeModel.id, historyPayload, {
        endpoint: DEFAULT_OLLAMA_ENDPOINT,
        onActivity: (activity: import("../../../core/ai/tools/workspace_chat.ts").ToolActivity) => {
          tracker.transition("using_tool", { detail: `${activity.arguments.action || activity.name}: ${activity.arguments.path || ""} (${activity.status})` });
          set((state: any) => ({ chatSessions: state.chatSessions.map((s: ChatSession) => s.id === session.id
            ? { ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, toolActivities: [...(m.toolActivities || []).filter(a => a.id !== activity.id), activity] } : m) } : s) }));
        },
        temperature: session.temperature,
        topP: session.topP,
        signal: controller.signal,
        contextSize: activeModel.config.contextSize,
        gpuLayers: activeModel.config.gpuLayers,
        threads: activeModel.config.threads,
        ragContext: ragContextSnippet,
        imageAttached: imageBase64,
      })) {
        if (controller.signal.aborted) break;
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
    } catch (err: any) {
      if (!controller.signal.aborted) tracker.transition("error", {
        error: {
          code: "ENGINE_STREAM_ERROR",
          message: err?.message || "Failed to communicate with local inference daemon",
          recovery_actions: ["retry"],
        },
      });
    } finally {
      tracker.destroy();
      if (get().activeAbortController === controller) {
        set({ activeTracker: null, activeAbortController: null });
      }
      syncThreadsToBackend(get().chatSessions);
    }
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
