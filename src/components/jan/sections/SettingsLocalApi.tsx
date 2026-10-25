"use client";

import React, { useState, useEffect } from "react";
import { IconTopologyStar3, IconKey, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsLocalApi: React.FC = () => {
  const [enableServer, setEnableServer] = useState<boolean>(false);
  const [host, setHost] = useState<string>("127.0.0.1");
  const [port, setPort] = useState<number>(1337);
  const [apiKeyRequired, setApiKeyRequired] = useState<boolean>(true);
  const [corsEnabled, setCorsEnabled] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("sanctum-sk-live-local-key");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["localApi.enable"] !== undefined) setEnableServer(data.settings["localApi.enable"]);
          if (data.settings["localApi.host"]) setHost(data.settings["localApi.host"]);
          if (data.settings["localApi.port"]) setPort(data.settings["localApi.port"]);
          if (data.settings["localApi.apiKeyRequired"] !== undefined) setApiKeyRequired(data.settings["localApi.apiKeyRequired"]);
          if (data.settings["localApi.corsEnabled"] !== undefined) setCorsEnabled(data.settings["localApi.corsEnabled"]);
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
          "localApi.enable": enableServer,
          "localApi.host": host,
          "localApi.port": Number(port),
          "localApi.apiKeyRequired": apiKeyRequired,
          "localApi.corsEnabled": corsEnabled,
        }),
      });
      if (res.ok) {
        toast.success("Local API settings saved");
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

  const handleGenerateKey = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const newKey = `sanctum-sk-${randomHex}`;
    setApiKey(newKey);
    navigator.clipboard.writeText(newKey);
    toast.success("New API key generated and copied to clipboard");
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Local API Server
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Run an OpenAI-compatible HTTP inference server bound to local loopback.
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

      {/* Daemon Status */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Daemon Control
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Enable HTTP Daemon</span>
              <p className="text-[11px] text-muted-foreground">
                Serve OpenAI `/v1/chat/completions` and `/v1/models` locally.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableServer}
              onClick={() => setEnableServer(!enableServer)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                enableServer ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  enableServer ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Endpoint Bindings */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Network Interface
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Host Address</span>
              <p className="text-[11px] text-muted-foreground">IP interface to bind (127.0.0.1 enforced by default).</p>
            </div>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-36 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Port</span>
              <p className="text-[11px] text-muted-foreground">TCP port for incoming HTTP connections.</p>
            </div>
            <input
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Require API Key</span>
              <p className="text-[11px] text-muted-foreground">
                Enforce Bearer authorization token header on all endpoints.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={apiKeyRequired}
              onClick={() => setApiKeyRequired(!apiKeyRequired)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                apiKeyRequired ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  apiKeyRequired ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Cross-Origin Resource Sharing (CORS)</span>
              <p className="text-[11px] text-muted-foreground">
                Allow browser frontends to query endpoints directly.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={corsEnabled}
              onClick={() => setCorsEnabled(!corsEnabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                corsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  corsEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="min-w-0 flex-1 pr-4">
              <span className="text-xs font-medium text-foreground">API Key Token</span>
              <p className="text-[11px] font-mono text-muted-foreground truncate">{apiKey}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateKey}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5 shrink-0"
            >
              <IconKey size={14} />
              <span>Rotate Key</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
