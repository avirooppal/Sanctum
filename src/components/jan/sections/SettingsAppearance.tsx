"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconDeviceFloppy,
  IconPhoto,
  IconUpload,
  IconTrash,
  IconSparkles,
  IconRefresh,
  IconPalette,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithApproval } from "@/lib/hostBridge";
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
  WALLPAPER_PRESETS,
  applyAppearanceConfig,
  compressImageFileToDataUrl,
  loadAppearanceConfig,
  saveAppearanceConfig,
  type AppearanceConfig,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function applyAppearanceToDocument(settings: {
  theme?: string;
  fontSize?: string;
  accentColor?: string;
}) {
  applyAppearanceConfig({
    theme: settings.theme as AppearanceConfig["theme"] | undefined,
    fontSize: settings.fontSize as AppearanceConfig["fontSize"] | undefined,
    accentColor: settings.accentColor,
  });
}

function readImageFileAsDataUrl(file: File, maxSizeMB = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file (PNG, JPG, WebP, GIF, SVG)."));
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`Image must be smaller than ${maxSizeMB} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

export const SettingsAppearance: React.FC = () => {
  const [cfg, setCfg] = useState<AppearanceConfig>(() => loadAppearanceConfig());
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const local = loadAppearanceConfig();
    setCfg(local);
    if (local.wallpaper && !local.wallpaper.startsWith("data:") && !local.wallpaper.startsWith("preset:")) {
      setWallpaperUrlInput(local.wallpaper);
    }

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.settings) {
          const s = data.settings;
          const merged: Partial<AppearanceConfig> = {};
          if (s["appearance.theme"]) merged.theme = s["appearance.theme"];
          if (s["appearance.fontSize"]) merged.fontSize = s["appearance.fontSize"];
          if (s["appearance.accentColor"] !== undefined) merged.accentColor = String(s["appearance.accentColor"] || "");
          if (s["appearance.wallpaper"] !== undefined) merged.wallpaper = String(s["appearance.wallpaper"] || "");
          if (typeof s["appearance.wallpaperOpacity"] === "number") merged.wallpaperOpacity = s["appearance.wallpaperOpacity"];
          if (typeof s["appearance.wallpaperBlur"] === "number") merged.wallpaperBlur = s["appearance.wallpaperBlur"];
          if (s["appearance.customIcon"] !== undefined) merged.customIcon = String(s["appearance.customIcon"] || "");
          if (s["appearance.customBrandName"]) merged.customBrandName = String(s["appearance.customBrandName"]);
          if (s["appearance.showTokenSpeed"] !== undefined) merged.showTokenSpeed = Boolean(s["appearance.showTokenSpeed"]);
          if (s["appearance.coloredUserBubble"] !== undefined) merged.coloredUserBubble = Boolean(s["appearance.coloredUserBubble"]);
          if (Object.keys(merged).length > 0) {
            const next = saveAppearanceConfig(merged);
            setCfg(next);
          }
        }
      })
      .catch(() => {});
  }, []);

  const updateAndPersist = async (patch: Partial<AppearanceConfig>, toastMsg?: string) => {
    const next = saveAppearanceConfig(patch);
    setCfg(next);

    const serverPatch: Record<string, any> = {};
    if (patch.theme !== undefined) serverPatch["appearance.theme"] = patch.theme;
    if (patch.fontSize !== undefined) serverPatch["appearance.fontSize"] = patch.fontSize;
    if (patch.accentColor !== undefined) serverPatch["appearance.accentColor"] = patch.accentColor;
    if (patch.wallpaper !== undefined) serverPatch["appearance.wallpaper"] = patch.wallpaper;
    if (patch.wallpaperOpacity !== undefined) serverPatch["appearance.wallpaperOpacity"] = patch.wallpaperOpacity;
    if (patch.wallpaperBlur !== undefined) serverPatch["appearance.wallpaperBlur"] = patch.wallpaperBlur;
    if (patch.customIcon !== undefined) serverPatch["appearance.customIcon"] = patch.customIcon;
    if (patch.customBrandName !== undefined) serverPatch["appearance.customBrandName"] = patch.customBrandName;
    if (patch.showTokenSpeed !== undefined) serverPatch["appearance.showTokenSpeed"] = patch.showTokenSpeed;
    if (patch.coloredUserBubble !== undefined) serverPatch["appearance.coloredUserBubble"] = patch.coloredUserBubble;

    if (Object.keys(serverPatch).length > 0) {
      window.dispatchEvent(new CustomEvent("sanctum-settings-updated", { detail: serverPatch }));
      try {
        await fetchWithApproval(
          "/api/settings",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(serverPatch),
          },
          "settings_write"
        );
      } catch {}
    }

    if (toastMsg) toast.success(toastMsg);
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1920, 0.86);
      setWallpaperUrlInput("");
      await updateAndPersist({ wallpaper: dataUrl }, "Custom wallpaper saved & applied");
    } catch (err: any) {
      toast.error(err?.message || "Failed to load wallpaper");
    } finally {
      if (wallpaperInputRef.current) wallpaperInputRef.current.value = "";
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 256, 0.9);
      await updateAndPersist({ customIcon: dataUrl }, "Custom app icon saved & applied");
    } catch (err: any) {
      toast.error(err?.message || "Failed to load icon");
    } finally {
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    await updateAndPersist(cfg, "Appearance & Studio customization saved");
    setIsSaving(false);
  };

  const handleResetDefaults = async () => {
    setWallpaperUrlInput("");
    await updateAndPersist({ ...DEFAULT_APPEARANCE }, "Appearance reset to Sanctum defaults");
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Appearance &amp; UI Studio
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Customize wallpapers, brand icon, app title, accent colors, themes, and typography.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="rounded-xl text-xs gap-1.5"
          >
            <IconRefresh size={13} />
            <span>Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="rounded-xl text-xs gap-1.5"
          >
            <IconDeviceFloppy size={14} />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* 1. Custom Wallpaper & Background */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <IconPhoto size={13} />
          Background &amp; Wallpaper
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleWallpaperUpload}
            className="hidden"
          />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {WALLPAPER_PRESETS.map((preset) => {
              const active = cfg.wallpaper === preset.id;
              return (
                <button
                  key={preset.id || "none"}
                  type="button"
                  onClick={() => {
                    setWallpaperUrlInput("");
                    void updateAndPersist({ wallpaper: preset.id }, `Background: ${preset.label}`);
                  }}
                  className={cn(
                    "rounded-xl border p-1.5 text-left transition-all space-y-1.5",
                    active ? "border-primary ring-1 ring-primary/40" : "border-border/70 hover:border-primary/40"
                  )}
                >
                  <div
                    className="h-11 w-full rounded-lg border border-border/40 bg-background"
                    style={preset.css ? { background: preset.css } : undefined}
                  />
                  <span className="block text-[10px] font-medium text-foreground truncate px-0.5">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => wallpaperInputRef.current?.click()}
              className="rounded-xl text-xs gap-1.5"
            >
              <IconUpload size={13} />
              <span>Upload Wallpaper</span>
            </Button>

            <div className="flex-1 flex items-center gap-1.5 min-w-[200px]">
              <input
                type="url"
                placeholder="Or paste wallpaper image URL (https://...)"
                value={wallpaperUrlInput}
                onChange={(e) => setWallpaperUrlInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!wallpaperUrlInput.trim()}
                onClick={() => void updateAndPersist({ wallpaper: wallpaperUrlInput.trim() }, "Wallpaper URL applied")}
                className="rounded-xl text-xs"
              >
                Apply
              </Button>
            </div>

            {cfg.wallpaper && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setWallpaperUrlInput("");
                  void updateAndPersist({ wallpaper: "" }, "Wallpaper cleared");
                }}
                className="rounded-xl text-xs text-destructive hover:text-destructive gap-1"
              >
                <IconTrash size={13} />
                <span>Clear</span>
              </Button>
            )}
          </div>

          {cfg.wallpaper && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Wallpaper Opacity</span>
                  <span className="font-mono text-muted-foreground">{Math.round(cfg.wallpaperOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={85}
                  value={Math.round(cfg.wallpaperOpacity * 100)}
                  onChange={(e) => void updateAndPersist({ wallpaperOpacity: Number(e.target.value) / 100 })}
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((Math.round(cfg.wallpaperOpacity * 100) - 5) / 80) * 100}%, hsl(var(--muted)) ${((Math.round(cfg.wallpaperOpacity * 100) - 5) / 80) * 100}%, hsl(var(--muted)) 100%)`,
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Background Blur</span>
                  <span className="font-mono text-muted-foreground">{cfg.wallpaperBlur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={cfg.wallpaperBlur}
                  onChange={(e) => void updateAndPersist({ wallpaperBlur: Number(e.target.value) })}
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(cfg.wallpaperBlur / 24) * 100}%, hsl(var(--muted)) ${(cfg.wallpaperBlur / 24) * 100}%, hsl(var(--muted)) 100%)`,
                  }}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. Custom Brand Icon & Identity */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <IconSparkles size={13} />
          Custom Icon &amp; Branding
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <input
            ref={iconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            onChange={handleIconUpload}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={cfg.customIcon || "/logo.jpg"}
                alt="App Icon Preview"
                className="size-12 rounded-xl object-cover border border-border/80 bg-background"
              />
              <div>
                <span className="text-xs font-medium text-foreground">Custom App Icon</span>
                <p className="text-[11px] text-muted-foreground">
                  Displayed on the centered home screen and sidebar header.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => iconInputRef.current?.click()}
                className="rounded-xl text-xs gap-1.5"
              >
                <IconUpload size={13} />
                <span>Upload Icon</span>
              </Button>
              {cfg.customIcon && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void updateAndPersist({ customIcon: "" }, "Restored default Sanctum icon")}
                  className="rounded-xl text-xs text-muted-foreground"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Workspace Title</span>
              <p className="text-[11px] text-muted-foreground">
                Rename the top-left brand label in the sidebar.
              </p>
            </div>
            <input
              type="text"
              value={cfg.customBrandName}
              onChange={(e) => void updateAndPersist({ customBrandName: e.target.value })}
              placeholder="Sanctum"
              maxLength={28}
              className="w-48 px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
            />
          </div>
        </div>
      </section>

      {/* 3. Accent Color, Theme & Typography */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <IconPalette size={13} />
          Accent Color, Theme &amp; Typography
        </h2>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Accent Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.accentColor || "#d96b43"}
                  onChange={(e) => void updateAndPersist({ accentColor: e.target.value })}
                  aria-label="Custom accent color picker"
                  className="size-6 rounded cursor-pointer border border-border bg-transparent"
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {cfg.accentColor || "Default"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((sw) => {
                const active = (cfg.accentColor || "") === sw.hex;
                return (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => void updateAndPersist({ accentColor: sw.hex }, `Accent: ${sw.label}`)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-foreground font-medium"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: sw.hex || "#d96b43" }}
                    />
                    <span>{sw.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Color Theme</span>
              <p className="text-[11px] text-muted-foreground">Select interface color palette.</p>
            </div>
            <Select
              value={cfg.theme}
              onValueChange={(val) =>
                void updateAndPersist(
                  { theme: val as AppearanceConfig["theme"] },
                  `Theme switched to ${val}`
                )
              }
              className="w-44"
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark Theme</SelectItem>
                <SelectItem value="light">Light Theme</SelectItem>
                <SelectItem value="system">System Synchronized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xs font-medium text-foreground">Font Size</span>
              <p className="text-[11px] text-muted-foreground">Interface text scale.</p>
            </div>
            <Select
              value={cfg.fontSize}
              onValueChange={(val) =>
                void updateAndPersist(
                  { fontSize: val as AppearanceConfig["fontSize"] },
                  `Font size set to ${val}`
                )
              }
              className="w-44"
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Compact (13px)</SelectItem>
                <SelectItem value="medium">Default (14px)</SelectItem>
                <SelectItem value="large">Large (16px)</SelectItem>
              </SelectContent>
            </Select>
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
              aria-checked={cfg.showTokenSpeed}
              onClick={() => void updateAndPersist({ showTokenSpeed: !cfg.showTokenSpeed })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                cfg.showTokenSpeed ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  cfg.showTokenSpeed ? "translate-x-4" : "translate-x-0"
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
              aria-checked={cfg.coloredUserBubble}
              onClick={() => void updateAndPersist({ coloredUserBubble: !cfg.coloredUserBubble })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                cfg.coloredUserBubble ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                  cfg.coloredUserBubble ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
