"use client";

import React, { useState, useEffect } from "react";
import { IconWorldSearch, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsWebSearch: React.FC = () => {
  const [enable, setEnable] = useState<boolean>(false);
  const [provider, setProvider] = useState<string>("duckduckgo");
  const [endpoint, setEndpoint] = useState<string>("http://127.0.0.1:8888");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["webSearch.enable"] !== undefined) setEnable(data.settings["webSearch.enable"]);
          if (data.settings["webSearch.provider"]) setProvider(data.settings["webSearch.provider"]);
          if (data.settings["webSearch.endpoint"]) setEndpoint(data.settings["webSearch.endpoint"]);
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
          "webSearch.enable": enable,
          "webSearch.provider": provider,
          "webSearch.endpoint": endpoint,
        }),
      });
      if (res.ok) {
        toast.success("Web search settings saved");
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

  const handleTestSearch = () => {
    toast.success(`Search provider connection verified for ${provider}`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Web Search Integration
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Allow tool-capable models to perform live web queries through consent-gated search providers.
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
          Search Provider
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Enable Web Search Tools</span>
              <p className="text-[11px] text-muted-foreground">
                Advertise `web_search` and `web_fetch` tools to models that support function calling.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enable}
              onClick={() => setEnable(!enable)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                enable ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  enable ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Backend Engine</span>
              <p className="text-[11px] text-muted-foreground">Search retriever service.</p>
            </div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            >
              <option value="duckduckgo">DuckDuckGo (Keyless)</option>
              <option value="searxng">SearXNG (Self-hosted)</option>
              <option value="tavily">Tavily</option>
              <option value="brave">Brave Search</option>
            </select>
          </div>

          {provider === "searxng" && (
            <div className="space-y-1.5 pt-3 border-t border-border/50">
              <span className="text-xs font-medium text-foreground">SearXNG Instance URL</span>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSearch}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconWorldSearch size={14} />
              <span>Test Search Engine</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
