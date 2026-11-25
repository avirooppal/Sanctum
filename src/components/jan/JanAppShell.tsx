"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { LeftSidebar } from "@/components/jan/LeftSidebar";
import { SetupScreen } from "@/components/jan/SetupScreen";
import { HubView } from "@/components/jan/HubView";
import { SettingsMenu, SettingsSection } from "@/components/jan/SettingsMenu";
import { SettingsGeneral } from "@/components/jan/SettingsGeneral";
import { SettingsShortcuts } from "@/components/jan/sections/SettingsShortcuts";
import { SettingsAppearance } from "@/components/jan/sections/SettingsAppearance";
import { SettingsMcp } from "@/components/jan/sections/SettingsMcp";
import { SettingsLogs } from "@/components/jan/sections/SettingsLogs";
import { SettingsMonitor } from "@/components/jan/sections/SettingsMonitor";
import { SettingsCapabilities } from "@/components/jan/sections/SettingsCapabilities";
import { SettingsNetworkActivity } from "@/components/jan/sections/SettingsNetworkActivity";
import { SettingsMemory } from "@/components/jan/sections/SettingsMemory";
import { JanUpdateToast } from "@/components/jan/JanUpdateToast";
import { ChatScreen } from "@/components/screens/ChatScreen";
import { WindowControls, handleTitleBarMouseDown, handleTitleBarDoubleClick, handleTitleBarContextMenu } from "@/components/jan/WindowControls";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { globalMemoryStore } from "@core/ai/memory/memory_store.ts";
import {
  applyAppearanceConfig,
  loadAppearanceConfig,
  resolveWallpaperStyle,
  saveAppearanceConfig,
  type AppearanceConfig,
} from "@/lib/appearance";

