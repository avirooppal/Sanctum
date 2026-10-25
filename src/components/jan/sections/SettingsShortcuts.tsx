"use client";

import React, { useState, useEffect } from "react";
import { IconCommand, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const SettingsShortcuts: React.FC = () => {
  const [newChat, setNewChat] = useState<string>("Ctrl+N");
  const [newProject, setNewProject] = useState<string>("Ctrl+P");
  const [search, setSearch] = useState<string>("Ctrl+K");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["shortcuts.newChat"]) setNewChat(data.settings["shortcuts.newChat"]);
          if (data.settings["shortcuts.newProject"]) setNewProject(data.settings["shortcuts.newProject"]);
          if (data.settings["shortcuts.search"]) setSearch(data.settings["shortcuts.search"]);
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
          "shortcuts.newChat": newChat,
          "shortcuts.newProject": newProject,
          "shortcuts.search": search,
        }),
      });
      if (res.ok) {
        toast.success("Shortcuts updated");
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
            Keyboard Shortcuts
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure global quick actions and navigation hotkeys.
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
          Navigation & Actions
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">New Chat</span>
              <p className="text-[11px] text-muted-foreground">Create a fresh conversation thread.</p>
            </div>
            <input
              type="text"
              value={newChat}
              onChange={(e) => setNewChat(e.target.value)}
              className="w-28 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-center text-foreground"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">New Project</span>
              <p className="text-[11px] text-muted-foreground">Open project creation modal.</p>
            </div>
            <input
              type="text"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="w-28 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-center text-foreground"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Search Threads</span>
              <p className="text-[11px] text-muted-foreground">Open global command palette and thread search.</p>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-28 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-center text-foreground"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
