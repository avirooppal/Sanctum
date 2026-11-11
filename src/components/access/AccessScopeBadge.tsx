"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  FolderLock,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  RotateCcw,
  Check,
  FolderPlus,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type AccessScopeType = "workspace_only" | "selected_folders" | "system_read" | "system_full";

export const AccessScopeBadge: React.FC = () => {
  const [scope, setScope] = useState<AccessScopeType>("workspace_only");
  const [allowedFolders, setAllowedFolders] = useState<string[]>([]);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [pendingScope, setPendingScope] = useState<AccessScopeType | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["access.scope"]) {
            setScope(data.settings["access.scope"]);
          }
          if (data.settings["access.allowedFolders"]) {
            try {
              const val = data.settings["access.allowedFolders"];
              const parsed = Array.isArray(val) ? val : JSON.parse(val);
              if (Array.isArray(parsed)) setAllowedFolders(parsed);
            } catch {
              // fallback string
              const s = String(data.settings["access.allowedFolders"] || "");
              if (s) setAllowedFolders(s.split(",").map((x) => x.trim()).filter(Boolean));
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const saveScope = async (newScope: AccessScopeType, folders: string[] = allowedFolders) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "access.scope": newScope,
          "access.allowedFolders": JSON.stringify(folders),
        }),
      });
      if (res.ok) {
        setScope(newScope);
        setAllowedFolders(folders);
        if (newScope === "workspace_only") {
          toast.success("Access scope reset to Workspace Only");
        } else {
          toast.success(`Access scope updated to ${newScope.replace(/_/g, " ")}`);
        }
      } else {
        toast.error("Failed to update access scope");
      }
    } catch {
      toast.error("Network error while updating access scope");
    }
  };

  const handleSelectScope = (selected: AccessScopeType) => {
    if (selected === scope) return;
    if (selected === "system_read" || selected === "system_full") {
      setPendingScope(selected);
      setIsConfirmOpen(true);
    } else {
      saveScope(selected);
    }
  };

  const handleConfirmDangerousScope = () => {
    if (pendingScope) {
      saveScope(pendingScope);
      setPendingScope(null);
    }
    setIsConfirmOpen(false);
  };

  const handleRevoke = () => {
    saveScope("workspace_only");
    setIsOpen(false);
  };

  const handleAddFolder = () => {
    const trimmed = newFolderInput.trim();
    if (!trimmed) return;
    if (allowedFolders.includes(trimmed)) {
      toast.error("Folder already in allowlist");
      return;
    }
    const updated = [...allowedFolders, trimmed];
    saveScope("selected_folders", updated);
    setNewFolderInput("");
  };

  const handleRemoveFolder = (target: string) => {
    const updated = allowedFolders.filter((f) => f !== target);
    saveScope("selected_folders", updated);
  };

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch("/api/audit/logs");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.entries || []);
      }
    } catch {
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const getBadgeConfig = () => {
    switch (scope) {
      case "system_full":
        return {
          icon: <AlertOctagon size={13} className="text-red-400 animate-pulse" />,
          label: "System Full",
          bg: "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25",
          dot: "bg-red-500",
        };
      case "system_read":
        return {
          icon: <AlertTriangle size={13} className="text-amber-400" />,
          label: "System Read",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25",
          dot: "bg-amber-400",
        };
      case "selected_folders":
        return {
          icon: <FolderLock size={13} className="text-sky-400" />,
          label: `Selected (${allowedFolders.length})`,
          bg: "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25",
          dot: "bg-sky-400",
        };
      case "workspace_only":
      default:
        return {
          icon: <ShieldCheck size={13} className="text-emerald-400" />,
          label: "Workspace",
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90 hover:bg-emerald-500/15",
          dot: "bg-emerald-500",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-medium transition-all shadow-xs shrink-0 select-none",
              badge.bg
            )}
            title="Filesystem Access Scope"
          >
            {badge.icon}
            <span>{badge.label}</span>
            <ChevronDown size={11} className="opacity-60 ml-0.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-84 p-4 bg-popover/95 backdrop-blur-xl border-border/80 shadow-2xl rounded-2xl space-y-3.5 z-50 text-xs"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-primary" />
                <span>Filesystem Access Scope</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Control host boundary for coding agents and tools.
              </p>
            </div>
            {scope !== "workspace_only" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevoke}
                className="h-7 px-2 text-[10px] rounded-lg flex items-center gap-1 font-medium"
                title="Immediately reset to workspace only"
              >
                <RotateCcw size={11} />
                Revoke
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleSelectScope("workspace_only")}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                scope === "workspace_only"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-card/40 border-border/40 hover:bg-muted/40 text-muted-foreground"
              )}
            >
              <ShieldCheck size={16} className={scope === "workspace_only" ? "text-emerald-400" : "text-muted-foreground"} />
              <div className="flex-1">
                <div className="font-medium text-foreground text-xs flex items-center justify-between">
                  <span>Workspace Only</span>
                  {scope === "workspace_only" && <Check size={13} className="text-emerald-400" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Restricted exclusively to current workspace folder. Safe & isolated.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectScope("selected_folders")}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                scope === "selected_folders"
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                  : "bg-card/40 border-border/40 hover:bg-muted/40 text-muted-foreground"
              )}
            >
              <FolderLock size={16} className={scope === "selected_folders" ? "text-sky-400" : "text-muted-foreground"} />
              <div className="flex-1">
                <div className="font-medium text-foreground text-xs flex items-center justify-between">
                  <span>Selected Folders</span>
                  {scope === "selected_folders" && <Check size={13} className="text-sky-400" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Workspace plus explicitly granted directories on disk.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectScope("system_read")}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                scope === "system_read"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-card/40 border-border/40 hover:bg-muted/40 text-muted-foreground"
              )}
            >
              <AlertTriangle size={16} className={scope === "system_read" ? "text-amber-400" : "text-muted-foreground"} />
              <div className="flex-1">
                <div className="font-medium text-foreground text-xs flex items-center justify-between">
                  <span>System Read-Only</span>
                  {scope === "system_read" && <Check size={13} className="text-amber-400" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Read files across host machine. Hard-blocked paths protected.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectScope("system_full")}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                scope === "system_full"
                  ? "bg-red-500/10 border-red-500/30 text-red-200"
                  : "bg-card/40 border-border/40 hover:bg-muted/40 text-muted-foreground"
              )}
            >
              <AlertOctagon size={16} className={scope === "system_full" ? "text-red-400" : "text-muted-foreground"} />
              <div className="flex-1">
                <div className="font-medium text-foreground text-xs flex items-center justify-between">
                  <span>System Full Access</span>
                  {scope === "system_full" && <Check size={13} className="text-red-400" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Read & write files anywhere on host. Audit log enabled.
                </div>
              </div>
            </button>
          </div>

          {scope === "selected_folders" && (
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="text-[11px] font-semibold text-foreground">Granted Directories</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="C:\Projects\shared-lib"
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                  className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                />
                <Button size="sm" onClick={handleAddFolder} className="h-7 px-2.5 text-xs rounded-lg">
                  <FolderPlus size={13} className="mr-1" /> Add
                </Button>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {allowedFolders.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">No folders granted yet.</p>
                ) : (
                  allowedFolders.map((f) => (
                    <div
                      key={f}
                      className="flex items-center justify-between text-[11px] bg-muted/30 px-2 py-1 rounded border border-border/30"
                    >
                      <span className="truncate max-w-[200px]" title={f}>{f}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFolder(f)}
                        className="text-muted-foreground hover:text-red-400 p-0.5"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Hard-blocked: C:\Windows, SSH, Chrome</span>
            <button
              type="button"
              onClick={() => {
                fetchAuditLogs();
                setIsAuditOpen(true);
              }}
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <ExternalLink size={10} /> View Audit Log
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation Dialog for High-Risk Scopes */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border border-destructive/40 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive font-semibold text-base mb-1">
              <AlertOctagon size={20} />
              <span>Elevate Filesystem Access Scope?</span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                You are switching to <strong className="text-foreground">{pendingScope === "system_full" ? "System Full Access" : "System Read-Only"}</strong>.
              </p>
              <p>
                This allows AI tools and coding agents to {pendingScope === "system_full" ? "read and write files anywhere on your machine" : "read files anywhere on your computer"}.
              </p>
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive-foreground text-[11px]">
                <strong>Safety Enforcements Active:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Critical system paths (Windows, System32, Program Files) remain hard-blocked.</li>
                  <li>User credential stores (.ssh, .aws, browser profiles, API keys) remain protected.</li>
                  <li>Every action outside the workspace will be recorded in the audit log.</li>
                  <li>You can revoke back to Workspace Only at any time with one click.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDangerousScope}
              className="rounded-xl text-xs"
            >
              I Understand the Risks - Enable {pendingScope === "system_full" ? "System Full" : "System Read"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Modal */}
      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Security & Access Audit Log</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/audit/logs", { method: "DELETE" });
                  setAuditLogs([]);
                  toast.success("Audit log cleared");
                }}
                className="h-7 text-xs rounded-lg"
              >
                Clear Log
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Records all tool operations executed outside the workspace or blocked by policy.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
            {isLoadingLogs ? (
              <p className="text-center text-muted-foreground py-8">Loading audit records...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No audit log entries recorded yet.</p>
            ) : (
              auditLogs.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-1",
                    entry.decision === "allowed"
                      ? "bg-card/40 border-border/50 text-foreground"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  )}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-primary">{entry.tool} &middot; {entry.action}</span>
                    <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="truncate text-foreground/90">{entry.path || entry.command || "N/A"}</div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                    <span>Scope: {entry.scope}</span>
                    <span className={entry.decision === "allowed" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {entry.decision.toUpperCase()}
                    </span>
                  </div>
                  {entry.reason && (
                    <div className="text-[10px] text-muted-foreground italic">{entry.reason}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
