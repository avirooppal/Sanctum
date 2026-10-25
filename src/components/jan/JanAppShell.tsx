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
  const { hasCompletedOnboarding, createNewChatSession, toggleExplorer } = useAppStore();
  const [activeModule, setActiveModule] = useState<"chat" | "hub" | "settings">("chat");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("general");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hasModifier = e.ctrlKey || e.metaKey;

      if (!hasModifier) {
        if (e.key === "Escape") {
          setIsSearchDialogOpen(false);
          setIsProjectDialogOpen(false);
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Intercept and prevent native browser accelerators
      if (key === "p") {
        e.preventDefault();
        e.stopPropagation();
        setIsProjectDialogOpen(true);
      } else if (key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchDialogOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        e.stopPropagation();
        createNewChatSession();
        setActiveModule("chat");
        setIsSearchDialogOpen(false);
        setIsProjectDialogOpen(false);
      } else if (key === "b") {
        e.preventDefault();
        e.stopPropagation();
        toggleExplorer();
      } else if (key === ",") {
        e.preventDefault();
        e.stopPropagation();
        setActiveModule("settings");
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [createNewChatSession, toggleExplorer]);

  if (!hasCompletedOnboarding) {
    return <SetupScreen onComplete={() => setActiveModule("chat")} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      <LeftSidebar
        activeModule={activeModule}
        onNavigate={(mod) => setActiveModule(mod)}
        isProjectDialogOpen={isProjectDialogOpen}
        onProjectDialogOpenChange={setIsProjectDialogOpen}
        isSearchDialogOpen={isSearchDialogOpen}
        onSearchDialogOpenChange={setIsSearchDialogOpen}
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
