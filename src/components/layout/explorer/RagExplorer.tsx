"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const RagExplorer: React.FC = () => {
  const {
    collections,
    activeCollectionId,
    setActiveCollectionId,
    createCollection,
  } = useAppStore();

  const [newColName, setNewColName] = useState("");
  const [isCreatingCol, setIsCreatingCol] = useState(false);

  const handleCreate = () => {
    if (newColName.trim()) {
      createCollection(newColName.trim(), "User ingested document vault", "BGE-Large-EN-v1.5");
      setNewColName("");
      setIsCreatingCol(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
          Vector Collections
        </span>
        <button
          onClick={() => setIsCreatingCol(!isCreatingCol)}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
          title="New Collection"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {isCreatingCol && (
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
          <input
            type="text"
            placeholder="Collection Name..."
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreate}
            className="w-full py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500"
          >
            Create
          </button>
        </div>
      )}

      <div className="space-y-1">
        {collections.map((col) => {
          const isActive = activeCollectionId === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActiveCollectionId(col.id)}
              className={cn(
                "w-full p-2.5 rounded-lg border text-left transition-all space-y-1",
                isActive
                  ? "bg-zinc-800/90 border-indigo-500/40 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{col.name}</span>
                <span className="text-[10px] font-mono text-indigo-400">
                  {col.documentCount} docs
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 line-clamp-1">{col.description}</div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 pt-0.5">
                <span>{col.totalChunks} Chunks</span>
                <span>•</span>
                <span>{col.vectorDimensions}d</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
