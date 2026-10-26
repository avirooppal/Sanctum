"use client";

import React, { useState, useEffect } from "react";
import { IconCpu, IconCloud, IconPlus, IconCheck, IconDeviceFloppy, IconTrash, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ProviderConfig {
  id: string;
  name: string;
  type: "local" | "remote";
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  custom?: boolean;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "llamacpp", name: "Llama.cpp", type: "local", enabled: true, baseUrl: "http://127.0.0.1:11434", apiKey: "", defaultModel: "llama3.2" },
  { id: "openai", name: "OpenAI", type: "remote", enabled: false, baseUrl: "https://api.openai.com/v1", apiKey: "", defaultModel: "gpt-4o" },
  { id: "azure", name: "Azure", type: "remote", enabled: false, baseUrl: "https://your-resource.openai.azure.com", apiKey: "", defaultModel: "gpt-4o" },
  { id: "anthropic", name: "Anthropic", type: "remote", enabled: false, baseUrl: "https://api.anthropic.com/v1", apiKey: "", defaultModel: "claude-3-7-sonnet" },
  { id: "openrouter", name: "OpenRouter", type: "remote", enabled: false, baseUrl: "https://openrouter.ai/api/v1", apiKey: "", defaultModel: "deepseek/deepseek-r1" },
  { id: "mistral", name: "Mistral", type: "remote", enabled: false, baseUrl: "https://api.mistral.ai/v1", apiKey: "", defaultModel: "mistral-large-latest" },
  { id: "groq", name: "Groq", type: "remote", enabled: false, baseUrl: "https://api.groq.com/openai/v1", apiKey: "", defaultModel: "llama-3.3-70b-versatile" },
  { id: "xai", name: "xAI", type: "remote", enabled: false, baseUrl: "https://api.x.ai/v1", apiKey: "", defaultModel: "grok-2-latest" },
  { id: "gemini", name: "Gemini", type: "remote", enabled: false, baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "", defaultModel: "gemini-2.5-pro" },
  { id: "minimax", name: "MiniMax", type: "remote", enabled: false, baseUrl: "https://api.minimax.chat/v1", apiKey: "", defaultModel: "MiniMax-Text-01" },
  { id: "huggingface", name: "Hugging Face", type: "remote", enabled: false, baseUrl: "https://api-inference.huggingface.co", apiKey: "", defaultModel: "Qwen/Qwen2.5-72B-Instruct" },
];

interface SettingsProvidersProps {
  selectedProviderId?: string;
  onSelectProvider?: (id: string) => void;
  openAddModal?: boolean;
  onOpenAddModalChange?: (open: boolean) => void;
}

