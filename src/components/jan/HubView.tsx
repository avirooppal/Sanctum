"use client";

import React, { useState } from "react";
import {
  IconSearch,
  IconChevronDown,
  IconCheck,
  IconTool,
  IconEye,
  IconLoader2,
  IconRefresh,
  IconDownload,
} from "@tabler/icons-react";
import { useAppStore } from "@/store/useAppStore";
import { JAN_STYLE_DOWNLOAD_CATALOG, CuratedModel } from "@/lib/constants";
import { ConsentModal } from "@/components/hub/ConsentModal";
import { handleTitleBarMouseDown } from "@/components/jan/WindowControls";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const HubView: React.FC = () => {
  const {
    models,
    activeModelId,
    setActiveModelId,
    initModels,
    isFetchingModels,
    startModelDownload,
    downloadProgressMap,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"newest" | "downloads">("newest");
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});
  const [consentTarget, setConsentTarget] = useState<CuratedModel | null>(null);

  // Merge locally installed models (from Ollama, Jan, LM Studio, Sanctum) with curated catalog
  const installedAsCatalog: (CuratedModel & { isLocalInstalled?: boolean; quant?: string; author?: string })[] =
    models
      .filter((m) => m.downloaded)
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.category === "reasoning" ? "reasoning" : m.category === "embedding" ? "embedding" : "chat",
        description: m.description || `Locally installed ${m.quantization} model ready for offline inference.`,
        sizeGB: m.fileSizeGB,
        parameters: m.parameters,
        isLocalInstalled: true,
        quant: m.quantization,
        author: m.author || "Local Host",
      }));

  const installedIds = new Set(installedAsCatalog.map((m) => m.id.toLowerCase()));
  const remainingCatalog = JAN_STYLE_DOWNLOAD_CATALOG.filter(
    (c) => !installedIds.has(c.id.toLowerCase())
  );

  const combinedList = downloadedOnly
    ? installedAsCatalog
    : [...installedAsCatalog, ...remainingCatalog];

  const catalog = combinedList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const toggleVariants = (id: string) => {
    setExpandedVariants((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadClick = (item: CuratedModel) => {
    setConsentTarget(item);
  };

  const handleConfirmConsent = () => {
    if (consentTarget) {
      startModelDownload(consentTarget.id);
      setConsentTarget(null);
    }
  };

  const handleRefreshModels = async () => {
    await initModels();
    toast.success("Scanned local model directories and Ollama runtime");
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden select-none">
      {/* Single-Row Top Header & Search Bar (Matches preview (1).webp with space for in-window controls) */}
      <div
        onMouseDown={handleTitleBarMouseDown}
        className="px-6 pr-36 h-12 border-b border-border/50 shrink-0 flex items-center justify-between gap-4"
      >
        {/* Inline Search Input */}
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for models on Hugging Face..."
            className="w-full h-8 rounded-lg bg-transparent pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted/30 transition-colors"
          />
        </div>

        {/* Right Controls: Refresh, Sort Dropdown, Downloaded Switch */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefreshModels}
            disabled={isFetchingModels}
            className="inline-flex items-center gap-1.5 h-7 rounded-lg border border-border/70 bg-card px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Rescan locally installed models"
          >
            <IconRefresh size={13} className={cn(isFetchingModels && "animate-spin")} />
            <span>Rescan ({installedAsCatalog.length})</span>
          </button>

          {/* Sort Selector */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as "newest" | "downloads")}
            className="h-7 rounded-lg border border-border/70 bg-card px-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="downloads">Most downloaded</option>
          </select>

          {/* Downloaded Switch */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Downloaded</span>
            <button
              type="button"
              role="switch"
              aria-checked={downloadedOnly}
              onClick={() => setDownloadedOnly(!downloadedOnly)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                downloadedOnly ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                  downloadedOnly ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Single-Column Full-Width Model Cards List (Matches preview (1).webp) */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {/* Hidden H1 for accessibility and semantic tests */}
          <h1 className="sr-only">Hub</h1>

          {catalog.map((item) => {
            const progressData = downloadProgressMap[item.id];
            const isInstalled =
              Boolean((item as any).isLocalInstalled) ||
              models.some((m) => m.id.toLowerCase() === item.id.toLowerCase() && m.downloaded) ||
              (progressData?.percent === 100 && !progressData?.isDownloading);
            const isActive = activeModelId === item.id;
            const downloadProgress =
              typeof progressData === "number" ? progressData : progressData?.percent;
            const isDownloading = downloadProgress !== undefined && downloadProgress < 100;
            const variantsOpen = expandedVariants[item.id] || false;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-card/85 p-5 shadow-xs transition-all duration-150",
                  isInstalled
                    ? "border-border/90 hover:border-primary/40"
                    : "border-border/70 hover:border-border"
                )}
              >
                <div className="flex flex-col gap-2.5">
                  {/* Title and Top-Right Size + Action */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {item.name}
                        </span>
                        {isInstalled && (
                          <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                            Local
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        by {(item as any).author || "Sanctum / Hugging Face"}
                      </span>
                    </div>

                    {/* Right Column: Size + Fits badge on top, Action button below */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-muted-foreground">
                          {item.sizeGB} GB
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-emerald-400 font-medium">
                          <IconCheck size={12} />
                          Fits
                        </span>
                      </div>

                      {isInstalled ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModelId(item.id);
                            toast.success(`Selected ${item.name} as active model`);
                          }}
                          className={cn(
                            "rounded-full px-4 py-1.5 text-xs font-medium shrink-0 transition-colors shadow-xs",
                            isActive
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-primary hover:bg-primary/90 text-primary-foreground"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <IconCheck size={13} />
                            {isActive ? "Active Model" : "Installed · Use"}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadClick(item)}
                          className={cn(
                            "rounded-full px-4 py-1.5 text-xs font-medium shrink-0 transition-colors shadow-xs",
                            isDownloading
                              ? "bg-primary/50 text-primary-foreground cursor-wait"
                              : "bg-primary hover:bg-primary/90 text-primary-foreground"
                          )}
                        >
                          {isDownloading ? (
                            <span className="flex items-center gap-1">
                              <IconLoader2 size={13} className="animate-spin" /> {downloadProgress}%
                            </span>
                          ) : (
                            `Download · Q4_K_M`
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed max-w-2xl">
                    {item.description}
                  </p>

                  {/* Tags and Show Variants toggle */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40 mt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-2">
                      <IconDownload size={12} />
                      {isInstalled ? (item as any).quant || "Q4_K_M" : "1,240"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/50">
                      <IconTool size={11} /> {item.parameters}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/50">
                      <IconEye size={11} /> Tools
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleVariants(item.id)}
                      className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>Show variants</span>
                      <IconChevronDown
                        size={13}
                        className={cn("transition-transform duration-200", variantsOpen && "rotate-180")}
                      />
                    </button>
                  </div>

                  {variantsOpen && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-muted/30 p-3 text-[11px] border border-border/40">
                      {["Q4_K_M", "Q5_K_M", "Q8_0"].map((q) => (
                        <div key={q} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono text-foreground">{q}</span>
                          <span className="font-mono">{(item.sizeGB * 0.95).toFixed(1)} GB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Consent Modal for Hugging Face network egress */}
      <ConsentModal
        isOpen={Boolean(consentTarget)}
        targetHost="huggingface.co"
        resourceName={consentTarget ? `${consentTarget.name} (${consentTarget.parameters})` : "Model Weights"}
        sizeBytes={consentTarget ? consentTarget.sizeGB * 1024 * 1024 * 1024 : 0}
        onConsent={handleConfirmConsent}
        onDecline={() => setConsentTarget(null)}
      />
    </div>
  );
};
