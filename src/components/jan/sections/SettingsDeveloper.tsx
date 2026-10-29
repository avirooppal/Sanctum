"use client";

import React, { useState, useEffect } from "react";
import { IconCode, IconCheck, IconTrash, IconEye } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const SettingsDeveloper: React.FC = () => {
  const [inspectRequests, setInspectRequests] = useState<boolean>(false);
  const [traceContentCapture, setTraceContentCapture] = useState<boolean>(false);
  const [traceRetention, setTraceRetention] = useState<number>(200);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showToken, setShowToken] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["developer.inspectRequests"] !== undefined) {
            setInspectRequests(data.settings["developer.inspectRequests"]);
          }
          if (data.settings["developer.traceContentCapture"] !== undefined) {
            setTraceContentCapture(data.settings["developer.traceContentCapture"]);
          }
          if (data.settings["developer.traceRetention"] !== undefined) {
            setTraceRetention(data.settings["developer.traceRetention"]);
          }
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
          "developer.inspectRequests": inspectRequests,
          "developer.traceContentCapture": traceContentCapture,
          "developer.traceRetention": traceRetention,
        }),
      });
      if (res.ok) {
        toast.success("Developer configuration saved");
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

  const handleClearTraces = async () => {
    try {
      const response = await fetch("/api/logs", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear desktop logs");
      toast.success("Desktop logs cleared");
    } catch { toast.error("Could not clear desktop logs"); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Developer & Inspection
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure request tracing, prompt inspection, and debug tokens.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-sm"
        >
          <IconCheck size={14} className="mr-1.5" />
          Save Changes
        </Button>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Inspect Model Requests</label>
              <p className="text-xs text-muted-foreground">
                Expose exact prompt assembly, token metrics, and engine request payloads in the inspector view.
              </p>
            </div>
            <input
              type="checkbox"
              checked={inspectRequests}
              onChange={(e) => setInspectRequests(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
          </div>

          <div className="border-t border-border/40 pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Capture Full Trace Content</label>
              <p className="text-xs text-muted-foreground">
                Store plaintext prompts and responses in local trace logs instead of SHA-256 hashes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={traceContentCapture}
              onChange={(e) => setTraceContentCapture(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
          </div>

          <div className="border-t border-border/40 pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Trace Retention Limit</label>
              <p className="text-xs text-muted-foreground">
                Maximum number of local execution traces kept before oldest are evicted (1 - 2000).
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={2000}
              value={traceRetention}
              onChange={(e) => setTraceRetention(Number(e.target.value))}
              className="w-24 px-2 py-1 text-xs rounded border border-border bg-background text-foreground"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Local Debug API Token</label>
              <p className="text-xs text-muted-foreground">
                Process-isolated security token required to query /api/debug/inspect.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToken(!showToken)}
              className="h-8 text-xs"
            >
              <IconEye size={14} className="mr-1.5" />
              {showToken ? "Hide Token" : "Reveal Token"}
            </Button>
          </div>
          {showToken && (
            <div className="p-3 bg-muted/40 rounded-lg font-mono text-xs text-foreground select-all break-all">
              Stored in Sanctum data directory (debug_token)
            </div>
          )}

          <div className="border-t border-border/40 pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Purge Local Traces</label>
              <p className="text-xs text-muted-foreground">
                Clear all cached spans and inspection records immediately.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearTraces}
              className="h-8 text-xs"
            >
              <IconTrash size={14} className="mr-1.5" />
              Purge Traces
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
