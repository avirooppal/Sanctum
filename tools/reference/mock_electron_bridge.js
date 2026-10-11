/**
 * Mock Electron Bridge for the Upstream Reference Renderer.
 * Injected as window.hermesDesktop in reference comparison pages.
 * Stubs Electron IPC calls without native Electron or Node.
 */

(function () {
  if (typeof window === "undefined") return;

  const mockSessions = [
    {
      id: "session-ref-001",
      title: "Sanctum Architecture & Privacy Review",
      created_at: 1773000000,
      updated_at: 1773000500,
      message_count: 4,
      model: "qwen3-0.6b-q8",
    },
    {
      id: "session-ref-002",
      title: "Local RAG Retrieval Tuning",
      created_at: 1773001000,
      updated_at: 1773001200,
      message_count: 2,
      model: "qwen3-0.6b-q8",
    },
  ];

  const mockModels = {
    models: [
      {
        id: "chat-tiny-q8",
        name: "Qwen3-0.6B-Q8 (Local CPU)",
        context_length: 2048,
        quantization: "Q8_0",
        fit_estimate: "Runs efficiently on 8GB RAM",
        license: "Apache-2.0",
      },
    ],
  };

  const mockConfig = {
    profile: "runtime-cpu",
    threads: 2,
    context: 2048,
    speech_enabled: true,
    knowledge_enabled: true,
  };

  window.hermesDesktop = {
    glassSupported: false,
    translucencySupported: false,
    localModelsEnabled: true,
    guestOnboardingEnabled: false,
    localSkin: null,

    // API router
    api: async function (request) {
      const endpoint = request.endpoint || request.url || "";
      if (endpoint.includes("/api/sessions")) {
        return { sessions: mockSessions };
      }
      if (endpoint.includes("/api/models") || endpoint.includes("/api/config/models")) {
        return mockModels;
      }
      if (endpoint.includes("/api/config")) {
        return mockConfig;
      }
      if (endpoint.includes("/api/status")) {
        return { status: "online", version: "1.0.0-reference" };
      }
      return { ok: true, data: {} };
    },

    getConnection: async function (profile, opts) {
      return {
        connectionId: "local-ref",
        profile: profile || "default",
        status: "ready",
      };
    },

    getGatewayWsUrl: async function (profile) {
      return "ws://127.0.0.1:8769/v1/realtime";
    },

    windowControls: {
      custom: false,
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {},
    },

    wakeIndicator: {
      getState: async () => ({ active: false }),
      setState: () => {},
      onState: (cb) => () => {},
    },

    hud: {
      nativeDrag: false,
      windowing: {
        clientPlacement: true,
        controlDrag: false,
        nativeDrag: false,
        solid: true,
        workspaceTransfer: false,
      },
      open: async () => {},
      close: async () => {},
      setIgnoreMouse: () => {},
      beginMove: () => {},
      endMove: () => {},
      moveBy: () => {},
      setWorkspaceTransfer: () => {},
    },
  };

  window.__HERMES_SESSION_TOKEN__ = "ref-token-local";
  window.__HERMES_BASE_PATH__ = "";
  window.__HERMES_AUTH_REQUIRED__ = false;
})();
