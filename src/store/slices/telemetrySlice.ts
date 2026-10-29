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
    ramUsedGB: 0,
    ramTotalGB: 0,
    vramUsedGB: 0,
    vramTotalGB: 0,
    gpuName: "Unavailable",
    gpuTempC: 0,
    gpuClockMHz: 0,
    gpuFanSpeedPercent: 0,
    computeBackend: "Ollama Local Engine",
    activeTps: 0,
    totalLoadedModels: 0,
    uptimeHours: 0,
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
    try {
      const response = await fetch("/api/system", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const system = await response.json();
      set((state: any) => ({
        telemetry: { ...state.telemetry, cpuUsage: system.cpuPercent ?? 0, cpuModel: system.cpuName,
          ramUsedGB: system.ramUsedGB ?? 0, ramTotalGB: system.ramTotalGB ?? 0,
          gpuName: system.gpuName, vramUsedGB: system.loadedModels.reduce((sum: number, m: any) => sum + (m.vramBytes || 0) / 1073741824, 0),
          computeBackend: system.engineOnline ? "Ollama running" : "Ollama offline",
          totalLoadedModels: system.loadedModels.length, uptimeHours: system.uptimeSeconds / 3600 },
        daemons: [{ endpoint: DEFAULT_OLLAMA_ENDPOINT, type: "ollama", online: system.engineOnline, latencyMs: -1, modelsFound: system.loadedModels.map((m: any) => m.name) }],
      }));
    } catch { /* Missing measurements remain unavailable. */ }
  },

  checkDaemons: async () => {
    await get().updateRealTelemetry();
  },
});
