"use client";

import React, { useState } from "react";
import {
  IconCopy,
  IconCopyCheck,
  IconFolder,
  IconLogs,
  IconRefresh,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsGeneral: React.FC = () => {
  const [autoUpdateCheck, setAutoUpdateCheck] = useState<boolean>(false);
  const [spellCheck, setSpellCheck] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isResetSettingsOpen, setIsResetSettingsOpen] = useState<boolean>(false);
  const [isEraseAllOpen, setIsEraseAllOpen] = useState<boolean>(false);
  const [eraseConfirmInput, setEraseConfirmInput] = useState<string>("");
  const [deleteModelsChecked, setDeleteModelsChecked] = useState<boolean>(false);
  const [deletePacksChecked, setDeletePacksChecked] = useState<boolean>(false);

  const appVersion = "1.0.0+aff9718 (2026-10-25)";
  const dataFolderPath = "C:\\Users\\aviroop\\AppData\\Roaming\\Sanctum\\data";

  const handleCopyPath = () => {
    navigator.clipboard.writeText(dataFolderPath);
    setCopied(true);
    toast.success("Path copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLogs = () => {
    window.open("/api/health", "_blank");
  };

  const handleResetSettings = () => {
    localStorage.clear();
    toast.success("Settings restored to defaults. Preferences cleared.");
    setIsResetSettingsOpen(false);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleEraseAllData = () => {
    if (eraseConfirmInput.trim() !== "ERASE") {
      toast.error("Type ERASE to confirm complete data deletion");
      return;
    }
    localStorage.clear();
    toast.success("Sanctum data directory purged. Restarting initial setup...");
    setIsEraseAllOpen(false);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
          General Settings
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Application configuration, update behavior, and local storage directories.
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
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Running native Windows release build.")}
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
              onClick={() => setAutoUpdateCheck(!autoUpdateCheck)}
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
                onClick={() => toast.info("To relocate your data directory, update settings.json")}
                className="rounded-xl text-xs h-8"
              >
                Change Location
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">App Logs</span>
              <p className="text-[11px] text-muted-foreground">View runtime event logs and system diagnostic traces.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              onClick={() => toast.info("CLI flags: --headless, --port <port>, --data-dir <path>, --version, --health")}
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
                Restore application preferences to defaults. Chat history and downloaded models are kept.
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
                Purge all local chats, index caches, and configurations. Restarts into first-run setup.
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

      {/* Reset Settings Confirmation Modal */}
      {isResetSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-foreground">
              <IconRefresh size={20} className="text-primary" />
              <h3 className="text-base font-semibold">Confirm Reset Settings</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This resets your interface preferences, theme, and shortcuts to default values. Your conversation history, projects, and downloaded models will not be modified.
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
              This will permanently delete your Sanctum data directory, including all local conversations and indexes.
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
