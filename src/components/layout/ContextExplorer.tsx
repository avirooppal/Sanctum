"use client";

import React, { useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Sparkles,
  Swords,
  FolderOpen,
  Sliders,
  CheckCircle2,
  Clock,
  HardDrive,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ModelCategory, NavModule } from "@/types";
import { cn } from "@/lib/utils";

export const ContextExplorer: React.FC = () => {
  const {
    activeModule,
    isExplorerCollapsed,
    toggleExplorer,
    // Hub
    models,
    selectedCategory,
    setSelectedCategory,
    searchModelQuery,
    setSearchModelQuery,
    // Chat
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    createNewChatSession,
    deleteChatSession,
    // Arena
    arenaSplitMode,
    setArenaSplitMode,
    setArenaPrompt,
    // Research
    dossiers,
    activeDossierId,
    setActiveDossierId,
    startNewDeepResearch,
    isResearchRunning,
    // RAG
    collections,
    activeCollectionId,
    setActiveCollectionId,
    createCollection,
    documents,
    // Telemetry
    telemetry,
  } = useAppStore();

  const [newColName, setNewColName] = useState("");
  const [isCreatingCol, setIsCreatingCol] = useState(false);
  const [researchInput, setResearchInput] = useState("");

  if (isExplorerCollapsed) {
    return (
      <div className="flex flex-col items-center justify-start h-full py-2 bg-surface-raised border-r border-surface-border w-4 shrink-0 transition-all duration-200">
        <button
          onClick={toggleExplorer}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          title="Expand Explorer (Ctrl+B)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-72 h-full bg-surface-raised border-r border-surface-border shrink-0 select-none transition-all duration-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {activeModule === "hub" && "Model Catalog"}
            {activeModule === "chat" && "Local Threads"}
            {activeModule === "arena" && "Arena Configuration"}
            {activeModule === "research" && "Research Dossiers"}
            {activeModule === "rag" && "Knowledge Vault"}
            {activeModule === "telemetry" && "System Devices"}
            {activeModule === "settings" && "Engine Config"}
          </span>
        </div>
        <button
          onClick={toggleExplorer}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Collapse Explorer (Ctrl+B)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Explorer Dynamic Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ===================== MODULE: MODEL HUB ===================== */}
        {activeModule === "hub" && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search models, quant..."
                value={searchModelQuery}
                onChange={(e) => setSearchModelQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Filter Categories */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Categories
              </span>
              <div className="flex flex-col gap-1">
                {(
                  [
                    ["all", "All Models", models.length],
                    ["reasoning", "STEM & Reasoning", models.filter((m) => m.category === "reasoning").length],
                    ["coding", "Code Intelligence", models.filter((m) => m.category === "coding").length],
                    ["general", "General Instruct", models.filter((m) => m.category === "general").length],
                    ["vision", "Vision & OCR", models.filter((m) => m.category === "vision").length],
                    ["embedding", "Dense Retrieval", models.filter((m) => m.category === "embedding").length],
                  ] as const
                ).map(([catId, label, count]) => (
                  <button
                    key={catId}
                    onClick={() => setSelectedCategory(catId as ModelCategory)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left",
                      selectedCategory === catId
                        ? "bg-indigo-600/15 text-indigo-300 font-medium border border-indigo-500/30"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    )}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Memory Budget Overview */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">VRAM Allocation</span>
                <span className="font-mono text-zinc-300">
                  {telemetry.vramUsedGB} / {telemetry.vramTotalGB} GB
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${(telemetry.vramUsedGB / telemetry.vramTotalGB) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-500 flex justify-between">
                <span>{telemetry.totalLoadedModels} Active in Memory</span>
                <span className="text-emerald-400 font-medium">Zero Swap</span>
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODULE: LOCAL CHAT ===================== */}
        {activeModule === "chat" && (
          <div className="space-y-3">
            <button
              onClick={createNewChatSession}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat Thread</span>
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Recent Sessions
              </span>
              <div className="space-y-1">
                {chatSessions.map((session) => {
                  const isActive = activeSessionId === session.id;
                  const model = models.find((m) => m.id === session.modelId);

                  return (
                    <div
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={cn(
                        "group relative flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer border transition-all text-left",
                        isActive
                          ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                          : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate max-w-[170px]">
                          {session.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChatSession(session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                          title="Delete Thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span className="truncate max-w-[120px]">{model?.name || "Local Model"}</span>
                        <span>{session.updatedAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODULE: MODEL ARENA ===================== */}
        {activeModule === "arena" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Split Canvas Layout
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["dual", "Dual (2x)"],
                    ["triple", "Triple (3x)"],
                    ["quad", "Quad (4x)"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setArenaSplitMode(mode)}
                    className={cn(
                      "py-2 px-1 text-center text-xs rounded-lg border transition-colors font-medium",
                      arenaSplitMode === mode
                        ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Benchmark Presets
              </span>
              <div className="space-y-1.5">
                {[
                  {
                    title: "SIMD Cache Locality",
                    prompt: "Write a high-performance string search in C++ and explain its cache behavior.",
                  },
                  {
                    title: "Formal Logic & CoT",
                    prompt: "Analyze the halting problem reduction for bounded linear automata with formal proofs.",
                  },
                  {
                    title: "Python Async Architecture",
                    prompt: "Implement a backpressure-aware event streaming queue in Python using asyncio and uvloop.",
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setArenaPrompt(item.prompt)}
                    className="w-full p-2 text-left text-xs bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 rounded-lg text-zinc-300 transition-colors"
                  >
                    <div className="font-medium text-zinc-200">{item.title}</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{item.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODULE: DEEP RESEARCH ===================== */}
        {activeModule === "research" && (
          <div className="space-y-4">
            <div className="p-3 bg-zinc-900/80 border border-indigo-500/20 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Launch Deep Inquiry</span>
              </div>
              <input
                type="text"
                placeholder="Topic or research question..."
                value={researchInput}
                onChange={(e) => setResearchInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                disabled={isResearchRunning || !researchInput.trim()}
                onClick={() => {
                  if (researchInput.trim()) {
                    startNewDeepResearch(researchInput, "exhaustive");
                    setResearchInput("");
                  }
                }}
                className="w-full py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {isResearchRunning ? "Pipeline Running..." : "Execute Agent Plan"}
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Investigation Archives
              </span>
              <div className="space-y-1">
                {dossiers.map((dossier) => {
                  const isActive = activeDossierId === dossier.id;
                  return (
                    <div
                      key={dossier.id}
                      onClick={() => setActiveDossierId(dossier.id)}
                      className={cn(
                        "p-2.5 rounded-lg cursor-pointer border transition-all text-left space-y-1.5",
                        isActive
                          ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                          : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                      )}
                    >
                      <div className="text-xs font-medium line-clamp-2">{dossier.title}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded capitalize",
                            dossier.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          )}
                        >
                          {dossier.status}
                        </span>
                        <span className="text-zinc-500">{dossier.tokensConsumed} tok</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODULE: KNOWLEDGE BASE / RAG ===================== */}
        {activeModule === "rag" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
                Vector Collections
              </span>
              <button
                onClick={() => setIsCreatingCol(!isCreatingCol)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
                title="New Collection"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isCreatingCol && (
              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="Collection Name..."
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    if (newColName.trim()) {
                      createCollection(newColName, "User ingested document vault", "BGE-Large-EN-v1.5");
                      setNewColName("");
                      setIsCreatingCol(false);
                    }
                  }}
                  className="w-full py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500"
                >
                  Create
                </button>
              </div>
            )}

            <div className="space-y-1">
              {collections.map((col) => {
                const isActive = activeCollectionId === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveCollectionId(col.id)}
                    className={cn(
                      "w-full p-2.5 rounded-lg border text-left transition-all space-y-1",
                      isActive
                        ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                        : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{col.name}</span>
                      <span className="text-[10px] font-mono text-indigo-400">
                        {col.documentCount} docs
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 line-clamp-1">{col.description}</div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 pt-0.5">
                      <span>{col.totalChunks} Chunks</span>
                      <span>•</span>
                      <span>{col.vectorDimensions}d</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== MODULE: TELEMETRY & HARDWARE ===================== */}
        {activeModule === "telemetry" && (
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
              Compute Topology
            </span>
            <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-indigo-400 font-medium">
                <Cpu className="w-4 h-4" />
                <span>Primary Accelerator</span>
              </div>
              <div className="font-mono text-zinc-200 text-[11px]">{telemetry.gpuName}</div>
              <div className="text-zinc-500 text-[10px]">
                Driver: 560.35 | Compute Capability: 8.9 (Ada Lovelace)
              </div>
            </div>

            <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <HardDrive className="w-4 h-4" />
                <span>Unified Memory Bus</span>
              </div>
              <div className="font-mono text-zinc-300 text-[11px]">PCIe 4.0 x16 (64 GB/s)</div>
              <div className="text-zinc-500 text-[10px]">Host RAM: DDR5-6000 ECC Enabled</div>
            </div>
          </div>
        )}

        {/* ===================== MODULE: SETTINGS ===================== */}
        {activeModule === "settings" && (
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
              Configuration Panels
            </span>
            <div className="space-y-1">
              {[
                "Local Inference Daemons",
                "Storage & Cache Directory",
                "Air-Gapped Invariants",
                "GPU Kernel Offload Rules",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 text-xs text-zinc-300 font-medium"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
