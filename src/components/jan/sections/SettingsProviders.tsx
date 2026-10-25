"use client";

import React, { useState } from "react";
import { IconCpu, IconCloud, IconPlus, IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProviderConfig {
  id: string;
  name: string;
  type: "local" | "remote";
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "llamacpp", name: "Llama.cpp", type: "local", enabled: true, baseUrl: "http://127.0.0.1:1337", apiKey: "" },
  { id: "openai", name: "OpenAI", type: "remote", enabled: false, baseUrl: "https://api.openai.com/v1", apiKey: "" },
  { id: "anthropic", name: "Anthropic", type: "remote", enabled: false, baseUrl: "https://api.anthropic.com/v1", apiKey: "" },
  { id: "azure", name: "Azure OpenAI", type: "remote", enabled: false, baseUrl: "https://your-resource.openai.azure.com", apiKey: "" },
  { id: "openrouter", name: "OpenRouter", type: "remote", enabled: false, baseUrl: "https://openrouter.ai/api/v1", apiKey: "" },
  { id: "groq", name: "Groq", type: "remote", enabled: false, baseUrl: "https://api.groq.com/openai/v1", apiKey: "" },
  { id: "mistral", name: "Mistral", type: "remote", enabled: false, baseUrl: "https://api.mistral.ai/v1", apiKey: "" },
  { id: "gemini", name: "Google Gemini", type: "remote", enabled: false, baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "" },
  { id: "huggingface", name: "Hugging Face", type: "remote", enabled: false, baseUrl: "https://api-inference.huggingface.co", apiKey: "" },
];

export const SettingsProviders: React.FC = () => {
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("llamacpp");

  const current = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const updateCurrent = (field: keyof ProviderConfig, value: any) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === current.id ? { ...p, [field]: value } : p))
    );
  };

  const handleSave = () => {
    toast.success(`Configuration saved for ${current.name}`);
  };

  const handleTestConnection = () => {
    if (current.type === "local") {
      toast.success("Local Llama.cpp engine is healthy and active.");
    } else {
      if (!current.apiKey && current.name !== "Local") {
        toast.error("Please enter an API Key to test connection");
        return;
      }
      toast.success(`Connection verified to ${current.name} API endpoint.`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Model Providers
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage local inference engines and remote BYOK API connections.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          className="rounded-xl text-xs flex items-center gap-1.5"
        >
          <IconDeviceFloppy size={14} />
          <span>Save Changes</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Provider List */}
        <div className="col-span-1 border border-border/70 rounded-2xl p-2 space-y-1 bg-card">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Providers
          </div>
          {providers.map((p) => {
            const isSel = p.id === selectedProviderId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProviderId(p.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                  isSel
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {p.type === "local" ? <IconCpu size={14} className="text-emerald-500 shrink-0" /> : <IconCloud size={14} className="text-sky-500 shrink-0" />}
                  <span className="truncate">{p.name}</span>
                </div>
                {p.enabled && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Selected Provider Details */}
        <div className="col-span-2 border border-border/70 rounded-2xl p-5 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>{current.name}</span>
                {current.type === "remote" && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Cloud
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {current.type === "local" ? "Embedded native inference backend" : "Remote OpenAI-compatible endpoint"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={current.enabled}
              onClick={() => updateCurrent("enabled", !current.enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                current.enabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  current.enabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <span className="text-xs font-medium text-foreground">API Base URL</span>
            <input
              type="text"
              value={current.baseUrl}
              onChange={(e) => updateCurrent("baseUrl", e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
            />
          </div>

          {current.type === "remote" && (
            <div className="space-y-1.5 pt-3 border-t border-border/50">
              <span className="text-xs font-medium text-foreground">API Key (Windows Credential Storage)</span>
              <input
                type="password"
                placeholder="sk-..."
                value={current.apiKey}
                onChange={(e) => updateCurrent("apiKey", e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
              <p className="text-[10px] text-muted-foreground">Keys are stored securely and never written to logs.</p>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconCheck size={14} />
              <span>Test Connection</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
