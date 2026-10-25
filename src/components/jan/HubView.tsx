"use client";

import React, { useState } from "react";
import {
  IconSearch,
  IconDownload,
  IconChevronDown,
  IconCheck,
  IconTool,
  IconEye,
  IconFileCode,
  IconLoader2,
} from "@tabler/icons-react";
import { useAppStore } from "@/store/useAppStore";
import { JAN_STYLE_DOWNLOAD_CATALOG, CuratedModel } from "@/lib/constants";
import { ConsentModal } from "@/components/hub/ConsentModal";
import { cn } from "@/lib/utils";

export const HubView: React.FC = () => {
  const { models, startModelDownload, downloadProgressMap } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"newest" | "downloads">("newest");
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});

  // Consent modal state
  const [consentTarget, setConsentTarget] = useState<CuratedModel | null>(null);

  // Filter and sort catalog
  const catalog = JAN_STYLE_DOWNLOAD_CATALOG.filter((item) => {
    if (downloadedOnly) {
      const isDownloaded = models.some((m) => m.id === item.id && m.downloaded);
      if (!isDownloaded) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    return 0; // Default ordering
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

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden select-none">
      {/* Hub Header & Search Controls matching preview (1).webp */}
      <div className="px-8 pt-7 pb-4 border-b border-border/50 shrink-0">
        <div className="flex flex-col gap-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              Hub
            </h1>
            <div className="flex items-center gap-3">
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

              {/* Sort Selector */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="h-8 rounded-lg border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="downloads">Most downloaded</option>
              </select>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <IconSearch className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for models on Hugging Face..."
              className="w-full h-9 rounded-xl border border-border/80 bg-muted/30 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/80"
            />
          </div>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalog.map((item) => {
            const isInstalled = models.some((m) => m.id === item.id && m.downloaded);
            const progressData = downloadProgressMap[item.id];
            const downloadProgress = typeof progressData === "number" ? progressData : progressData?.percent;
            const isDownloading = downloadProgress !== undefined && downloadProgress < 100;
            const variantsOpen = expandedVariants[item.id] || false;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm hover:border-border transition-all duration-200"
              >
                <div className="space-y-3">
                  {/* Title and Top Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{item.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{item.parameters}</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          Fits
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">By Open Source</span>
                    </div>

                    {/* Download Button */}
                    <button
                      type="button"
                      disabled={isInstalled || isDownloading}
                      onClick={() => handleDownloadClick(item)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-medium shrink-0 transition-colors shadow-sm",
                        isInstalled
                          ? "bg-muted text-muted-foreground cursor-default"
                          : isDownloading
                          ? "bg-primary/50 text-primary-foreground cursor-wait"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      )}
                    >
                      {isInstalled ? (
                        <span className="flex items-center gap-1">
                          <IconCheck size={13} /> Installed
                        </span>
                      ) : isDownloading ? (
                        <span className="flex items-center gap-1">
                          <IconLoader2 size={13} className="animate-spin" /> {downloadProgress}%
                        </span>
                      ) : (
                        `Download · Q4_K_M`
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Tags and stats */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/40">
                      <IconTool size={11} /> Tools
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/40">
                      <IconEye size={11} /> Multimodal
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground/80 ml-auto">
                      1,240 downloads
                    </span>
                  </div>
                </div>

                {/* Show Variants toggle */}
                <div className="pt-4 border-t border-border/40 mt-3">
                  <button
                    type="button"
                    onClick={() => toggleVariants(item.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconChevronDown
                      size={13}
                      className={cn("transition-transform duration-200", variantsOpen && "rotate-180")}
                    />
                    <span>Show variants</span>
                  </button>

                  {variantsOpen && (
                    <div className="mt-2.5 space-y-1.5 rounded-xl bg-muted/30 p-2.5 text-[11px] border border-border/40">
                      {["Q4_K_M", "Q5_K_M", "Q8_0"].map((q) => (
                        <div key={q} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono">{q}</span>
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
