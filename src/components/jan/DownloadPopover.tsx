"use client";

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  IconPlayerPause,
  IconX,
  IconDownload,
  IconCheck,
  IconTrash,
} from "@tabler/icons-react";
import { useAppStore } from "@/store/useAppStore";
import { JAN_STYLE_DOWNLOAD_CATALOG } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const DownloadPopover: React.FC = () => {
  const [isOpen, setIsPopoverOpen] = useState(false);
  const { downloadProgressMap, cancelModelDownload, clearDownloadEntry } = useAppStore();

  const entries = Object.entries(downloadProgressMap || {});
  const activeEntries = entries.filter(([_, p]) => {
    const isDownloading = typeof p === "number" ? p < 100 : p?.isDownloading !== false && (p?.percent ?? 0) < 100;
    return isDownloading;
  });
  const activeCount = activeEntries.length;

  const handleClearCompleted = () => {
    entries.forEach(([modelId, p]) => {
      const isDone = typeof p === "number" ? p >= 100 : !p?.isDownloading || (p?.percent ?? 0) >= 100;
      if (isDone && clearDownloadEntry) {
        clearDownloadEntry(modelId);
      }
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Download Manager"
          className="relative flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Downloads"
        >
          <IconDownload className="size-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="right"
        className="w-84 rounded-xl border border-border/80 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <span className="text-xs font-semibold text-foreground">Downloads</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {activeCount === 0 ? "0 active" : `${activeCount} in progress`}
            </span>
            {entries.some(([_, p]) => (typeof p === "number" ? p >= 100 : !p?.isDownloading || (p?.percent ?? 0) >= 100)) && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                Clear finished
              </button>
            )}
          </div>
        </div>

        <div className="py-2 space-y-2.5 max-h-60 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No recent downloads
            </div>
          ) : (
            entries.map(([modelId, progressObj]) => {
              const percent = typeof progressObj === "number" ? progressObj : progressObj?.percent || 0;
              const isDownloading = typeof progressObj === "number" ? percent < 100 : progressObj?.isDownloading !== false && percent < 100;
              const statusText = typeof progressObj === "object" ? progressObj?.status : undefined;
              
              // Get real model size in GB
              const catalogEntry = JAN_STYLE_DOWNLOAD_CATALOG.find(
                (c) => c.id.toLowerCase() === modelId.toLowerCase()
              );
              const totalGB = catalogEntry?.sizeGB || (modelId.includes("8b") ? 4.9 : 2.0);
              const currentGB = ((percent / 100) * totalGB).toFixed(2);

              return (
                <div
                  key={modelId}
                  className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/40 border border-border/40"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[170px]" title={modelId}>
                      {catalogEntry?.name || modelId}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {isDownloading ? `${percent}%` : "Complete"}
                    </span>
                  </div>

                  {/* Coral Progress bar matching Jan reference */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-200",
                        isDownloading ? "bg-primary" : "bg-emerald-500"
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                    <span>
                      {isDownloading
                        ? `${currentGB} / ${totalGB.toFixed(2)} GB`
                        : `${totalGB.toFixed(2)} GB · Ready`}
                    </span>
                    <div className="flex items-center gap-1">
                      {isDownloading ? (
                        <button
                          type="button"
                          onClick={() => cancelModelDownload?.(modelId)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                          title="Cancel download"
                        >
                          <IconX size={12} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => clearDownloadEntry?.(modelId)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Dismiss"
                        >
                          <IconCheck size={12} className="text-emerald-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