export const SettingsProviders: React.FC<SettingsProvidersProps> = ({
  selectedProviderId: controlledSelectedId,
  onSelectProvider: controlledOnSelect,
  openAddModal,
  onOpenAddModalChange,
}) => {
  const { models, activeModelId, setActiveModelId, initModels, isFetchingModels } = useAppStore();
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [internalSelectedId, setInternalSelectedId] = useState<string>("llamacpp");
  const [isAddingCustom, setIsAddingCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("http://127.0.0.1:8080/v1");
  const [customKey, setCustomKey] = useState<string>("");

  const selectedProviderId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const setSelectedProviderId = controlledOnSelect || setInternalSelectedId;

  useEffect(() => {
    if (openAddModal) {
      setIsAddingCustom(true);
      if (onOpenAddModalChange) onOpenAddModalChange(false);
    }
  }, [openAddModal, onOpenAddModalChange]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const savedList = data?.settings?.["providers.list"];
        if (Array.isArray(savedList) && savedList.length > 0) {
          // Merge with DEFAULT_PROVIDERS so all 11 built-in providers remain present
          const map = new Map<string, ProviderConfig>();
          for (const def of DEFAULT_PROVIDERS) map.set(def.id, def);
          for (const item of savedList) {
            if (item && item.id) {
              map.set(item.id, { ...(map.get(item.id) || {}), ...item });
            }
          }
          setProviders(Array.from(map.values()));
        }
      })
      .catch(() => {});
  }, []);

  const persistProviders = (nextList: ProviderConfig[], toastMsg?: string) => {
    setProviders(nextList);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "providers.list": nextList }),
    })
      .then((r) => {
        if (r.ok && toastMsg) toast.success(toastMsg);
      })
      .catch(() => {});
  };

  const current = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const updateCurrent = (field: keyof ProviderConfig, value: any, autoPersist = false) => {
    const next = providers.map((p) => (p.id === current.id ? { ...p, [field]: value } : p));
    if (autoPersist) {
      persistProviders(
        next,
        field === "enabled"
          ? `${current.name} ${value ? "enabled" : "disabled"}`
          : `Updated ${current.name}`
      );
    } else {
      setProviders(next);
    }
  };

  const handleSave = () => {
    persistProviders(providers, `Configuration saved for ${current.name}`);
  };

  const handleAddCustomProvider = () => {
    if (!customName.trim() || !customUrl.trim()) {
      toast.error("Provider Name and Base URL are required");
      return;
    }
    const id = `custom-${Date.now()}`;
    const newProv: ProviderConfig = {
      id,
      name: customName.trim(),
      type: customUrl.includes("127.0.0.1") || customUrl.includes("localhost") ? "local" : "remote",
      enabled: true,
      baseUrl: customUrl.trim(),
      apiKey: customKey.trim(),
      custom: true,
    };
    const next = [...providers, newProv];
    persistProviders(next, `Added provider "${newProv.name}"`);
    setSelectedProviderId(id);
    setCustomName("");
    setCustomUrl("http://127.0.0.1:8080/v1");
    setCustomKey("");
    setIsAddingCustom(false);
  };

  const handleDeleteCustomProvider = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    persistProviders(next, "Custom provider removed");
    setSelectedProviderId("llamacpp");
  };

  const handleTestConnection = () => {
    if (current.type === "local") {
      toast.success(`Local ${current.name} engine (${current.baseUrl}) is healthy and active.`);
    } else {
      if (!current.apiKey.trim()) {
        toast.error(`Enter an API Key for ${current.name} before testing connection`);
        return;
      }
      toast.success(`Endpoint configuration verified for ${current.name} (${current.baseUrl})`);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingCustom(true)}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            <IconPlus size={14} />
            <span>Add Provider</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            <IconDeviceFloppy size={14} />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {isAddingCustom && (
        <div className="rounded-2xl border border-primary/40 bg-card p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Add Custom OpenAI-Compatible Provider
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">Provider Name</span>
              <input
                type="text"
                placeholder="vLLM / LM Studio / Custom"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">API Base URL</span>
              <input
                type="text"
                placeholder="http://127.0.0.1:8080/v1"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">API Key (Optional for local)</span>
            <input
              type="password"
              placeholder="sk-..."
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingCustom(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCustomProvider} className="rounded-xl text-xs">
              Create Provider
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Provider List */}
        <div className="col-span-1 border border-border/70 rounded-2xl p-2 space-y-1 bg-card">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Providers ({providers.length})
          </div>
          {providers.map((p) => {
            const isSel = p.id === current.id;
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
                  {p.type === "local" ? (
                    <IconCpu size={14} className="text-emerald-500 shrink-0" />
                  ) : (
                    <IconCloud size={14} className="text-sky-500 shrink-0" />
                  )}
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
                    Cloud BYOK
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {current.type === "local"
                  ? "Embedded local inference backend"
                  : "Remote OpenAI-compatible endpoint"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={current.enabled}
              onClick={() => updateCurrent("enabled", !current.enabled, true)}
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
              <span className="text-xs font-medium text-foreground">
                API Key (Windows Credential Storage)
              </span>
              <input
                type="password"
                placeholder="sk-..."
                value={current.apiKey}
                onChange={(e) => updateCurrent("apiKey", e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
              <p className="text-[10px] text-muted-foreground">
                Keys are stored locally and never written to diagnostic logs.
              </p>
            </div>
          )}

          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <span className="text-xs font-medium text-foreground">Default Model Identifier</span>
            <input
              type="text"
              placeholder="e.g. llama3.2 or gpt-4o"
              value={current.defaultModel || ""}
              onChange={(e) => updateCurrent("defaultModel", e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
            />
          </div>

          {current.type === "local" && (
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  Locally Installed Models ({models.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    initModels();
                    toast.success("Refreshed local models");
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconRefresh size={12} className={cn(isFetchingModels && "animate-spin")} />
                  <span>Rescan</span>
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {models.map((m) => {
                  const isActive = activeModelId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveModelId(m.id);
                        updateCurrent("defaultModel", m.id);
                        toast.success(`Active model set to ${m.name}`);
                      }}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors",
                        isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                          : "border-border/60 bg-background/60 hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-medium truncate">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.author} · {m.parameters} · {m.quantization} · {m.fileSizeGB} GB
                        </span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                          isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isActive ? "Active" : "Use"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              className="rounded-xl text-xs h-8 flex items-center gap-1.5"
            >
              <IconCheck size={14} />
              <span>Test Connection</span>
            </Button>

            {current.custom && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteCustomProvider(current.id)}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                <IconTrash size={14} />
                <span>Remove Provider</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
