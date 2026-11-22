"use client";

import React, { useState, useRef, useEffect } from "react";
import { IconFlame, IconSelector, IconSettings, IconCheck } from "@tabler/icons-react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

interface JanModelHeaderPillProps {
  onToggleDetails: () => void;
  detailsOpen?: boolean;
  placement?: "bottom" | "top";
  sessionId?: string;
}

export const JanModelHeaderPill: React.FC<JanModelHeaderPillProps> = ({
  onToggleDetails,
  detailsOpen = false,
  placement = "bottom",
  sessionId,
}) => {
  const { models, activeModelId, setActiveModelId, chatSessions, updateSessionParams } = useAppStore(
    useShallow((s) => ({
      models: s.models,
      activeModelId: s.activeModelId,
      setActiveModelId: s.setActiveModelId,
      chatSessions: s.chatSessions,
      updateSessionParams: s.updateSessionParams,
    }))
  );

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const installedModels = models.filter((m) => m.downloaded);
  const scopedSession = sessionId ? chatSessions.find((s) => s.id === sessionId) : null;
  const effectiveModelId = scopedSession?.modelId || activeModelId;
  const activeModel =
    installedModels.find((m) => m.id === effectiveModelId) || installedModels[0] || models[0];
  const label = activeModel?.name || activeModel?.id || "Select model";
  const isReady = Boolean(activeModel && (activeModel.downloaded || activeModel.isLoaded));

  return (
    <div ref={containerRef} className="relative shrink-0">
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/90 shadow-xs",
          placement === "top" ? "h-6 px-2" : "rounded-xl px-2.5 py-1"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Switch active model"
          className={cn(
            "inline-flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors max-w-[160px]",
            placement === "top" ? "text-[11px]" : "gap-1.5 text-xs max-w-[180px]"
          )}
        >
          <IconFlame size={placement === "top" ? 12 : 14} className="text-primary shrink-0" />
          <span className="truncate">{label}</span>
          <IconSelector size={placement === "top" ? 11 : 13} className="text-muted-foreground shrink-0" />
        </button>

        <span className="h-3.5 w-px bg-border/70 mx-0.5" />

        <button
          type="button"
          onClick={onToggleDetails}
          title="Model & sampling parameters"
          aria-label="Model parameters"
          className={cn(
            "p-0.5 rounded-md transition-colors",
            detailsOpen
              ? "text-primary bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <IconSettings size={13} />
        </button>

        <span
          title={isReady ? "Model engine active" : "Engine offline"}
          className={cn(
            "ml-0.5 size-2 rounded-full shrink-0",
            isReady
              ? "bg-emerald-500 shadow-[0_0_7px_rgba(16,185,129,0.75)]"
              : "bg-amber-500/80"
          )}
        />
      </div>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-64 rounded-xl border border-border bg-popover shadow-2xl p-1.5 space-y-0.5 max-h-72 overflow-y-auto",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-1.5"
          )}
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Local Models ({installedModels.length})
          </div>
          {installedModels.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">
              No local models detected. Download one in Hub.
            </div>
          ) : (
            installedModels.map((m) => {
              const selected = m.id === activeModel?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (sessionId) {
                      updateSessionParams(sessionId, { modelId: m.id });
                    } else {
                      setActiveModelId(m.id);
                    }
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                    selected
                      ? "bg-primary/15 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{m.name || m.id}</div>
                    {m.parameters && (
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {m.parameters}
                        {m.fileSizeGB ? ` · ${m.fileSizeGB} GB` : ""}
                      </div>
                    )}
                  </div>
                  {selected && <IconCheck size={14} className="text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
