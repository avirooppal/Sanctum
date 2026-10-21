"use client";

import React, { useState, useRef } from "react";
import {
  Database,
  UploadCloud,
  FileText,
  Trash2,
  Search,
  Sparkles,
  Hash,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { IngestedDocument } from "@/types";
import { cn, formatBytes } from "@/lib/utils";

export const KnowledgeBaseWorkspace: React.FC = () => {
  const {
    collections,
    activeCollectionId,
    documents,
    uploadDocument,
    deleteDocument,
    selectedChunkDocumentId,
    setSelectedChunkDocumentId,
    ragSearchQuery,
    setRagSearchQuery,
    searchedChunks,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCol = collections.find((c) => c.id === activeCollectionId) || collections[0];
  const collectionDocs = documents.filter((d) => d.collectionId === activeCol?.id);
  const activeDoc = documents.find((d) => d.id === selectedChunkDocumentId) || collectionDocs[0];

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0 || !activeCol) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const docType: IngestedDocument["type"] =
        ext === "pdf" ? "pdf" : ext === "md" ? "md" : ext === "json" ? "json" : "txt";

      uploadDocument(activeCol.id, {
        name: file.name,
        size: file.size,
        type: docType,
        rawContent: content,
      });
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised/40">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Local RAG Engine & Vector Vault</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
              {activeCol?.embeddingModel || "BGE-Large"}
            </span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Active Vault: <span className="text-zinc-200 font-medium">{activeCol?.name}</span> •{" "}
            {activeCol?.totalChunks} Indexed Chunks across {activeCol?.documentCount} documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.csv,.pdf"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Ingest Document</span>
          </button>
        </div>
      </div>

      {/* Main RAG Layout: Documents list & Drag Drop (Left) + Chunks & Vector Explorer (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: File Vault & Ingested List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full border-r border-surface-border bg-surface-raised/40 overflow-hidden">
          {/* Drag & Drop Vault Zone */}
          <div className="p-4 border-b border-white/5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center",
                isDragging
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
              )}
            >
              <UploadCloud className="w-8 h-8 text-zinc-500 mb-2" />
              <div className="text-xs font-semibold text-zinc-300">
                Drag & Drop Files into Vault
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                Reads local .md, .txt, .json, .csv with real-time vectorization
              </div>
            </div>
          </div>

          {/* Ingested Documents List */}
          <div className="p-3 border-b border-white/5 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Vault Documents ({collectionDocs.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {collectionDocs.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-500">
                Vault is empty. Ingest files to start vector indexing.
              </div>
            ) : (
              collectionDocs.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedChunkDocumentId(doc.id)}
                    className={cn(
                      "group p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2",
                      isSelected
                        ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                        : "border-transparent bg-zinc-900/50 hover:bg-zinc-800/40 text-zinc-300"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold line-clamp-1">{doc.name}</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-1">
                          <span>{formatBytes(doc.sizeBytes)}</span>
                          <span>•</span>
                          <span className="text-cyan-400">{doc.chunkCount} Chunks</span>
                          <span>•</span>
                          <span>{doc.indexedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        {doc.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDocument(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-zinc-500 transition-opacity"
                        title="Delete document and purge vectors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chunk Inspector & Vector Semantic Tester (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-surface-base">
          {/* Query Similarity Tester Header */}
          <div className="p-4 border-b border-surface-border bg-surface-raised/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                <span>Vector Semantic Search & Cosine Inspector</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {searchedChunks.length} Matched Chunks
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Type query to test real-time cosine similarity search..."
                value={ragSearchQuery}
                onChange={(e) => setRagSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            </div>
          </div>

          {/* Chunk Viewer Body: Show Searched Chunks if Query exists, otherwise activeDoc chunks */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ragSearchQuery.trim() ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Real-time Cosine Ranked Candidates</span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    Query Vector: 1024d normalized
                  </span>
                </div>

                {searchedChunks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    No chunks exceeded the similarity threshold for this query.
                  </div>
                ) : (
                  searchedChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="p-4 rounded-xl bg-zinc-900/80 border border-indigo-500/30 space-y-2 shadow-glass"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                            {chunk.docName}
                          </span>
                          <span>Chunk #{chunk.chunkIndex}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{chunk.tokenCount} tokens</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                            {((chunk.similarity || 0) * 100).toFixed(1)}% Cosine Match
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-200 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950/60 p-3 rounded-lg border border-white/5">
                        {chunk.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : activeDoc ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">
                    Chunk Decomposition: {activeDoc.name}
                  </span>
                  <span className="font-mono text-[11px] text-indigo-400">
                    {activeDoc.chunks.length} chunks resident in index
                  </span>
                </div>

                <div className="space-y-3">
                  {activeDoc.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="p-4 rounded-xl bg-zinc-900/70 border border-white/5 space-y-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            Chunk #{chunk.chunkIndex}
                          </span>
                          <span>ID: {chunk.id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{chunk.tokenCount} tokens</span>
                          <span>1024d embedding</span>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950/50 p-3 rounded-lg border border-white/5">
                        {chunk.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Select a document on the left to inspect its vectorized chunks.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