export const JanAppShell: React.FC = () => {
  const {
    hasCompletedOnboarding,
    createNewChatSession,
    toggleExplorer,
    initModels,
  } = useAppStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      createNewChatSession: s.createNewChatSession,
      toggleExplorer: s.toggleExplorer,
      initModels: s.initModels,
    }))
  );
  const [hydrated, setHydrated] = useState(false);
  const [activeModule, setActiveModule] = useState<"chat" | "hub" | "settings">("chat");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("general");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceConfig>(() => loadAppearanceConfig());

  React.useEffect(() => {
    const initial = loadAppearanceConfig();
    setAppearance(initial);
    applyAppearanceConfig(initial);

    // Sync persisted appearance (including custom wallpaper & icon) from host settings.json on boot
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s = data?.settings;
        if (!s) return;
        if (typeof s["user.name"] === "string" && s["user.name"].trim()) {
          useAppStore.getState().setUserName(s["user.name"]);
        }
        const patch: Partial<AppearanceConfig> = {};
        if (s["appearance.theme"]) patch.theme = s["appearance.theme"];
        if (s["appearance.fontSize"]) patch.fontSize = s["appearance.fontSize"];
        if (s["appearance.accentColor"] !== undefined) patch.accentColor = String(s["appearance.accentColor"] || "");
        if (s["appearance.wallpaper"] !== undefined) patch.wallpaper = String(s["appearance.wallpaper"] || "");
        if (typeof s["appearance.wallpaperOpacity"] === "number") patch.wallpaperOpacity = s["appearance.wallpaperOpacity"];
        if (typeof s["appearance.wallpaperBlur"] === "number") patch.wallpaperBlur = s["appearance.wallpaperBlur"];
        if (s["appearance.customIcon"] !== undefined) patch.customIcon = String(s["appearance.customIcon"] || "");
        if (s["appearance.customBrandName"]) patch.customBrandName = String(s["appearance.customBrandName"]);
        if (Object.keys(patch).length > 0) {
          const synced = saveAppearanceConfig(patch);
          setAppearance(synced);
        }
      })
      .catch(() => {});

    const onAppearance = (e: Event) => {
      const detail = (e as CustomEvent<AppearanceConfig>).detail;
      const next = detail || loadAppearanceConfig();
      setAppearance(next);
      applyAppearanceConfig(next);
    };
    window.addEventListener("sanctum-appearance-updated", onAppearance);
    return () => window.removeEventListener("sanctum-appearance-updated", onAppearance);
  }, []);

  React.useEffect(() => {
    Promise.resolve(useAppStore.persist.rehydrate())
      .then(async () => {
        await Promise.all([
          useAppStore.getState().syncThreadsFromHost?.(),
          globalMemoryStore.syncFromHost(),
        ]);
        try {
          const nRes = await fetch("/v1/migration/notices");
          if (nRes.ok) {
            const nData = await nRes.json();
            const notices = Array.isArray(nData?.notices) ? nData.notices : [];
            for (const notice of notices) {
              if (!notice?.id || !notice?.message) continue;
              toast.info(notice.message, {
                duration: Infinity,
                action: {
                  label: "Dismiss",
                  onClick: () => {
                    void fetch("/v1/migration/notices/dismiss", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: notice.id }),
                    }).catch(() => {});
                  },
                },
              });
            }
          }
        } catch {}
      })
      .finally(() => setHydrated(true));
    const mq = window.matchMedia("(max-width: 780px)");
    if (mq.matches) useAppStore.setState({ isExplorerCollapsed: true });
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) useAppStore.setState({ isExplorerCollapsed: true });
    };
    mq.addEventListener("change", onMqChange);
    return () => mq.removeEventListener("change", onMqChange);
  }, [initModels]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (activeModule === "hub" || activeModule === "chat" || activeModule === "settings") {
      initModels();
    }
  }, [activeModule, initModels, hydrated]);

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
      if (e.shiftKey && key === "f") {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("sanctum:toggle-feed-pane"));
      } else if (key === "p") {
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

  if (!hydrated) return <main className="flex h-screen items-center justify-center bg-background text-foreground" role="status">Loading workspace…</main>;

  if (!hasCompletedOnboarding) {
    return (
      <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
        {/* In-window drag bar + top-right window controls */}
        <div
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
          onContextMenu={handleTitleBarContextMenu}
          className="abs-drag-bar fixed top-0 left-0 right-32 h-10 z-30"
        />
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
          <SetupScreen onComplete={(destination = "chat") => setActiveModule(destination)} />
        </main>
      </div>
    );
  }

  const wallpaperStyle = resolveWallpaperStyle(appearance);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      {wallpaperStyle && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 transition-all duration-300"
          style={wallpaperStyle}
        />
      )}
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
      <main className="relative z-10 min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Top draggable strip across views */}
        {activeModule === "settings" && (
          <div
            onMouseDown={handleTitleBarMouseDown}
            onDoubleClick={handleTitleBarDoubleClick}
            onContextMenu={handleTitleBarContextMenu}
            className="abs-drag-bar absolute top-0 left-0 right-32 h-10 z-30"
          />
        )}

        {activeModule === "chat" && (
          <ChatScreen
            onNavigate={setActiveModule}
            onOpenMcpSettings={() => {
              setActiveSettingsSection("mcp-servers");
              setActiveModule("settings");
            }}
          />
        )}

        {activeModule === "hub" && <HubView />}

        {activeModule === "settings" && (
          <div className="flex h-full w-full overflow-x-auto">
            <SettingsMenu
              activeSection={activeSettingsSection}
              onSelectSection={setActiveSettingsSection}
            />
            <div className="flex-1 overflow-y-auto pt-4">
              {activeSettingsSection === "logs" && <SettingsLogs />}
              {activeSettingsSection === "monitor" && <SettingsMonitor />}
              {activeSettingsSection === "general" && <SettingsGeneral />}
              {activeSettingsSection === "capabilities" && <SettingsCapabilities />}
              {activeSettingsSection === "network" && <SettingsNetworkActivity />}
              {activeSettingsSection === "memory" && <SettingsMemory />}
              {activeSettingsSection === "appearance" && <SettingsAppearance />}
              {activeSettingsSection === "shortcuts" && <SettingsShortcuts />}
              {activeSettingsSection === "mcp-servers" && <SettingsMcp />}
            </div>
          </div>
        )}
      </main>
      <JanUpdateToast />
    </div>
  );
};
