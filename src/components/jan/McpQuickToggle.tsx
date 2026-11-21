"use client";

import React, { useState, useEffect, useRef } from "react";
import { IconPlugConnected, IconSettings } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

interface McpServerSummary {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface McpQuickToggleProps {
  onOpenMcpSettings?: () => void;
}

export const McpQuickToggle: React.FC<McpQuickToggleProps> = ({ onOpenMcpSettings }) => {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<McpServerSummary[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  const loadServers = async () => {
    try {
      const res = await fetch("/api/mcp");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.servers)) {
        setServers(data.servers);
      }
    } catch {}
  };

  useEffect(() => {
    void loadServers();
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadServers();
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggleServer = async (id: string) => {
    const next = servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setServers(next);
    try {
      await fetchWithApproval(
        "/api/mcp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servers: next }),
        },
        "mcp_config"
      );
    } catch {
      toast.error("Failed to update MCP connector");
    }
  };

  const enabledCount = servers.filter((s) => s.enabled).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="External MCP Connectors"
        title={
          enabledCount > 0
            ? `${enabledCount} MCP connector${enabledCount === 1 ? "" : "s"} active`
            : "Connect external MCP tools (Google Calendar, Gmail, GitHub...)"
        }
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border transition-colors",
          enabledCount > 0
            ? "border-primary/45 bg-primary/15 text-primary font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/60"
        )}
      >
        <IconPlugConnected size={13} />
        {enabledCount > 0 && <span className="font-mono text-[10px]">{enabledCount}</span>}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 rounded-xl border border-border/80 bg-card/98 backdrop-blur-md shadow-xl p-2 space-y-2">
          <div className="flex items-center justify-between px-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              MCP Harness Connectors
            </span>
            <span className="text-[10px] font-mono text-primary">{enabledCount} active</span>
          </div>

          {servers.length === 0 ? (
            <p className="px-1.5 py-1 text-[11px] text-muted-foreground">
              No MCP servers added yet. Connect Google Calendar, Gmail, GitHub, Notion, or Slack.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {servers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void toggleServer(s.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{s.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">
                      {s.type}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors",
                      s.enabled ? "bg-primary justify-end" : "bg-muted justify-start"
                    )}
                  >
                    <span className="size-3 rounded-full bg-background shadow-xs" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {onOpenMcpSettings && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenMcpSettings();
              }}
              className="w-full flex items-center justify-center gap-1.5 pt-1.5 border-t border-border/60 text-[11px] font-medium text-primary hover:underline"
            >
              <IconSettings size={12} />
              <span>Manage MCP Connectors</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
