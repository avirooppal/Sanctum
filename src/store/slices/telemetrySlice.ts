import { StateCreator } from "zustand";
import { HardwareTelemetry } from "@/types";
import { DaemonStatus } from "@/lib/engine";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export interface TelemetrySlice {
  telemetry: HardwareTelemetry;
  daemons: DaemonStatus[];

  updateRealTelemetry: () => Promise<void>;
  checkDaemons: () => Promise<void>;
}

export const createTelemetrySlice: StateCreator<any, [], [], TelemetrySlice> = (set, get) => ({
  telemetry: {
    cpuUsage: 0,
    cpuModel: "Host Logical Cores",
    ramUsedGB: 4.0,
    ramTotalGB: 16.0,
    vramUsedGB: 2.0,
    vramTotalGB: 16.0,
    gpuName: "Local Hardware Accelerator",
    gpuTempC: 45,
    gpuClockMHz: 1800,
    gpuFanSpeedPercent: 35,
    computeBackend: "Ollama Local Engine",
    activeTps: 0,
    totalLoadedModels: 0,
    uptimeHours: 1.0,
  },

  daemons: [
    {
      endpoint: DEFAULT_OLLAMA_ENDPOINT,
      type: "ollama",
      online: false,
      latencyMs: -1,
      modelsFound: [],
    },
  ],

  updateRealTelemetry: async () => {
    const pingStart = performance.now();
    let online = false;
    let latency = -1;

    try {
      const res = await fetch(`${DEFAULT_OLLAMA_ENDPOINT}/api/tags`);
      if (res.ok) {
        online = true;
        latency = Math.round(performance.now() - pingStart);
      }
    } catch {
      // Offline fallback
    }

    const cpuCores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;
    const deviceRam =
      typeof navigator !== "undefined" && (navigator as any).deviceMemory
        ? (navigator as any).deviceMemory
        : 16.0;

    let heapUsed = 0;
    if (typeof performance !== "undefined" && (performance as any).memory) {
      heapUsed = Number(
        (((performance as any).memory.usedJSHeapSize || 0) / (1024 * 1024 * 1024)).toFixed(2)
      );
    }

    const currentModels = get().models || [];

    set((state: any) => ({
      telemetry: {
        ...state.telemetry,
        cpuModel: `${cpuCores} Logical Compute Cores`,
        ramUsedGB: heapUsed > 0 ? heapUsed : state.telemetry.ramUsedGB,
        ramTotalGB: deviceRam,
        computeBackend: online ? `Ollama Active (${latency}ms)` : "Ollama Standby",
        totalLoadedModels: currentModels.filter((m: any) => m.isLoaded).length,
      },
      daemons: [
        {
          endpoint: DEFAULT_OLLAMA_ENDPOINT,
          type: "ollama",
          online,
          latencyMs: latency,
          modelsFound: currentModels.map((m: any) => m.name),
        },
      ],
    }));
  },

  checkDaemons: async () => {
    await get().updateRealTelemetry();
  },
});
