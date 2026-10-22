"use client";

import React, { useEffect } from "react";
import { SanctumShell } from "@/components/screens/SanctumShell";
import { ChatScreen } from "@/components/screens/ChatScreen";
import { ArenaScreen } from "@/components/screens/ArenaScreen";
import { VaultScreen } from "@/components/screens/VaultScreen";
import { AgentsScreen } from "@/components/screens/AgentsScreen";
import { ResearchScreen } from "@/components/screens/ResearchScreen";
import { ModelsScreen } from "@/components/screens/ModelsScreen";
import { HardwareConfigModal } from "@/components/hub/HardwareConfigModal";
import { useAppStore } from "@/store/useAppStore";

export const AppShell: React.FC = () => {
  const { activeModule, initModels, updateRealTelemetry } = useAppStore();

  // Initialize real local models from Ollama and real hardware telemetry on mount
  useEffect(() => {
    initModels();
    updateRealTelemetry();
  }, [initModels, updateRealTelemetry]);

  return (
    <SanctumShell>
      {activeModule === "chat" && <ChatScreen />}
      {activeModule === "arena" && <ArenaScreen />}
      {(activeModule === "vault" || activeModule === "rag") && <VaultScreen />}
      {activeModule === "agents" && <AgentsScreen />}
      {activeModule === "research" && <ResearchScreen />}
      {(activeModule === "settings" || activeModule === "hub" || activeModule === "telemetry") && (
        <ModelsScreen />
      )}

      {/* Hardware Configuration Modal */}
      <HardwareConfigModal />
    </SanctumShell>
  );
};
