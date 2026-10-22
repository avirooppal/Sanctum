"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { formatBytes } from "@/lib/utils";
import { IngestedDocument } from "@/types";

export const VaultScreen: React.FC = () => {
  const {
    documents,
    activeCollectionId,
    uploadDocument,
  } = useAppStore();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const docType: IngestedDocument["type"] =
        ext === "pdf" ? "pdf" : ext === "md" ? "md" : ext === "json" ? "json" : "txt";

      uploadDocument(activeCollectionId, {
        name: file.name,
        size: file.size,
        type: docType,
        rawContent: content,
      });
    };

    reader.readAsText(file);
  };

  const defaultSampleDocs = [
    { name: "Team Handbook.pdf", size: "2.4 MB", status: "Indexed" },
    { name: "Product notes.md", size: "84 KB", status: "Indexed" },
    { name: "Q3 planning.csv", size: "412 KB", status: "Indexed" },
  ];

  return (
    <main className="flex p-8 flex-col flex-1 gap-8 overflow-y-auto">
      <div className="flex justify-between items-start gap-8">
        <div>
          <h2 className="font-semibold text-2xl tracking-tight">Your documents</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Bring your own context to every conversation.
          </p>
        </div>
      </div>

      <div className="grid flex-1 gap-8 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Main Vault Area */}
        <section className="flex flex-col gap-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e.dataTransfer.files);
            }}
            className="text-center rounded-lg bg-card border border-dashed border-border hover:border-primary/50 flex px-6 flex-col justify-center items-center gap-3 min-h-52 cursor-pointer transition-colors"
          >
            <Upload className="text-muted-foreground size-7" />
            <p className="font-medium text-foreground text-sm">
              Drop files here or browse
            </p>
            <p className="text-muted-foreground text-xs">
              .pdf · .docx · .txt · .md · .csv
            </p>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {documents.length > 0
              ? documents.map((doc) => (
                  <div key={doc.id} className="rounded-lg bg-card border border-border p-4 shadow-xs">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-muted flex justify-center items-center size-9">
                          <FileText className="text-muted-foreground size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[130px]">{doc.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {formatBytes(doc.sizeBytes)}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className="text-chart-4 size-4" />
                    </div>
                    <div className="text-chart-4 text-xs flex mt-4 items-center gap-2 font-medium">
                      <span>Indexed ({doc.chunkCount} chunks)</span>
                    </div>
                  </div>
                ))
              : defaultSampleDocs.map((sample, idx) => (
                  <div key={idx} className="rounded-lg bg-card border border-border p-4 shadow-xs">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-muted flex justify-center items-center size-9">
                          <FileText className="text-muted-foreground size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sample.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">{sample.size}</p>
                        </div>
                      </div>
                      <CheckCircle2 className="text-chart-4 size-4" />
                    </div>
                    <div className="text-chart-4 text-xs flex mt-4 items-center gap-2 font-medium">
                      <span>Indexed</span>
                    </div>
                  </div>
                ))}
          </div>
        </section>

        {/* Retrieval Settings Sidebar */}
        <aside className="rounded-lg bg-card border border-border p-5 h-fit shadow-xs">
          <h3 className="font-semibold text-sm">Retrieval settings</h3>
          <div className="flex mt-6 flex-col gap-6">
            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="font-medium text-sm">Use hybrid search</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Combine keyword and semantic results
                </p>
              </div>
              <Switch defaultChecked={true} />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Chunk size</label>
              <Select defaultValue="800">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">400 tokens</SelectItem>
                  <SelectItem value="800">800 tokens</SelectItem>
                  <SelectItem value="1200">1200 tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Overlap</label>
              <Select defaultValue="120">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 tokens</SelectItem>
                  <SelectItem value="120">120 tokens</SelectItem>
                  <SelectItem value="240">240 tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="text-left text-muted-foreground text-sm border-t border-border flex pt-4 justify-between items-center hover:text-foreground transition-colors"
            >
              <span>Advanced settings</span>
              <ChevronDown className="size-4" />
            </button>
            {isAdvancedOpen && (
              <div className="rounded-md bg-muted text-muted-foreground text-xs p-3">
                1024d In-Memory Embedding Matrix · Top-k: 4 · Threshold: 0.15 Cosine
              </div>
            )}
          </div>
        </aside>
      </div>

      <p className="text-muted-foreground text-sm">
        {documents.length || 3} documents ready for chat
      </p>
    </main>
  );
};
