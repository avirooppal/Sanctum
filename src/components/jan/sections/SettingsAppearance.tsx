"use client";

import React, { useState, useEffect } from "react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function applyAppearanceToDocument(settings: {
  theme?: string;
  fontSize?: string;
}) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (settings.theme) {
    const resolvedDark =
      settings.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : settings.theme !== "light";
    html.classList.toggle("dark", resolvedDark);
    html.classList.toggle("light", !resolvedDark);
  }
  if (settings.fontSize) {
    const px =
      settings.fontSize === "small"
        ? "13px"
        : settings.fontSize === "large"
        ? "16px"
        : "14px";
    html.style.fontSize = px;
  }
}

export const SettingsAppearance: React.FC = () => {
  const [theme, setTheme] = useState<string>("dark");
  const [fontSize, setFontSize] = useState<string>("medium");
  const [showTokenSpeed, setShowTokenSpeed] = useState<boolean>(true);
  const [coloredUserBubble, setColoredUserBubble] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          if (data.settings["appearance.theme"]) setTheme(data.settings["appearance.theme"]);
          if (data.settings["appearance.fontSize"]) setFontSize(data.settings["appearance.fontSize"]);
          if (data.settings["appearance.showTokenSpeed"] !== undefined) {
            setShowTokenSpeed(Boolean(data.settings["appearance.showTokenSpeed"]));
          }
          if (data.settings["appearance.coloredUserBubble"] !== undefined) {
            setColoredUserBubble(Boolean(data.settings["appearance.coloredUserBubble"]));
          }
        }
      })
      .catch(() => {});
  }, []);

  const persistPatch = async (patch: Record<string, any>, toastMsg?: string) => {
    applyAppearanceToDocument({
      theme: patch["appearance.theme"] ?? theme,
      fontSize: patch["appearance.fontSize"] ?? fontSize,
    });
    window.dispatchEvent(new CustomEvent("sanctum-settings-updated", { detail: patch }));
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok && toastMsg) {
        toast.success(toastMsg);
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await persistPatch(
      {
        "appearance.theme": theme,
        "appearance.fontSize": fontSize,
        "appearance.showTokenSpeed": showTokenSpeed,
        "appearance.coloredUserBubble": coloredUserBubble,
      },
      "Appearance settings saved"
    );
    setIsSaving(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Appearance & Studio
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Customize interface themes, typographical scales, and message presentation.
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
          Theme & Styling
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Color Theme</span>
              <p className="text-[11px] text-muted-foreground">Select interface color palette.</p>
            </div>
            <select
              value={theme}
              onChange={(e) => {
                const next = e.target.value;
                setTheme(next);
                persistPatch({ "appearance.theme": next }, `Theme switched to ${next}`);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
              <option value="system">System Synchronized</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Font Size</span>
              <p className="text-[11px] text-muted-foreground">Interface text scale.</p>
            </div>
            <select
              value={fontSize}
              onChange={(e) => {
                const next = e.target.value;
                setFontSize(next);
                persistPatch({ "appearance.fontSize": next }, `Font size set to ${next}`);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            >
              <option value="small">Compact (13px)</option>
              <option value="medium">Default (14px)</option>
              <option value="large">Large (16px)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Show Token Generation Speed</span>
              <p className="text-[11px] text-muted-foreground">
                Display live tokens/second metric below assistant responses.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showTokenSpeed}
              onClick={() => {
                const next = !showTokenSpeed;
                setShowTokenSpeed(next);
                persistPatch(
                  { "appearance.showTokenSpeed": next },
                  `Token speed display ${next ? "enabled" : "disabled"}`
                );
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                showTokenSpeed ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  showTokenSpeed ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Colored User Bubble</span>
              <p className="text-[11px] text-muted-foreground">
                Apply brand accent background to your sent chat bubbles.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={coloredUserBubble}
              onClick={() => {
                const next = !coloredUserBubble;
                setColoredUserBubble(next);
                persistPatch(
                  { "appearance.coloredUserBubble": next },
                  `Colored user bubble ${next ? "enabled" : "disabled"}`
                );
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                coloredUserBubble ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  coloredUserBubble ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
