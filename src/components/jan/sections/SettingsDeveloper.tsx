"use client";

import React, { useState, useEffect } from "react";
import { IconDeviceFloppy, IconTrash, IconEye } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { fetchWithApproval } from "@/lib/hostBridge";
import { cn } from "@/lib/utils";
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
        if (data?.settings) {
          if (data.settings["developer.inspectRequests"] !== undefined) {
            setInspectRequests(Boolean(data.settings["developer.inspectRequests"]));
          }
          if (data.settings["developer.traceContentCapture"] !== undefined) {
            setTraceContentCapture(Boolean(data.settings["developer.traceContentCapture"]));
          }
          if (data.settings["developer.traceRetention"] !== undefined) {
            setTraceRetention(Number(data.settings["developer.traceRetention"]));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetchWithApproval(
        "/api/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "developer.inspectRequests": inspectRequests,
            "developer.traceContentCapture": traceContentCapture,
            "developer.traceRetention": Number(traceRetention),
          }),
        },
        "settings_write"
      );
      if (res.ok) {
        toast.success("Developer configuration saved");
      } else {
        const err = await res.json().catch(() => ({}));
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
    } catch {
      toast.error("Could not clear desktop logs");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Developer &amp; Inspection
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure request tracing, prompt inspection, and debug tokens.
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
          Request &amp; Trace Capture
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Inspect Model Requests</span>
              <p className="text-[11px] text-muted-foreground">
                Expose prompt assembly, token metrics, and engine request payloads in the inspector view.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inspectRequests}
              onClick={() => setInspectRequests(!inspectRequests)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                inspectRequests ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  inspectRequests ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Capture Full Trace Content</span>
              <p className="text-[11px] text-muted-foreground">
                Store plaintext prompts and responses in local trace logs instead of SHA-256 hashes.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={traceContentCapture}
              onClick={() => setTraceContentCapture(!traceContentCapture)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                traceContentCapture ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  traceContentCapture ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Trace Retention Limit</span>
              <p className="text-[11px] text-muted-foreground">
                Maximum number of local execution traces kept before oldest are evicted (1–2000).
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={2000}
              value={traceRetention}
              onChange={(e) => setTraceRetention(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnostics &amp; Cache Management
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Local Debug API Token</span>
              <p className="text-[11px] text-muted-foreground">
                Process-isolated security token required to query /api/debug/inspect.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToken(!showToken)}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconEye size={14} />
              <span>{showToken ? "Hide Token" : "Reveal Token"}</span>
            </Button>
          </div>
          {showToken && (
            <div className="p-3 bg-background/60 border border-border/60 rounded-xl font-mono text-xs text-foreground select-all break-all">
              Stored in Sanctum data directory (per-launch X-Sanctum-Auth token)
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Purge Local Traces</span>
              <p className="text-[11px] text-muted-foreground">
                Clear all cached spans and inspection records immediately.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearTraces}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconTrash size={14} />
              <span>Purge Traces</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
