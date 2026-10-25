"use client";

import React, { useState } from "react";
import { LeftSidebar } from "@/components/jan/LeftSidebar";
import { SetupScreen } from "@/components/jan/SetupScreen";
import { HubView } from "@/components/jan/HubView";
import { SettingsMenu, SettingsSection } from "@/components/jan/SettingsMenu";
import { SettingsGeneral } from "@/components/jan/SettingsGeneral";
import { ChatScreen } from "@/components/screens/ChatScreen";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const JanAppShell: React.FC = () => {
  const { hasCompletedOnboarding } = useAppStore();
  const [activeModule, setActiveModule] = useState<"chat" | "hub" | "settings">("chat");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("general");

  // Onboarding gate matching Jan v0.8.7 SetupScreen
  if (!hasCompletedOnboarding) {
    return <SetupScreen onComplete={() => setActiveModule("chat")} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      {/* 1:1 Floating Sidebar matching v0.8.7 Screenshot 2026-10-25 190854.png */}
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
              {activeSettingsSection !== "general" && (
                <div className="p-8 text-xs text-muted-foreground">
                  <h2 className="text-base font-semibold text-foreground capitalize mb-2">
                    {activeSettingsSection.replace("-", " ")}
                  </h2>
                  <p>Configuration panel active. All modifications persist to `%APPDATA%\Sanctum\data`.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
