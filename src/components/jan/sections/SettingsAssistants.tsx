"use client";

import React, { useState, useEffect } from "react";
import { IconFeather, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const SettingsAssistants: React.FC = () => {
  const [defaultModel, setDefaultModel] = useState<string>("qwen-0.5b-chat");
  const [systemPrompt, setSystemPrompt] = useState<string>("You are Sanctum, a helpful and sovereign AI assistant.");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings["assistants.defaultModel"]) setDefaultModel(data.settings["assistants.defaultModel"]);
          if (data.settings["assistants.systemPrompt"]) setSystemPrompt(data.settings["assistants.systemPrompt"]);
          if (data.settings["assistants.temperature"] !== undefined) setTemperature(data.settings["assistants.temperature"]);
          if (data.settings["assistants.topP"] !== undefined) setTopP(data.settings["assistants.topP"]);
          if (data.settings["assistants.maxTokens"] !== undefined) setMaxTokens(data.settings["assistants.maxTokens"]);
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
          "assistants.defaultModel": defaultModel,
          "assistants.systemPrompt": systemPrompt,
          "assistants.temperature": Number(temperature),
          "assistants.topP": Number(topP),
          "assistants.maxTokens": Number(maxTokens),
        }),
      });
      if (res.ok) {
        toast.success("Assistant settings saved");
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
            Assistants & Sampling
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure default instructions, persona guidelines, and inference sampling parameters.
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
          Default Persona
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">Default Model</span>
            <input
              type="text"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
            />
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <span className="text-xs font-medium text-foreground">System Instructions</span>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sampling Hyperparameters
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Temperature ({temperature})</span>
              <p className="text-[11px] text-muted-foreground">Degree of randomness in candidate selection (0.0 to 2.0).</p>
            </div>
            <input
              type="range"
              min={0.0}
              max={2.0}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-40"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Top-P ({topP})</span>
              <p className="text-[11px] text-muted-foreground">Nucleus sampling cumulative probability cut-off (0.0 to 1.0).</p>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={topP}
              onChange={(e) => setTopP(Number(e.target.value))}
              className="w-40"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Max Tokens</span>
              <p className="text-[11px] text-muted-foreground">Generation ceiling per completion turn.</p>
            </div>
            <input
              type="number"
              min={64}
              max={32768}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground text-right"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
