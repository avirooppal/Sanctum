"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconFileText,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchWithApproval } from "@/lib/hostBridge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface OcrEngineItem {
  id: "windows-native" | "paddleocr-vl-1.6";
  name: string;
  provider: string;
  badge: string;
  sizeLabel: string;
  description: string;
  highlights: string[];
  installed: boolean;
  active: boolean;
  downloadable: boolean;
  sidecarOnline?: boolean;
}

const DEFAULT_OCR_ENGINES: OcrEngineItem[] = [
  {
    id: "windows-native",
    name: "Windows Built-in Offline OCR",
    provider: "Windows Runtime",
    badge: "Built-in · Zero Setup",
    sizeLabel: "0 MB",
    description: "Instant offline OCR for scanned PDFs using Windows native recognizer.",
    highlights: ["Works immediately out of the box", "Zero VRAM / fast on CPU", "100% offline"],
    installed: true,
    active: true,
    downloadable: false,
  },
  {
    id: "paddleocr-vl-1.6",
    name: "PaddleOCR-VL-1.6 (0.9B)",
    provider: "PaddlePaddle",
    badge: "Pro · Tables & Formulas",
    sizeLabel: "~1.8 GB",
    description: "Vision-language OCR model preserving tables, headings, LaTeX formulas, and reading order.",
    highlights: ["Clean Markdown & JSON output", "Tables & math formulas", "100% offline after download"],
    installed: false,
    active: false,
    downloadable: true,
    sidecarOnline: false,
  },
];

interface OcrModelSelectorProps {
  compact?: boolean;
}

export const OcrModelSelector: React.FC<OcrModelSelectorProps> = ({ compact = false }) => {
  const [engines, setEngines] = useState<OcrEngineItem[]>(DEFAULT_OCR_ENGINES);
  const [activeId, setActiveId] = useState<string>("windows-native");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ocr/models");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.models)) {
        setEngines(
          DEFAULT_OCR_ENGINES.map((def) => {
            const match = data.models.find((m: any) => m.id === def.id);
            return match ? { ...def, ...match } : def;
          })
        );
      }
      if (typeof data?.activeModel === "string") {
        setActiveId(data.activeModel);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSelect = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetchWithApproval(
        "/api/ocr/models",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: id }),
        },
        "settings_write"
      );
      if (res.ok) {
        setActiveId(id);
        await refresh();
        toast.success(`Active OCR engine set to ${id === "paddleocr-vl-1.6" ? "PaddleOCR-VL-1.6" : "Windows Offline OCR"}`);
      }
    } catch {
      toast.error("Could not update OCR selection.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (engine: OcrEngineItem) => {
    setDownloadingId(engine.id);
    setProgress({ percent: 2, status: "Connecting to Hugging Face..." });
    try {
      const res = await fetchWithApproval(
        "/api/ocr/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: engine.id }),
        },
        "model_download"
      );
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Download failed (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed);
            if (ev.error) throw new Error(ev.error);
            if (typeof ev.percent === "number") {
              setProgress({ percent: ev.percent, status: ev.status || "Downloading..." });
            }
          } catch (parseErr: any) {
            if (parseErr?.message && !trimmed.startsWith("{")) continue;
            if (parseErr instanceof Error && trimmed.includes('"error"')) throw parseErr;
          }
        }
      }

      toast.success(`${engine.name} downloaded locally!`);
      await refresh();
      await handleSelect(engine.id);
    } catch (err: any) {
      toast.error(err?.message || `Failed to download ${engine.name}`);
    } finally {
      setDownloadingId(null);
      setProgress(null);
    }
  };

  const handleRemove = async (engine: OcrEngineItem) => {
    setBusyId(engine.id);
    try {
      const res = await fetchWithApproval(
        "/api/ocr/download",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: engine.id }),
        },
        "settings_write"
      );
      if (res.ok) {
        toast.success(`Removed ${engine.name} weights`);
        await refresh();
      }
    } catch {
      toast.error("Failed to remove OCR weights");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={cn("grid gap-2.5", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2")}>
      {engines.map((engine) => {
        const isSelected = activeId === engine.id;
        const isDownloading = downloadingId === engine.id;
        return (
          <div
            key={engine.id}
            className={cn(
              "rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all",
              isSelected
                ? "border-primary/70 bg-primary/5 shadow-xs"
                : "border-border/70 bg-card/80 hover:border-border"
            )}
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <IconFileText size={15} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {engine.name}
                  </span>
                </div>
                {isSelected && <IconCircleCheck size={15} className="text-primary shrink-0" />}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                  {engine.badge}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {engine.sizeLabel}
                </span>
                {engine.id === "paddleocr-vl-1.6" && engine.sidecarOnline && (
                  <span className="text-[10px] font-mono text-emerald-400">· Sidecar Online</span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {engine.description}
              </p>

              <ul className="space-y-0.5 pt-0.5">
                {engine.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-1.5 text-[10.5px] text-foreground/80">
                    <IconCheck size={11} className="text-emerald-400 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isDownloading && progress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span className="truncate">{progress.status}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.max(4, progress.percent)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
              {engine.installed ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    disabled={isSelected || busyId === engine.id}
                    onClick={() => void handleSelect(engine.id)}
                    className="h-7 rounded-lg text-[11px] flex-1"
                  >
                    {isSelected ? "Active" : "Use Engine"}
                  </Button>
                  {engine.downloadable && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === engine.id}
                      onClick={() => void handleRemove(engine)}
                      title="Delete downloaded weights"
                      className="h-7 px-2 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <IconTrash size={13} />
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(downloadingId)}
                  onClick={() => void handleDownload(engine)}
                  className="h-7 rounded-lg text-[11px] w-full gap-1.5"
                >
                  {isDownloading ? (
                    <IconRefresh size={12} className="animate-spin" />
                  ) : (
                    <IconDownload size={12} />
                  )}
                  <span>{isDownloading ? "Downloading..." : `Download (${engine.sizeLabel})`}</span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
