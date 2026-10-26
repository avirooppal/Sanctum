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
import { WindowControls, handleTitleBarMouseDown } from "@/components/jan/WindowControls";
import { useAppStore } from "@/store/useAppStore";

export const JanAppShell: React.FC = () => {
  const {
    hasCompletedOnboarding,
    createNewChatSession,
    toggleExplorer,
    initModels,
  } = useAppStore();
  const [activeModule, setActiveModule] = useState<"chat" | "hub" | "settings">("chat");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("general");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("llamacpp");
  const [isAddProviderOpen, setIsAddProviderOpen] = useState<boolean>(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  React.useEffect(() => {
    useAppStore.persist.rehydrate();
    initModels();
  }, [initModels]);

  React.useEffect(() => {
    if (activeModule === "hub" || activeModule === "chat" || activeModule === "settings") {
      initModels();
    }
  }, [activeModule, initModels]);

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
    return (
      <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
        {/* In-window drag bar + top-right window controls */}
        <div
          className="fixed top-0 right-0 h-10 z-40 flex items-center justify-end px-2 pointer-events-auto"
        >
          <WindowControls />
        </div>
        <LeftSidebar
          activeModule={activeModule}
          onNavigate={(mod) => setActiveModule(mod)}
          isProjectDialogOpen={isProjectDialogOpen}
          onProjectDialogOpenChange={setIsProjectDialogOpen}
          isSearchDialogOpen={isSearchDialogOpen}
          onSearchDialogOpenChange={setIsSearchDialogOpen}
        />
        <main className="flex-1 flex overflow-hidden relative">
          <SetupScreen onComplete={() => setActiveModule("chat")} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      {/* Top-right in-window native controls (Minimize, Maximize, Close) */}
      <div
        className="fixed top-0 right-0 h-10 z-50 flex items-center justify-end pr-2 pl-2 pointer-events-auto"
      >
        <WindowControls />
      </div>

      <LeftSidebar
        activeModule={activeModule}
        onNavigate={(mod) => setActiveModule(mod)}
        isProjectDialogOpen={isProjectDialogOpen}
        onProjectDialogOpenChange={setIsProjectDialogOpen}
        isSearchDialogOpen={isSearchDialogOpen}
        onSearchDialogOpenChange={setIsSearchDialogOpen}
      />

      {/* Main Surface View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top draggable strip across views */}
        {activeModule === "settings" && (
          <div
            onMouseDown={handleTitleBarMouseDown}
            className="abs-drag-bar absolute top-0 left-0 right-28 h-10 z-30"
          />
        )}

        {activeModule === "chat" && <ChatScreen onNavigate={setActiveModule} />}

        {activeModule === "hub" && <HubView />}

        {activeModule === "settings" && (
          <div className="flex h-full w-full overflow-hidden">
            <SettingsMenu
              activeSection={activeSettingsSection}
              onSelectSection={setActiveSettingsSection}
              selectedProviderId={selectedProviderId}
              onSelectProvider={setSelectedProviderId}
              onAddProvider={() => setIsAddProviderOpen(true)}
            />
            <div className="flex-1 overflow-y-auto pt-4">
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
              {activeSettingsSection === "providers" && (
                <SettingsProviders
                  selectedProviderId={selectedProviderId}
                  onSelectProvider={setSelectedProviderId}
                  openAddModal={isAddProviderOpen}
                  onOpenAddModalChange={setIsAddProviderOpen}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
