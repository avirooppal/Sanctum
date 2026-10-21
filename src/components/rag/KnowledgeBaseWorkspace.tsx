"use client";

import React, { useRef } from "react";
import { Database, UploadCloud, Search, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { IngestedDocument } from "@/types";
import { VaultDropZone } from "./VaultDropZone";
import { DocumentListItem } from "./DocumentListItem";
import { VectorChunkCard } from "./VectorChunkCard";

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

      {/* Main RAG Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: File Vault & Ingested List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full border-r border-surface-border bg-surface-raised/40 overflow-hidden">
          <VaultDropZone onFilesSelected={handleFileUpload} />

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
              collectionDocs.map((doc) => (
                <DocumentListItem
                  key={doc.id}
                  document={doc}
                  isSelected={activeDoc?.id === doc.id}
                  onSelect={() => setSelectedChunkDocumentId(doc.id)}
                  onDelete={() => deleteDocument(doc.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Chunk Inspector & Vector Semantic Tester (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-surface-base">
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
                    <VectorChunkCard
                      key={chunk.id}
                      chunk={chunk}
                      docName={chunk.docName}
                      isRankedMatch
                    />
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
                    <VectorChunkCard key={chunk.id} chunk={chunk} />
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
