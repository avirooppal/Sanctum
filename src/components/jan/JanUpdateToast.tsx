"use client";

import React, { useEffect, useState } from "react";
import { IconDownload, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface UpdatePayload {
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  expectedSha256?: string;
  canSelfInstall?: boolean;
}

export const JanUpdateToast: React.FC = () => {
  const [update, setUpdate] = useState<UpdatePayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/updates/check");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data?.updateAvailable && data?.checkSource !== "offline") {
          setUpdate({
            latestVersion: String(data.latestVersion || ""),
            releaseNotes: String(data.releaseNotes || "New Sanctum desktop build available."),
            downloadUrl: String(data.downloadUrl || "https://github.com/avirooppal/Sanctum/raw/main/Sanctum.exe"),
            expectedSha256: data.expectedSha256 ? String(data.expectedSha256) : "",
            canSelfInstall: Boolean(data.canSelfInstall),
          });
        }
      } catch {
        // Silent background check
      }
    }, 2200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!update || dismissed) return null;

  const handleUpdateNow = async () => {
    if (!update.canSelfInstall) {
      window.open(update.downloadUrl, "_blank", "noopener,noreferrer");
      toast.info("Downloading latest Sanctum.exe...");
      return;
    }
    setInstalling(true);
    setProgress({ percent: 2, status: "Downloading latest Sanctum.exe..." });
    try {
      const res = await fetch("/api/updates/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downloadUrl: update.downloadUrl,
          expectedSha256: update.expectedSha256 || "",
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Update failed (HTTP ${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.error) throw new Error(evt.error);
            if (typeof evt.percent === "number") {
              setProgress({ percent: evt.percent, status: evt.status || "Updating..." });
            }
            if (evt.installing) {
              toast.success("Update verified! Restarting Sanctum...");
            }
          } catch (parseErr: any) {
            if (parseErr?.message && !String(parseErr.message).includes("JSON")) throw parseErr;
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Update failed.");
      setInstalling(false);
      setProgress(null);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[330px] rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md p-4 shadow-2xl space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <IconDownload size={16} className="text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              New Version {update.latestVersion}
            </p>
            <p className="text-[11px] text-muted-foreground">Update Available</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notification"
          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
        >
          <IconX size={13} />
        </button>
      </div>

      {showNotes && (
        <div className="rounded-xl bg-muted/50 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed max-h-28 overflow-y-auto">
          {update.releaseNotes}
        </div>
      )}

      {progress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground truncate max-w-[230px]">{progress.status}</span>
            <span className="font-mono text-primary font-medium">{progress.percent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showNotes ? "Hide Notes" : "Show Release Notes"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={installing}
            onClick={() => setDismissed(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Remind Me Later
          </button>
          <Button
            type="button"
            size="sm"
            disabled={installing}
            onClick={() => void handleUpdateNow()}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {installing ? "Updating..." : "Update Now"}
          </Button>
        </div>
      </div>
    </div>
  );
};
