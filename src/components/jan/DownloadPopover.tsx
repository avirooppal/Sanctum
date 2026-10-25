"use client";

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
  IconDownload,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const DownloadPopover: React.FC = () => {
  const [isOpen, setIsPopoverOpen] = useState(false);
  const { downloadProgressMap } = useAppStore();

  // Inspect any active downloads
  const activeEntries = Object.entries(downloadProgressMap || {});
  const activeCount = activeEntries.length;

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
        className="w-80 rounded-xl border border-border/80 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <span className="text-xs font-semibold text-foreground">Downloads</span>
          <span className="text-[11px] text-muted-foreground">
            {activeCount === 0 ? "0 active" : `${activeCount} in progress`}
          </span>
        </div>

        <div className="py-2 space-y-2.5 max-h-60 overflow-y-auto">
          {activeCount === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No active downloads
            </div>
          ) : (
            activeEntries.map(([modelId, progressObj]) => {
              const percent = typeof progressObj === "number" ? progressObj : progressObj?.percent || 0;
              return (
                <div
                  key={modelId}
                  className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/40 border border-border/40"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[170px]" title={modelId}>
                      {modelId}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{percent}%</span>
                  </div>

                  {/* Coral Progress bar matching Jan reference */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-200"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                    <span>{(percent * 0.02).toFixed(2)} / 2.00 GB</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Pause"
                      >
                        <IconPlayerPause size={12} />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        title="Cancel"
                      >
                        <IconX size={12} />
                      </button>
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
