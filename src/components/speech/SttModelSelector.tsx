"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  IconCheck,
  IconCircleCheck,
  IconCpu,
  IconDownload,
  IconMicrophone,
  IconSparkles,
} from "@tabler/icons-react";
import { STT_MODEL_CATALOG, SttModelSpec } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SttModelStatus extends SttModelSpec {
  installed: boolean;
  active: boolean;
}

interface SttModelSelectorProps {
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  compact?: boolean;
}

export const SttModelSelector: React.FC<SttModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  compact = false,
}) => {
  const downloadProgressMap = useAppStore((s) => s.downloadProgressMap);
  const startModelDownload = useAppStore((s) => s.startModelDownload);

  const [models, setModels] = useState<SttModelStatus[]>(() =>
    STT_MODEL_CATALOG.map((m) => ({
      ...m,
      installed: false,
      active: m.id === (selectedModelId || "qwen3-asr-0.6b"),
    }))
  );
  const [activeModel, setActiveModel] = useState<string>(selectedModelId || "qwen3-asr-0.6b");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const refreshModels = useCallback(async () => {
    try {
      const res = await fetch("/api/audio/models");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.models)) {
        setModels(() =>
          data.models.map((m: any) => {
            const staticSpec = STT_MODEL_CATALOG.find((cat) => cat.id === m.id) || ({} as Partial<SttModelSpec>);
            return {
              ...staticSpec,
              ...m,
              highlights: Array.isArray(m.highlights) && m.highlights.length > 0
                ? m.highlights
                : (staticSpec.highlights || []),
            };
          })
        );
      }
      if (typeof data.activeModel === "string") {
        setActiveModel(selectedModelId || data.activeModel);
      }
    } catch {
      // Keep fallback catalog
    }
  }, [selectedModelId]);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (selectedModelId) {
      setActiveModel(selectedModelId);
    }
  }, [selectedModelId]);

  const handleDownload = async (model: SttModelStatus) => {
    const ok = await startModelDownload(model.id);
    if (ok) {
      toast.success(`${model.name} downloaded and ready`);
      await refreshModels();
      await handleSelect(model.id);
    } else {
      const statusMsg = useAppStore.getState().downloadProgressMap[model.id]?.status;
      toast.error(statusMsg || `Failed to download ${model.name}`);
    }
  };

  const handleSelect = async (modelId: string) => {
    setSelectingId(modelId);
    try {
      const res = await fetch("/api/audio/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      if (res.ok) {
        setActiveModel(modelId);
        onSelectModel?.(modelId);
        toast.success(`Active STT model set to ${modelId}`);
        await refreshModels();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to switch STT model");
      }
    } catch {
      toast.error("Network error while switching STT model");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
      {models.map((item) => {
        const progress = downloadProgressMap[item.id];
        const isDownloading = Boolean(progress?.isDownloading);
        const isInstalled = item.installed || progress?.percent === 100;
        const isActive = activeModel === item.id;
        const isLight = item.tier === "light";

        return (
          <div
            key={item.id}
            className={cn(
              "min-w-0 rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all bg-card overflow-hidden",
              isActive
                ? "border-primary bg-primary/[0.04] shadow-xs"
                : isInstalled
                ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                : "border-border/70 hover:border-primary/40"
            )}
          >
            <div className="space-y-2 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground leading-snug">
                      {item.name}
                    </span>
                    {isActive && (
                      <IconCircleCheck size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {item.parameters} · {item.sizeGB} GB · {item.vramGB} GB VRAM
                  </p>
                </div>

                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[9px] shrink-0 font-medium whitespace-nowrap",
                    isLight
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-purple-500/10 text-purple-400"
                  )}
                >
                  {item.badge}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 font-mono">
                  <IconMicrophone size={10} />
                  {item.languages}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 font-mono">
                  <IconCpu size={10} />
                  {item.hardware}
                </span>
              </div>

              {compact ? (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {item.description}
                </p>
              ) : (
                <ul className="space-y-1 text-[11px] text-muted-foreground leading-snug">
                  {(item.highlights || []).map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <IconSparkles size={11} className="text-primary shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-1">
              {isDownloading ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground truncate max-w-[170px]">
                      {progress.status}
                    </span>
                    <span className="font-mono font-medium text-primary">
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {!isInstalled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(item)}
                      className="flex-1 min-w-[130px] h-8 text-xs gap-1.5 rounded-lg whitespace-nowrap"
                    >
                      <IconDownload size={13} className="text-primary shrink-0" />
                      <span>Download ({item.sizeGB} GB)</span>
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium px-2 py-1 rounded-lg bg-emerald-500/10 whitespace-nowrap">
                      <IconCheck size={12} />
                      Downloaded
                    </span>
                  )}

                  <Button
                    type="button"
                    variant={isActive ? "default" : "secondary"}
                    size="sm"
                    disabled={selectingId === item.id || isActive}
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      "h-8 text-xs rounded-lg whitespace-nowrap shrink-0",
                      isInstalled ? "flex-1 min-w-[100px]" : "px-3.5"
                    )}
                  >
                    {isActive ? "Active STT" : isInstalled ? "Use Model" : "Select"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
