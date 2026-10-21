"use client";

import React, { useEffect } from "react";
import { LeftRail } from "@/components/layout/LeftRail";
import { ContextExplorer } from "@/components/layout/ContextExplorer";
import { TelemetryDock } from "@/components/layout/TelemetryDock";
import { ModelHubView } from "@/components/hub/ModelHubView";
import { ChatCanvas } from "@/components/chat/ChatCanvas";
import { ArenaCanvas } from "@/components/arena/ArenaCanvas";
import { DeepResearchWorkspace } from "@/components/research/DeepResearchWorkspace";
import { KnowledgeBaseWorkspace } from "@/components/rag/KnowledgeBaseWorkspace";
import { SettingsView } from "@/components/settings/SettingsView";
import { HardwareConfigModal } from "@/components/hub/HardwareConfigModal";
import { HardwareDetailsModal } from "@/components/telemetry/HardwareDetailsModal";
import { useAppStore } from "@/store/useAppStore";

export const AppShell: React.FC = () => {
  const { activeModule, toggleExplorer, initModels, updateRealTelemetry } = useAppStore();

  // Initialize real local models from Ollama and real hardware telemetry on mount
  useEffect(() => {
    initModels();
    updateRealTelemetry();
  }, [initModels, updateRealTelemetry]);

  // Keyboard shortcut Ctrl+B to toggle Context Explorer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleExplorer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleExplorer]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-base text-foreground font-sans antialiased">
      {/* Upper Core Application Workspace */}
      <div className="flex flex-1 h-[calc(100vh-2.25rem)] w-full overflow-hidden">
        {/* Global Module Sidebar (Left Rail) */}
        <LeftRail />

        {/* Dynamic Context Explorer Panel (Left-Center) */}
        <ContextExplorer />

        {/* Primary Canvas (Center/Right Dynamic Viewport) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeModule === "hub" && <ModelHubView />}
          {activeModule === "chat" && <ChatCanvas />}
          {activeModule === "arena" && <ArenaCanvas />}
          {activeModule === "research" && <DeepResearchWorkspace />}
          {activeModule === "rag" && <KnowledgeBaseWorkspace />}
          {activeModule === "telemetry" && <ModelHubView />}
          {activeModule === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Persistent Hardware Telemetry Dock (Bottom Rail) */}
      <TelemetryDock />

      {/* Floating Modals & Drawers */}
      <HardwareConfigModal />
      <HardwareDetailsModal />
    </div>
  );
};
