"use client";

import React, { useState } from "react";
import { LeftSidebar } from "@/components/jan/LeftSidebar";
import { SetupScreen } from "@/components/jan/SetupScreen";
import { HubView } from "@/components/jan/HubView";
import { SettingsMenu, SettingsSection } from "@/components/jan/SettingsMenu";
import { SettingsGeneral } from "@/components/jan/SettingsGeneral";
import { SettingsHardware } from "@/components/jan/sections/SettingsHardware";
import { SettingsLocalApi } from "@/components/jan/sections/SettingsLocalApi";
import { SettingsProxy } from "@/components/jan/sections/SettingsProxy";
import { SettingsAssistants } from "@/components/jan/sections/SettingsAssistants";
import { SettingsAttachments } from "@/components/jan/sections/SettingsAttachments";
import { SettingsShortcuts } from "@/components/jan/sections/SettingsShortcuts";
import { SettingsAppearance } from "@/components/jan/sections/SettingsAppearance";
import { SettingsPrivacy } from "@/components/jan/sections/SettingsPrivacy";
import { SettingsWebSearch } from "@/components/jan/sections/SettingsWebSearch";
import { SettingsProviders } from "@/components/jan/sections/SettingsProviders";
import { SettingsMcp } from "@/components/jan/sections/SettingsMcp";
import { SettingsClaudeCode } from "@/components/jan/sections/SettingsClaudeCode";
import { ChatScreen } from "@/components/screens/ChatScreen";
import { useAppStore } from "@/store/useAppStore";

export const JanAppShell: React.FC = () => {
  const { hasCompletedOnboarding } = useAppStore();
  const [activeModule, setActiveModule] = useState<"chat" | "hub" | "settings">("chat");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("general");

  if (!hasCompletedOnboarding) {
    return <SetupScreen onComplete={() => setActiveModule("chat")} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      <LeftSidebar
        activeModule={activeModule}
        onNavigate={(mod) => setActiveModule(mod)}
      />

      {/* Main Surface View */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeModule === "chat" && <ChatScreen />}

        {activeModule === "hub" && <HubView />}

        {activeModule === "settings" && (
          <div className="flex h-full w-full overflow-hidden">
            <SettingsMenu
              activeSection={activeSettingsSection}
              onSelectSection={setActiveSettingsSection}
            />
            <div className="flex-1 overflow-y-auto">
              {activeSettingsSection === "general" && <SettingsGeneral />}
              {activeSettingsSection === "appearance" && <SettingsAppearance />}
              {activeSettingsSection === "assistants" && <SettingsAssistants />}
              {activeSettingsSection === "attachments" && <SettingsAttachments />}
              {activeSettingsSection === "local-api-server" && <SettingsLocalApi />}
              {activeSettingsSection === "https-proxy" && <SettingsProxy />}
              {activeSettingsSection === "web-search" && <SettingsWebSearch />}
              {activeSettingsSection === "shortcuts" && <SettingsShortcuts />}
              {activeSettingsSection === "hardware" && <SettingsHardware />}
              {activeSettingsSection === "privacy" && <SettingsPrivacy />}
              {activeSettingsSection === "mcp-servers" && <SettingsMcp />}
              {activeSettingsSection === "claude-code" && <SettingsClaudeCode />}
              {activeSettingsSection === "providers" && <SettingsProviders />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
