"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Search,
  Sparkles,
  Layers,
  Database,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { formatBytes, cn } from "@/lib/utils";
import { IngestedDocument } from "@/types";

export const VaultScreen: React.FC = () => {
  const {
    documents,
    activeCollectionId,
    uploadDocument,
    deleteDocument,
    selectedChunkDocumentId,
    setSelectedChunkDocumentId,
    ragSearchQuery,
    setRagSearchQuery,
    searchedChunks,
    chunkSize,
    setChunkSize,
    overlap,
    setOverlap,
  } = useAppStore();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [hybridSearch, setHybridSearch] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedChunkDocumentId);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      let content = (e.target?.result as string) || "";
      const ext = file.name.split(".").pop()?.toLowerCase();
      const docType: IngestedDocument["type"] =
        ext === "pdf" ? "pdf" : ext === "md" ? "md" : ext === "json" ? "json" : ext === "csv" ? "csv" : "txt";

      // Clean binary noise if raw pdf/docx string
      if (ext === "pdf" && content.includes("%PDF-")) {
        // Extract readable ASCII string blocks from PDF stream
        const textBlocks = content.match(/[A-Za-z0-9 .,;:!?'"()\-_/]{4,}/g);
        if (textBlocks && textBlocks.length > 0) {
          content = textBlocks.join(" ");
        }
      }

      uploadDocument(activeCollectionId, {
        name: file.name,
        size: file.size,
        type: docType,
        rawContent: content,
      });
    };

    reader.readAsText(file);
  };

  return (
    <main className="flex p-8 flex-col flex-1 gap-8 overflow-y-auto">
      <div className="flex justify-between items-start gap-8">
        <div>
          <h2 className="font-semibold text-2xl tracking-tight flex items-center gap-2.5">
            <Database className="size-6 text-primary" />
            <span>Your Knowledge Vault</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Bring your own sovereign context to every local conversation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1.5 py-1">
            <span className="size-2 rounded-full bg-emerald-500 inline-block" />
            <span>1024d Vector Matrix Active</span>
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 gap-8 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
            className="text-center rounded-xl bg-card border border-dashed border-border hover:border-primary/50 flex px-6 flex-col justify-center items-center gap-3 min-h-48 cursor-pointer transition-colors"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Upload className="size-6" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                Drop files here or browse to ingest
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                .pdf · .docx · .txt · .md · .csv · .json (Automatic 1024d chunking)
              </p>
            </div>
          </div>

          {/* Semantic Search Tester */}
          <div className="rounded-lg bg-card border border-border p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Search className="size-3.5 text-primary" />
              <span>Test Vector Similarity Query</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={ragSearchQuery}
                onChange={(e) => setRagSearchQuery(e.target.value)}
                placeholder="Query semantic memory to inspect matched chunks live..."
                className="h-9 text-xs"
              />
            </div>

            {ragSearchQuery.trim() && (
              <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
                <div className="text-[11px] font-medium text-muted-foreground flex justify-between items-center">
                  <span>Top-K Matched Chunks ({searchedChunks.length})</span>
                  <span className="font-mono text-[10px]">Threshold: &gt;0.15 Cosine</span>
                </div>
                {searchedChunks.length > 0 ? (
                  searchedChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="p-2.5 rounded-md bg-muted/40 border border-border/50 text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-medium text-foreground">{chunk.docName}</span>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          Score: {(chunk.similarity ?? chunk.score ?? 0).toFixed(3)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No matching chunks found above threshold.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Indexed Documents Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center justify-between">
              <span>Vault Documents ({documents.length})</span>
              <span className="text-xs text-muted-foreground font-normal">
                Click any document to inspect vector chunks
              </span>
            </h3>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {documents.length > 0 ? (
                documents.map((doc) => {
                  const isSelected = selectedChunkDocumentId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() =>
                        setSelectedChunkDocumentId(isSelected ? null : doc.id)
                      }
                      className={cn(
                        "rounded-lg bg-card border p-4 shadow-xs group flex flex-col justify-between cursor-pointer transition-all",
                        isSelected
                          ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-muted flex justify-center items-center size-9">
                            <FileText className="text-muted-foreground size-4" />
                          </div>
                          <div>
                            <p
                              className="font-medium text-sm truncate max-w-[130px]"
                              title={doc.name}
                            >
                              {doc.name}
                            </p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {formatBytes(doc.sizeBytes)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocument(doc.id);
                          }}
                          title="Delete document"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive text-muted-foreground transition-opacity"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-emerald-500 text-xs flex mt-4 items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" />
                          <span>Indexed</span>
                        </span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {doc.chunkCount} chunks
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-10 text-center rounded-lg border border-border/50 bg-muted/10 text-muted-foreground text-xs">
                  No documents in vault yet. Drop any .pdf, .txt, or .md file above to index it locally.
                </div>
              )}
            </div>
          </div>

          {/* Selected Document Chunks Inspector */}
          {selectedDoc && (
            <div className="rounded-xl bg-card border border-border p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <h4 className="font-semibold text-sm">
                    Chunks for: {selectedDoc.name}
                  </h4>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selectedDoc.chunks?.length || selectedDoc.chunkCount} chunks
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChunkDocumentId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close inspector
                </button>
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                {selectedDoc.chunks && selectedDoc.chunks.length > 0 ? (
                  selectedDoc.chunks.map((chunk, idx) => (
                    <div
                      key={chunk.id || idx}
                      className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-2 font-mono"
                    >
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/40 pb-1">
                        <span>Chunk #{chunk.chunkIndex + 1}</span>
                        <span>{chunk.tokenCount} tokens · 1024d</span>
                      </div>
                      <p className="font-sans text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                        {chunk.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic col-span-full py-2">
                    No chunk details stored for this file.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Retrieval Settings Sidebar */}
        <aside className="rounded-lg bg-card border border-border p-5 h-fit shadow-xs space-y-6">
          <h3 className="font-semibold text-sm">Retrieval Settings</h3>
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="font-medium text-sm">Use hybrid search</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Combine keyword and 1024d cosine vector results
                </p>
              </div>
              <Switch
                checked={hybridSearch}
                onCheckedChange={setHybridSearch}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Chunk size</label>
              <Select
                value={String(chunkSize || 800)}
                onValueChange={(val) => setChunkSize(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">400 tokens</SelectItem>
                  <SelectItem value="800">800 tokens (Recommended)</SelectItem>
                  <SelectItem value="1200">1200 tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Overlap</label>
              <Select
                value={String(overlap || 120)}
                onValueChange={(val) => setOverlap(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 tokens</SelectItem>
                  <SelectItem value="120">120 tokens (Recommended)</SelectItem>
                  <SelectItem value="240">240 tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="text-left text-muted-foreground text-xs border-t border-border flex pt-4 justify-between items-center hover:text-foreground transition-colors"
            >
              <span>Advanced vector matrix</span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  isAdvancedOpen && "rotate-180"
                )}
              />
            </button>
            {isAdvancedOpen && (
              <div className="rounded-md bg-muted/60 text-muted-foreground text-xs p-3 font-mono space-y-1">
                <div>Dimensions: 1024-d unit normalized</div>
                <div>Top-K: 4 chunks injected into prompt</div>
                <div>Similarity threshold: 0.15 Cosine</div>
                <div>Storage: Indexed on-device</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <p className="text-muted-foreground text-xs">
        {documents.length} document{documents.length === 1 ? "" : "s"} ready for instant grounded chat.
      </p>
    </main>
  );
};
