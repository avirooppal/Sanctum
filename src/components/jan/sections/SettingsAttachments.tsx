"use client";

import React, { useState, useEffect } from "react";
import { IconPaperclip, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsAttachments: React.FC = () => {
  const [enable, setEnable] = useState<boolean>(true);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<number>(25);
  const [chunkSize, setChunkSize] = useState<number>(800);
  const [chunkOverlap, setChunkOverlap] = useState<number>(150);
  const [topK, setTopK] = useState<number>(4);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["attachments.enable"] !== undefined) setEnable(data.settings["attachments.enable"]);
          if (data.settings["attachments.maxFileSizeMB"]) setMaxFileSizeMB(data.settings["attachments.maxFileSizeMB"]);
          if (data.settings["attachments.chunkSize"]) setChunkSize(data.settings["attachments.chunkSize"]);
          if (data.settings["attachments.chunkOverlap"]) setChunkOverlap(data.settings["attachments.chunkOverlap"]);
          if (data.settings["attachments.topK"]) setTopK(data.settings["attachments.topK"]);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "attachments.enable": enable,
          "attachments.maxFileSizeMB": Number(maxFileSizeMB),
          "attachments.chunkSize": Number(chunkSize),
          "attachments.chunkOverlap": Number(chunkOverlap),
          "attachments.topK": Number(topK),
        }),
      });
      if (res.ok) {
        toast.success("Attachment & RAG settings saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error while saving settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Attachments & Vector Search
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure document ingestion boundaries, text chunking, and semantic vector retrieval.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl text-xs flex items-center gap-1.5"
        >
          <IconDeviceFloppy size={14} />
          <span>Save Changes</span>
        </Button>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Document Ingestion
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Enable Document Attachments</span>
              <p className="text-[11px] text-muted-foreground">Allow uploading PDF, TXT, MD, and CSV files into chats.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enable}
              onClick={() => setEnable(!enable)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                enable ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  enable ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Max File Size (MB)</span>
              <p className="text-[11px] text-muted-foreground">File upload ceiling enforced before parsing.</p>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={maxFileSizeMB}
              onChange={(e) => setMaxFileSizeMB(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vector Chunking & Retrieval
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Chunk Size (chars)</span>
              <p className="text-[11px] text-muted-foreground">Character window for text chunk segmentation.</p>
            </div>
            <input
              type="number"
              min={100}
              max={4000}
              step={50}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Chunk Overlap (chars)</span>
              <p className="text-[11px] text-muted-foreground">Contextual overlap between consecutive chunks.</p>
            </div>
            <input
              type="number"
              min={0}
              max={1000}
              step={10}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Top-K Citations</span>
              <p className="text-[11px] text-muted-foreground">Number of relevant chunks injected into prompt context.</p>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
