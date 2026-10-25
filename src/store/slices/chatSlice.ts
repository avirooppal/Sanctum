import { StateCreator } from "zustand";
import { ChatSession, ChatMessage, RequestStatusEvent } from "@/types";
import { globalVectorStore } from "@/lib/vectorStore";
import { LocalEngineClient } from "@/lib/engine";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";
import { RequestStatusTracker } from "@core/ai/request_status.ts";

export interface AttachedDoc {
  name: string;
  size: number;
  content: string;
}

export interface ChatSlice {
  chatSessions: ChatSession[];
  activeSessionId: string;
  enableRagInChat: boolean;
  attachedImage: { src: string; name: string; width: number; height: number } | null;
  attachedDocuments: AttachedDoc[];
  activeTracker: RequestStatusTracker | null;

  setActiveSessionId: (id: string) => void;
  createNewChatSession: () => void;
  deleteChatSession: (id: string) => void;
  setEnableRagInChat: (enabled: boolean) => void;
  setAttachedImage: (img: { src: string; name: string; width: number; height: number } | null) => void;
  addAttachedDocument: (doc: AttachedDoc) => void;
  removeAttachedDocument: (name: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stopInference: () => void;
  regenerateLastMessage: () => void;
}

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
  enableRagInChat: false,
  attachedImage: null,
  attachedDocuments: [],
  activeTracker: null,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
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

  createNewChatSession: () => {
    const newId = `chat-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New Local Session",
      modelId: get().activeModelId || get().models[0]?.id || "",
      createdAt: "Just now",
      updatedAt: "Just now",
      systemPrompt: "You are a private local assistant running entirely on-device.",
      temperature: 0.7,
      topP: 0.9,
      messages: [],
    };
    set((state: any) => ({
      chatSessions: [newSession, ...state.chatSessions],
      activeSessionId: newId,
    }));
  },

  deleteChatSession: (id) =>
    set((state: any) => {
      const filtered = state.chatSessions.filter((s: ChatSession) => s.id !== id);
      return {
        chatSessions: filtered,
        activeSessionId: filtered.length > 0 ? filtered[0].id : "",
      };
    }),

  stopInference: () => {
    const tracker = get().activeTracker;
    if (tracker) {
      tracker.transition("stopped", { detail: "User stopped generation" });
      tracker.destroy();
      set({ activeTracker: null });
    }
  },

  sendMessage: async (content) => {
    const session = get().chatSessions.find((s: ChatSession) => s.id === get().activeSessionId);
    if (!session) return;

    const requestId = `req-${Date.now()}`;
    const userMsgId = `msg-${Date.now()}`;
    const assistantMsgId = `msg-${Date.now() + 1}`;

    // Initialize RequestStatusTracker
    const tracker = new RequestStatusTracker({
      requestId,
      threadId: session.id,
      messageId: assistantMsgId,
    });

    const updateAssistantStatus = (event: RequestStatusEvent) => {
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === state.activeSessionId
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
    set({ activeTracker: tracker });

    // Step 1: Optimistic render of user message + initial assistant message
    const userMsg: ChatMessage = {
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

    set((state: any) => ({
      chatSessions: state.chatSessions.map((s: ChatSession) =>
        s.id === state.activeSessionId
          ? { ...s, messages: [...s.messages, userMsg, initialAssistantMsg], updatedAt: "Just now" }
          : s
      ),
    }));

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
      const retrieved = globalVectorStore.search(content, 3, 0.2);
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

    const activeModel =
      get().models.find((m: any) => m.id === session.modelId) || get().models[0];

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
          s.id === state.activeSessionId
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

    tracker.transition("reading_message", {
      detail: `Dispatching prompt to ${activeModel.name}...`,
    });

    const historyPayload = session.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
    historyPayload.push({ role: "user", content });

    const imageBase64 = get().attachedImage?.src;

    try {
      for await (const chunk of LocalEngineClient.streamChat(activeModel.id, historyPayload, {
        endpoint: DEFAULT_OLLAMA_ENDPOINT,
        temperature: activeModel.config.temperature,
        contextSize: activeModel.config.contextSize,
        gpuLayers: activeModel.config.gpuLayers,
        threads: activeModel.config.threads,
        ragContext: ragContextSnippet,
        imageAttached: imageBase64,
      })) {
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
            s.id === state.activeSessionId
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
      tracker.transition("error", {
        error: {
          code: "ENGINE_STREAM_ERROR",
          message: err?.message || "Failed to communicate with local inference daemon",
          recovery_actions: ["retry"],
        },
      });
    } finally {
      tracker.destroy();
      set({ activeTracker: null, attachedImage: null, attachedDocuments: [] });
    }
  },

  regenerateLastMessage: () => {
    const session = get().chatSessions.find((s: ChatSession) => s.id === get().activeSessionId);
    if (!session || session.messages.length === 0) return;
    const last = session.messages[session.messages.length - 1];
    if (last.role === "assistant") {
      const popped = session.messages.slice(0, -1);
      set((state: any) => ({
        chatSessions: state.chatSessions.map((s: ChatSession) =>
          s.id === state.activeSessionId ? { ...s, messages: popped } : s
        ),
      }));
      const lastUser = popped[popped.length - 1];
      if (lastUser) {
        get().sendMessage(lastUser.content);
      }
    }
  },
});
