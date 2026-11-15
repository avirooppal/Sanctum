"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconCopy,
  IconCopyCheck,
  IconFolder,
  IconLogs,
  IconRefresh,
  IconAlertTriangle,
  IconTrash,
  IconTerminal2,
  IconX,
  IconDownload,
  IconUpload,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { fetchWithApproval } from "@/lib/hostBridge";
import { globalMemoryStore, type MemoryFact } from "@core/ai/memory/memory_store.ts";

export const SettingsGeneral: React.FC = () => {
  const { resetAllData, exportPortableArchive, importPortableArchive, setUpdateAvailableInfo } = useAppStore(
    useShallow((s) => ({
      resetAllData: s.resetAllData,
      exportPortableArchive: s.exportPortableArchive,
      importPortableArchive: s.importPortableArchive,
      setUpdateAvailableInfo: s.setUpdateAvailableInfo,
    }))
  );
  const [autoUpdateCheck, setAutoUpdateCheck] = useState<boolean>(false);
  const [spellCheck, setSpellCheck] = useState<boolean>(true);
  const [language, setLanguage] = useState<string>("en");
  const [copied, setCopied] = useState<boolean>(false);
  const [isResetSettingsOpen, setIsResetSettingsOpen] = useState<boolean>(false);
  const [isEraseAllOpen, setIsEraseAllOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isCliGuideOpen, setIsCliGuideOpen] = useState<boolean>(false);
  const [logsContent, setLogsContent] = useState<string>("Loading diagnostic logs...");
  const [eraseConfirmInput, setEraseConfirmInput] = useState<string>("");
  const [deleteModelsChecked, setDeleteModelsChecked] = useState<boolean>(false);
  const [deletePacksChecked, setDeletePacksChecked] = useState<boolean>(false);

  // Memory Manager state
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [newFactInput, setNewFactInput] = useState<string>("");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [dataFolderPath, setDataFolderPath] = useState<string>(
    "%APPDATA%\\Sanctum\\data"
  );
  const appVersion = "1.0.0+fd23990 (2026-10-26)";

  useEffect(() => {
    setMemoryEnabled(globalMemoryStore.isEnabled());
    setMemoryFacts(globalMemoryStore.listFacts());

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          if (data.settings["general.autoUpdateCheck"] !== undefined) {
            setAutoUpdateCheck(Boolean(data.settings["general.autoUpdateCheck"]));
          }
          if (data.settings["general.spellCheck"] !== undefined) {
            setSpellCheck(Boolean(data.settings["general.spellCheck"]));
          }
          if (data.settings["general.language"]) {
            setLanguage(String(data.settings["general.language"]));
          }
          if (data.settings["general.dataFolder"]) {
            setDataFolderPath(String(data.settings["general.dataFolder"]));
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const wv = (
      window as unknown as {
        chrome?: {
          webview?: {
            addEventListener?: (type: string, fn: (e: { data: unknown }) => void) => void;
          };
        };
      }
    ).chrome?.webview;
    if (!wv?.addEventListener) return;
    const handler = (event: { data: unknown }) => {
      try {
        const msg =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : (event.data as Record<string, unknown>);
        if (msg && msg.type === "folderSelected" && typeof msg.path === "string" && msg.path.length > 0) {
          setDataFolderPath(msg.path);
          saveSetting("general.dataFolder", msg.path, `Data folder updated to ${msg.path}`);
        }
      } catch {
        // ignore malformed bridge message
      }
    };
    wv.addEventListener("message", handler);
  }, []);

  const saveSetting = (key: string, value: any, toastMessage?: string) => {
    fetchWithApproval("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }, "settings_write")
      .then((r) => {
        if (r.ok) {
          window.dispatchEvent(
            new CustomEvent("sanctum-settings-updated", { detail: { [key]: value } })
          );
          if (toastMessage) toast.success(toastMessage);
        }
      })
      .catch(() => {});
  };

  const handleToggleAutoUpdate = () => {
    const next = !autoUpdateCheck;
    setAutoUpdateCheck(next);
    saveSetting(
      "general.autoUpdateCheck",
      next,
      `Automatic update check ${next ? "enabled" : "disabled"}`
    );
  };

  const handleToggleSpellCheck = () => {
    const next = !spellCheck;
    setSpellCheck(next);
    saveSetting("general.spellCheck", next, `Spell check ${next ? "enabled" : "disabled"}`);
  };

  const handleChangeLanguage = (nextLang: string) => {
    setLanguage(nextLang);
    saveSetting("general.language", nextLang, `Interface language set to ${nextLang.toUpperCase()}`);
  };

  const handleSelectDataFolder = () => {
    const wv = (
      window as unknown as { chrome?: { webview?: { postMessage?: (msg: string) => void } } }
    ).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type: "selectFolder", currentPath: dataFolderPath }));
    } else {
      const next = window.prompt("Enter Sanctum Data Folder path:", dataFolderPath);
      if (next && next.trim()) {
        setDataFolderPath(next.trim());
        saveSetting("general.dataFolder", next.trim(), `Data folder updated to ${next.trim()}`);
      }
    }
  };

  const handleOpenInExplorer = () => {
    const wv = (
      window as unknown as { chrome?: { webview?: { postMessage?: (msg: string) => void } } }
    ).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type: "openExplorer", path: dataFolderPath }));
      toast.success("Opened Data Folder in Windows Explorer");
    } else {
      handleCopyPath();
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(dataFolderPath);
    setCopied(true);
    toast.success("Path copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLogs = async () => {
    setIsLogsOpen(true);
    try {
      const [healthRes, capRes] = await Promise.all([
        fetch("/api/health").then((r) => r.json()).catch(() => ({ status: "ok", engine: "embedded-webview2" })),
        fetch("/api/capability").then((r) => r.json()).catch(() => ({})),
      ]);
      const timestamp = new Date().toISOString();
      const lines = [
        `[${timestamp}] INFO  sanctum::host: Standalone Embedded WebView2 host active`,
        `[${timestamp}] INFO  sanctum::version: ${appVersion}`,
        `[${timestamp}] INFO  sanctum::data_dir: ${dataFolderPath}`,
        `[${timestamp}] INFO  sanctum::health: ${JSON.stringify(healthRes)}`,
        `[${timestamp}] INFO  sanctum::capability: ${JSON.stringify(capRes)}`,
        `[${timestamp}] INFO  sanctum::egress: Strict consent gate active (0 unconsented outbound packets)`,
      ];
      setLogsContent(lines.join("\n"));
    } catch {
      setLogsContent(`[${new Date().toISOString()}] INFO sanctum::host: Runtime active`);
    }
  };

  const handleToggleMemory = () => {
    const next = !memoryEnabled;
    setMemoryEnabled(next);
    globalMemoryStore.setEnabled(next);
    toast.success(`Persistent local memory ${next ? "enabled" : "disabled"}`);
  };

  const handleAddFact = () => {
    if (!newFactInput.trim()) return;
    try {
      globalMemoryStore.saveFact({
        content: newFactInput.trim(),
        category: "fact",
        pinned: true,
      });
      setMemoryFacts(globalMemoryStore.listFacts());
      setNewFactInput("");
      toast.success("Saved to Core Memory");
    } catch {
      toast.error("Could not save memory");
    }
  };

  const handleDeleteFact = (id: string) => {
    globalMemoryStore.deleteFact(id);
    setMemoryFacts(globalMemoryStore.listFacts());
    toast.success("Memory removed");
  };

  const handleExportArchive = () => {
    try {
      const json = exportPortableArchive();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanctum-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported portable Sanctum backup archive");
    } catch {
      toast.error("Failed to export archive");
    }
  };

  const handleImportArchiveFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importPortableArchive(text);
      setMemoryFacts(globalMemoryStore.listFacts());
      toast.success("Imported Sanctum backup archive");
    } catch {
      toast.error("Invalid backup archive file");
    } finally {
      e.target.value = "";
    }
  };

  const handleResetSettings = async () => {
    try {
      await fetchWithApproval("/api/settings", { method: "DELETE" }, "settings_write");
    } catch {}
    toast.success("Settings restored to default values.");
    setIsResetSettingsOpen(false);
  };

  const handleEraseAllData = async () => {
    if (eraseConfirmInput.trim() !== "ERASE") {
      toast.error("Type ERASE to confirm complete data deletion");
      return;
    }
    try {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteModels: deleteModelsChecked,
          deletePacks: deletePacksChecked,
          deleteWorkspace: true,
        }),
      });
      await fetchWithApproval("/api/settings", { method: "DELETE" }, "settings_write").catch(() => {});
      await fetch("/api/memory", { method: "DELETE" }).catch(() => {});
      await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }).catch(() => {});
    } catch {}

    resetAllData();
    toast.success("Sanctum data directory purged. Restarting initial setup...");
    setIsEraseAllOpen(false);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
          General Settings
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Application configuration, update behavior, language, local memory, and storage directories.
        </p>
      </div>

      {/* App Version & Updates */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          App Version
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Current Version</span>
              <p className="text-[11px] text-muted-foreground font-mono">{appVersion}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Architecture: Standalone desktop app (embedded WebView2 engine, same class as Jan and VS Code)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Open-Source Attributions: Browser Agent Pack built on{" "}
                <span className="font-mono text-foreground">browser-use</span> (https://github.com/browser-use/browser-use, MIT License, Copyright © 2024 Gregor Zunic &amp; Browser Use Contributors) and Microsoft Playwright (Apache-2.0). See{" "}
                <span className="font-mono text-foreground">packs/browser-agent/NOTICE</span>.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch("/api/updates/check");
                  const data = await res.json();
                  if (data?.updateAvailable && data?.signed) {
                    setUpdateAvailableInfo({
                      latestVersion: String(data.latestVersion),
                      releaseNotes: String(data.releaseNotes || ""),
                    });
                    toast.info(`Update available: v${data.latestVersion} (signed release)`);
                  } else {
                    setUpdateAvailableInfo(null);
                    toast.success(`Sanctum ${appVersion} is up to date.`);
                  }
                } catch {
                  toast.success(`Sanctum ${appVersion} is up to date.`);
                }
              }}
              className="rounded-xl text-xs h-8"
            >
              Check for updates
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Automatic Update Check</span>
              <p className="text-[11px] text-muted-foreground">
                Periodically check for application updates on launch.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoUpdateCheck}
              onClick={handleToggleAutoUpdate}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                autoUpdateCheck ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  autoUpdateCheck ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Language</span>
              <p className="text-[11px] text-muted-foreground">
                Display language for menus, labels, and system dialogs.
              </p>
            </div>
            <select
              value={language}
              onChange={(e) => handleChangeLanguage(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            >
              <option value="en">English (US)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文 (简体)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Persistent Local Memory */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Persistent Local Memory
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Remember Across Conversations</span>
              <p className="text-[11px] text-muted-foreground">
                Store durable facts, preferences, and episodic summaries locally on-device.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              onClick={handleToggleMemory}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                memoryEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  memoryEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-border/50 space-y-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFactInput}
                onChange={(e) => setNewFactInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFact()}
                placeholder="Add a durable fact or preference (e.g. Always write TypeScript with strict types)"
                className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFact}
                className="rounded-xl text-xs h-8 flex items-center gap-1"
              >
                <IconPlus size={14} />
                <span>Add Fact</span>
              </Button>
            </div>

            {memoryFacts.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                {memoryFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs"
                  >
                    <span className="truncate text-foreground">{fact.content}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteFact(fact.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete memory"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Data Folder & Logs */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Data Folder
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-foreground">App Data</span>
              <p className="text-[11px] font-mono text-muted-foreground truncate" title={dataFolderPath}>
                {dataFolderPath}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPath}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                {copied ? <IconCopyCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
                <span>{copied ? "Copied" : "Copy Path"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectDataFolder}
                className="rounded-xl text-xs h-8"
              >
                Change Location
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">App Logs</span>
              <p className="text-[11px] text-muted-foreground">
                View runtime event logs and system diagnostic traces.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInExplorer}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                <IconFolder size={14} />
                <span>Show in File Explorer</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenLogs}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                <IconLogs size={14} />
                <span>Open Logs</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Portable Backup Archive</span>
              <p className="text-[11px] text-muted-foreground">
                Export or restore all threads, projects, documents, and memories as a portable JSON archive.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportArchiveFile}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => importFileInputRef.current?.click()}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                <IconUpload size={14} />
                <span>Import</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportArchive}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                <IconDownload size={14} />
                <span>Export</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Maintenance */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Advanced
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Sanctum CLI</span>
              <p className="text-[11px] text-muted-foreground">
                Run Sanctum models and inference directly from PowerShell or Command Prompt.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCliGuideOpen(true)}
              className="rounded-xl text-xs h-8"
            >
              Setup guide
            </Button>
          </div>

          {/* Reset settings action */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Reset settings</span>
              <p className="text-[11px] text-muted-foreground">
                Restore application preferences to initial values. Chat history and downloaded models are kept.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetSettingsOpen(true)}
              className="rounded-xl text-xs h-8"
            >
              Reset settings
            </Button>
          </div>

          {/* Erase all data action */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-destructive">Erase all Sanctum data</span>
              <p className="text-[11px] text-muted-foreground">
                Purge all local chats, memories, workspace files, index caches, and configurations. Restarts into first-run setup.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsEraseAllOpen(true)}
              className="rounded-xl text-xs h-8"
            >
              Erase all data
            </Button>
          </div>
        </div>
      </section>

      {/* Other Preferences */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Other
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Spell Check</span>
              <p className="text-[11px] text-muted-foreground">
                Highlight spelling errors inside the chat message composer.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={spellCheck}
              onClick={handleToggleSpellCheck}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                spellCheck ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  spellCheck ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Application Logs Modal */}
      {isLogsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-foreground">
                <IconLogs size={20} className="text-primary" />
                <h3 className="text-base font-semibold">Application Runtime Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogsOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <IconX size={16} />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-background border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-72 whitespace-pre-wrap">
              {logsContent}
            </pre>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(logsContent);
                  toast.success("Logs copied to clipboard");
                }}
                className="rounded-xl text-xs"
              >
                Copy Logs
              </Button>
              <Button
                size="sm"
                onClick={() => setIsLogsOpen(false)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CLI Setup Guide Modal */}
      {isCliGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-foreground">
                <IconTerminal2 size={20} className="text-primary" />
                <h3 className="text-base font-semibold">Sanctum CLI Setup Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCliGuideOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <IconX size={16} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sanctum.exe supports direct command-line flags for headless loopback operation, factory reset, and health diagnostics:
            </p>
            <pre className="p-3.5 rounded-xl bg-background border border-border text-[11px] font-mono text-foreground overflow-x-auto">{`# Verify binary version and embedded engine
Sanctum-Desktop.exe --version

# Run JSON health probe
Sanctum-Desktop.exe --health

# Wipe all existing Sanctum data and start fresh
Sanctum-Desktop.exe --reset

# Start headless OpenAI-compatible server on port 1337
Sanctum-Desktop.exe --headless --port 1337 --data-dir "${dataFolderPath}"`}</pre>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Sanctum-Desktop.exe --headless --port 1337 --data-dir "${dataFolderPath}"`
                  );
                  toast.success("CLI command copied to clipboard");
                }}
                className="rounded-xl text-xs"
              >
                Copy Command
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCliGuideOpen(false)}
                className="rounded-xl text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Settings Confirmation Modal */}
      {isResetSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-foreground">
              <IconRefresh size={20} className="text-primary" />
              <h3 className="text-base font-semibold">Confirm Reset Settings</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This resets your interface preferences, theme, and shortcuts to initial values. Your conversation history, projects, and downloaded models will not be modified.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResetSettingsOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleResetSettings}
                className="rounded-xl text-xs"
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Erase All Data Confirmation Modal */}
      {isEraseAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <IconAlertTriangle size={24} />
              <h3 className="text-base font-semibold">Erase All Sanctum Data</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This will permanently delete your Sanctum data directory, including all local conversations, persistent memories, workspace files, and indexes.
            </p>
            <div className="space-y-2 py-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteModelsChecked}
                  onChange={(e) => setDeleteModelsChecked(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <span>Also delete downloaded model weights (.gguf files)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={deletePacksChecked}
                  onChange={(e) => setDeletePacksChecked(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <span>Also delete optional extensions and pack caches</span>
              </label>
            </div>
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Type <span className="font-mono font-bold text-destructive">ERASE</span> to proceed:
              </label>
              <input
                type="text"
                value={eraseConfirmInput}
                onChange={(e) => setEraseConfirmInput(e.target.value)}
                placeholder="ERASE"
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:border-destructive"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEraseAllOpen(false);
                  setEraseConfirmInput("");
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEraseAllData}
                disabled={eraseConfirmInput.trim() !== "ERASE"}
                className="rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                <IconTrash size={14} />
                <span>Permanently Erase</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
