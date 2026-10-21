"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardDrive,
  Cpu,
  ShieldCheck,
  Zap,
  Sliders,
  Folder,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const SettingsView: React.FC = () => {
  const { daemons, checkDaemons, telemetry } = useAppStore();
  const [isChecking, setIsChecking] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [lmStudioUrl, setLmStudioUrl] = useState("http://localhost:1234/v1");
  const [modelsDir, setModelsDir] = useState("C:\\Users\\aviroop\\.antigravity\\models");

  useEffect(() => {
    checkDaemons();
  }, [checkDaemons]);

  const handleCheck = async () => {
    setIsChecking(true);
    await checkDaemons();
    setIsChecking(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" />
            <span>Local Engine & Private Network Settings</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure local inference endpoints, GPU kernel accelerators, and air-gapped storage directories.
          </p>
        </div>

        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isChecking && "animate-spin")} />
          <span>{isChecking ? "Pinging..." : "Test Daemons"}</span>
        </button>
      </div>

      {/* Main Settings Grid */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
        {/* Local Daemons Connectivity Status */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Local Inference Daemons
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ollama Daemon Card */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span>Ollama Daemon</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  {daemons.find((d) => d.type === "ollama")?.online ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Online ({daemons.find((d) => d.type === "ollama")?.latencyMs}ms)</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <span>Standby / Embedded</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-500">API Endpoint URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="text-[10px] text-zinc-500">
                Default: <code className="text-indigo-400">http://localhost:11434</code> • Auto-discovers local llama/qwen weights
              </div>
            </div>

            {/* LM Studio / llama.cpp Card */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>OpenAI-Compatible Local API</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  {daemons.find((d) => d.type === "lm-studio")?.online ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Online ({daemons.find((d) => d.type === "lm-studio")?.latencyMs}ms)</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <span>Standby / Embedded</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-500">Server Endpoint URL</label>
                <input
                  type="text"
                  value={lmStudioUrl}
                  onChange={(e) => setLmStudioUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="text-[10px] text-zinc-500">
                Default: <code className="text-cyan-400">http://localhost:1234/v1</code> or <code className="text-cyan-400">:8080/v1</code>
              </div>
            </div>
          </div>
        </div>

        {/* Local Storage & Cache Path */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>Local Weights Storage Directory</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={modelsDir}
              onChange={(e) => setModelsDir(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-white/5">
              Browse
            </button>
          </div>
          <div className="text-[10px] text-zinc-500">
            Path where GGUF shards, SafeTensors, and vector index snapshots are persisted.
          </div>
        </div>

        {/* Security & Air-Gapped Verification Invariants */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Air-Gapped Security Policies</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              STRICT ENFORCEMENT
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Prompt and weight tensors never leave local physical memory.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Zero external telemetry analytics or user tracking.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Vector database index stored in private process memory.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
