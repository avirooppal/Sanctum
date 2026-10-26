"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { ChevronDown, Plus } from "lucide-react";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (name: string, assistantId?: string) => void;
}

export const AddProjectDialog: React.FC<AddProjectDialogProps> = ({
  open,
  onOpenChange,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [selectedAssistant, setSelectedAssistant] = useState<string>("default");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (onSave) {
      onSave(name.trim(), selectedAssistant !== "default" ? selectedAssistant : undefined);
    }
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] rounded-2xl border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Create New Project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name..."
              className="h-10 rounded-xl border-border bg-muted/40 text-sm focus:border-primary"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Assistant
            </label>
            <div className="relative">
              <select
                value={selectedAssistant}
                onChange={(e) => setSelectedAssistant(e.target.value)}
                className="w-full h-10 appearance-none rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="default">Select an assistant (optional)</option>
                <option value="general">General Assistant</option>
                <option value="coding">Code Specialist</option>
                <option value="research">Deep Researcher</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
            </div>
          </div>

          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 text-xs font-medium h-9 shadow-sm"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
