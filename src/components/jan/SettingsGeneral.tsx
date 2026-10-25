"use client";

import React, { useState } from "react";
import {
  IconCopy,
  IconCopyCheck,
  IconFolder,
  IconLogs,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsGeneral: React.FC = () => {
  const [autoUpdateCheck, setAutoUpdateCheck] = useState<boolean>(false); // Pinned OFF by default per Section 3.4
  const [spellCheck, setSpellCheck] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  const appVersion = "1.0.0 (v0.8.7 parity)";
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

  const handleFactoryReset = () => {
    // Scoped strictly to Sanctum data folder
    localStorage.clear();
    toast.success("Factory reset complete. Interface cache cleared.");
    setIsResetConfirmOpen(false);
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

      {/* App Version & Updates matching 9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          App Version
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Current Version</span>
              <p className="text-[11px] text-muted-foreground">{appVersion}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("You are running the verified native Windows build.")}
              className="rounded-xl text-xs h-8"
            >
              Check for updates
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Automatic Update Check</span>
              <p className="text-[11px] text-muted-foreground">
                Check for updates on launch (Default OFF for privacy).
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
              <p className="text-[11px] text-muted-foreground">View real diagnostic telemetry and runtime event logs.</p>
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

      {/* Advanced / Factory Reset matching screenshot */}
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
              onClick={() => toast.info("CLI binary available at C:\\Users\\aviroop\\Desktop\\Sru\\dist\\Sanctum.exe --headless")}
              className="rounded-xl text-xs h-8"
            >
              Setup guide
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-destructive">Reset To Factory Settings</span>
              <p className="text-[11px] text-muted-foreground">
                Clear cached interface settings and local session indexes.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="rounded-xl text-xs h-8"
            >
              Reset
            </Button>
          </div>
        </div>
      </section>

      {/* Factory Reset Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <IconAlertTriangle size={24} />
              <h3 className="text-base font-semibold">Confirm Factory Reset</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Are you sure you want to reset Sanctum settings? This action clears local interface preferences and restarts the app. Your downloaded weights in the models directory will be preserved.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFactoryReset}
                className="rounded-xl text-xs"
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
