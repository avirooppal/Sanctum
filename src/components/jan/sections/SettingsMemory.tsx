"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Brain, Pin, Trash2, Download, Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  provenance: "user" | "model-after-user-prompt" | "model-after-untrusted-content" | "tool" | string;
  pinned?: boolean;
  sessionId?: string;
  createdAt?: string;
}

export const SettingsMemory: React.FC = () => {
  const [facts, setFacts] = useState<MemoryEntry[]>([]);
  const [maxCount, setMaxCount] = useState(200);
  const [maxChars, setMaxChars] = useState(2048);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch("/v1/memory");
      if (res.ok) {
        const data = await res.json();
        setFacts(Array.isArray(data?.facts) ? data.facts : []);
        if (typeof data?.maxCount === "number") setMaxCount(data.maxCount);
        if (typeof data?.maxChars === "number") setMaxChars(data.maxChars);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const handleAdd = async () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    const res = await fetch("/v1/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed, category: "fact" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Could not save memory");
      return;
    }
    setNewContent("");
    await loadMemories();
    toast.success("Memory saved");
  };

  const handleSaveEdit = async (id: string) => {
    const res = await fetch(`/v1/memory/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editDraft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Could not update memory");
      return;
    }
    setEditingId(null);
    await loadMemories();
  };

  const handleTogglePin = async (entry: MemoryEntry) => {
    const res = await fetch(`/v1/memory/${encodeURIComponent(entry.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !entry.pinned }),
    });
    if (res.ok) await loadMemories();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/v1/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      await loadMemories();
      toast.success("Memory deleted");
    }
  };

  const handleExport = async () => {
    const res = await fetch("/v1/memory/export");
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([data?.content || "{}"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanctum-memory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const provenanceBadgeClass = (prov: string) => {
    if (prov === "user") return "bg-emerald-500/15 text-emerald-300";
    if (prov === "model-after-untrusted-content") return "bg-amber-500/15 text-amber-300";
    return "bg-sky-500/15 text-sky-300";
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Memory Editor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {facts.length} / {maxCount} stored facts (max {maxChars} chars each). Saves requested after untrusted file/web content always require explicit approval.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3.5" />
          Export JSON
        </button>
      </div>

      {/* Add new user memory */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 flex gap-2">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={maxChars}
          placeholder="Add a durable local fact (provenance: user)…"
          className="flex-1 bg-background border border-border/70 rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      {/* Memory list */}
      <div className="space-y-2">
        {facts.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
            No saved memories yet.
          </div>
        ) : (
          facts.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl border border-border/70 bg-card p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full", provenanceBadgeClass(f.provenance))}>
                    {f.provenance || "unknown"}
                  </span>
                  {f.pinned && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      pinned
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground">{f.category}</span>
                </div>
                {editingId === f.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(f.id)}
                      className="p-1.5 rounded-lg bg-primary text-primary-foreground"
                      title="Save"
                    >
                      <Save className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                      setEditingId(f.id);
                      setEditDraft(f.content);
                    }}
                    title="Click to edit"
                  >
                    {f.content}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleTogglePin(f)}
                  className={cn(
                    "p-1.5 rounded-lg border border-transparent hover:bg-muted/60",
                    f.pinned ? "text-primary" : "text-muted-foreground"
                  )}
                  title={f.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(f.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
