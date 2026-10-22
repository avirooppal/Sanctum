"use client";

import React, { useState } from "react";
import { Settings, ChevronDown, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/useAppStore";

export const ModelsScreen: React.FC = () => {
  const { models, openConfigModal, telemetry } = useAppStore();
  const [preferLocal, setPreferLocal] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>({
    Anthropic: false,
    OpenAI: false,
    OpenRouter: false,
    Groq: false,
    "Google Gemini": false,
  });

  const cloudProviders = [
    { name: "Anthropic", models: "Claude 3.5 Sonnet, Haiku" },
    { name: "OpenAI", models: "GPT-4o, o1, o3-mini" },
    { name: "OpenRouter", models: "Over 200+ multi-vendor models" },
    { name: "Groq", models: "LPU ultra-fast inference (750 t/s)" },
    { name: "Google Gemini", models: "Gemini 2.0 Flash, Pro" },
  ];

  const toggleConnect = (name: string) => {
    setConnectedProviders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <main className="flex p-8 flex-col flex-1 overflow-y-auto">
      <div className="flex mx-auto flex-col gap-8 w-full max-w-4xl">
        {/* Page Header */}
        <div>
          <h2 className="font-semibold text-2xl tracking-tight">
            Models and connections
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Choose where Sanctum should think.
          </p>
        </div>

        {/* Local Models Section */}
        <section>
          <h3 className="font-semibold text-sm mb-4">Local models</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Ollama */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div>
                  <div className="flex mb-3 justify-between items-start gap-4">
                    <div>
                      <h4 className="font-medium text-foreground">Ollama</h4>
                      <p className="font-mono text-muted-foreground text-xs mt-1">
                        localhost:11434
                      </p>
                    </div>
                    <Badge className="bg-accent text-accent-foreground">
                      Local / Offline
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-sm space-y-0.5">
                    {models.length > 0 ? (
                      models.slice(0, 3).map((m) => (
                        <p key={m.id} className="truncate">
                          {m.name} ({m.parameters})
                        </p>
                      ))
                    ) : (
                      <>
                        <p>Qwen 2.5 7B</p>
                        <p>Llama 3.2</p>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => models[0] && openConfigModal(models[0])}
                  className="text-muted-foreground text-sm mt-5 px-0 self-start hover:text-foreground"
                >
                  Configure
                </Button>
              </CardContent>
            </Card>

            {/* LM Studio */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-medium text-foreground">LM Studio</h4>
                    <p className="text-muted-foreground text-sm mt-1">Detected</p>
                  </div>
                  <Badge className="bg-accent text-accent-foreground">
                    Local / Offline
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  className="text-muted-foreground text-sm mt-5 px-0 self-start hover:text-foreground"
                >
                  Configure
                </Button>
              </CardContent>
            </Card>

            {/* llama.cpp */}
            <Card className="bg-card border-border">
              <CardContent className="flex p-5 flex-col justify-between min-h-44">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-medium text-foreground">llama.cpp</h4>
                    <p className="text-muted-foreground text-sm mt-1">Available</p>
                  </div>
                  <Badge className="bg-accent text-accent-foreground">
                    Local / Offline
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  className="text-muted-foreground text-sm mt-5 px-0 self-start hover:text-foreground"
                >
                  Configure
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Cloud Providers Section */}
        <section>
          <h3 className="font-semibold text-sm mb-4">Cloud providers</h3>
          <Card className="bg-card border-border">
            <CardContent className="p-0 divide-y divide-border">
              {cloudProviders.map((prov) => {
                const isConn = connectedProviders[prov.name];
                return (
                  <div
                    key={prov.name}
                    className="flex px-5 py-4 justify-between items-center"
                  >
                    <div>
                      <span className="font-medium text-foreground">{prov.name}</span>
                      <p className="text-muted-foreground text-xs">{prov.models}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className="bg-muted text-muted-foreground">
                        Cloud API
                      </Badge>
                      <Button
                        variant={isConn ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => toggleConnect(prov.name)}
                        className="text-xs gap-1.5"
                      >
                        {isConn && <Check className="size-3.5 text-primary" />}
                        <span>{isConn ? "Connected" : "Connect"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Fallback Preference Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex p-5 justify-between items-center">
            <div>
              <h3 className="font-medium text-foreground text-sm">
                Prefer local, fall back to cloud
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Execute sensitive prompts locally; route heavy reasoning to cloud APIs if offline
              </p>
            </div>
            <Switch
              checked={preferLocal}
              onCheckedChange={(checked) => setPreferLocal(checked)}
            />
          </CardContent>
        </Card>

        {/* Advanced Settings Disclosure */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-left rounded-lg bg-card border border-border flex px-5 py-4 justify-between items-center w-full hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="text-muted-foreground size-4" />
              <div>
                <p className="font-medium text-sm text-foreground">Advanced settings</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  GPU layers, context window, keys
                </p>
              </div>
            </div>
            <ChevronDown
              className={`text-muted-foreground size-4 transition-transform ${
                isAdvancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isAdvancedOpen && (
            <div className="p-5 rounded-lg bg-card border border-border text-xs font-mono space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hardware Accelerator:</span>
                <span className="text-foreground">{telemetry.gpuName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VRAM Allocated:</span>
                <span className="text-foreground">{telemetry.vramUsedGB} GB / {telemetry.vramTotalGB} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ollama Daemon Ping:</span>
                <span className="text-primary font-bold">{telemetry.computeBackend}</span>
              </div>
            </div>
          )}
        </div>

        <footer className="text-muted-foreground text-sm border-t border-border pt-5">
          Local services healthy · No cloud spend this session
        </footer>
      </div>
    </main>
  );
};
