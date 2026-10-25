"use client";

import React, { useState } from "react";
import { IconFolderCode, IconCopy, IconCopyCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const SettingsClaudeCode: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const snippet = `# Configure Claude Code CLI to communicate with Sanctum Local API Server\nexport ANTHROPIC_BASE_URL="http://127.0.0.1:1337/v1"\nexport ANTHROPIC_API_KEY="sanctum-local"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Environment configuration copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
          Claude Code Bridge
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Point terminal-based development agent tools directly at Sanctum local inference endpoints.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bridge Configuration
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Enable Local Agent Gateway</span>
              <p className="text-[11px] text-muted-foreground">
                Route external development CLI requests through Sanctum local API engine.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                enabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  enabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="space-y-2 pt-3 border-t border-border/50">
            <span className="text-xs font-medium text-foreground">Shell Environment Setup</span>
            <pre className="p-3 rounded-xl bg-background border border-border text-[11px] font-mono text-foreground overflow-x-auto">
              {snippet}
            </pre>
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="rounded-xl text-xs h-8 flex items-center gap-1.5"
              >
                {copied ? <IconCopyCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
                <span>{copied ? "Copied" : "Copy Environment Snippet"}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
