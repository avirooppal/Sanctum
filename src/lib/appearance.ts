"use client";

export interface AppearanceConfig {
  theme: "dark" | "light" | "system";
  fontSize: "small" | "medium" | "large";
  accentColor: string;
  wallpaper: string; // "" | "preset:..." | data:image/... | https://...
  wallpaperOpacity: number; // 0.05 - 0.85
  wallpaperBlur: number; // 0 - 24 px
  customIcon: string; // "" | data:image/... | https://...
  customBrandName: string; // default "Sanctum"
  showTokenSpeed: boolean;
  coloredUserBubble: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  theme: "dark",
  fontSize: "medium",
  accentColor: "",
  wallpaper: "",
  wallpaperOpacity: 0.35,
  wallpaperBlur: 4,
  customIcon: "",
  customBrandName: "Sanctum",
  showTokenSpeed: true,
  coloredUserBubble: false,
};

export const ACCENT_SWATCHES: { id: string; label: string; hex: string }[] = [
  { id: "default", label: "Sanctum Coral", hex: "" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "violet", label: "Electric Violet", hex: "#8b5cf6" },
  { id: "ocean", label: "Ocean Blue", hex: "#3b82f6" },
  { id: "amber", label: "Warm Amber", hex: "#f59e0b" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "cyan", label: "Cyber Cyan", hex: "#06b6d4" },
];

export const WALLPAPER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "", label: "None (Solid)", css: "" },
  {
    id: "preset:obsidian-ember",
    label: "Obsidian Ember",
    css: "radial-gradient(circle at 18% 18%, rgba(217,107,67,0.34), transparent 46%), radial-gradient(circle at 82% 78%, rgba(99,102,241,0.22), transparent 52%), linear-gradient(135deg, #0b0b0d 0%, #151419 100%)",
  },
  {
    id: "preset:aurora",
    label: "Northern Aurora",
    css: "radial-gradient(circle at 20% 25%, rgba(16,185,129,0.28), transparent 48%), radial-gradient(circle at 80% 30%, rgba(59,130,246,0.26), transparent 50%), radial-gradient(circle at 50% 85%, rgba(139,92,246,0.22), transparent 50%), #090c10",
  },
  {
    id: "preset:midnight-gold",
    label: "Midnight Gold",
    css: "radial-gradient(circle at 75% 18%, rgba(245,158,11,0.25), transparent 45%), radial-gradient(circle at 22% 80%, rgba(217,119,6,0.18), transparent 50%), #0c0b0a",
  },
  {
    id: "preset:cyber-indigo",
    label: "Deep Indigo",
    css: "radial-gradient(circle at 30% 20%, rgba(124,58,237,0.32), transparent 50%), radial-gradient(circle at 80% 75%, rgba(6,182,212,0.24), transparent 50%), #090910",
  },
];

const STORAGE_KEY = "sanctum.appearance.v2";

export function loadAppearanceConfig(): AppearanceConfig {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APPEARANCE, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearanceConfig(patch: Partial<AppearanceConfig>): AppearanceConfig {
  const next = { ...loadAppearanceConfig(), ...patch };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
    applyAppearanceConfig(next);
    window.dispatchEvent(new CustomEvent("sanctum-appearance-updated", { detail: next }));
  }
  return next;
}

export function resolveWallpaperStyle(config: AppearanceConfig): React.CSSProperties | null {
  const wp = (config.wallpaper || "").trim();
  if (!wp) return null;
  const preset = WALLPAPER_PRESETS.find((p) => p.id === wp);
  const base: React.CSSProperties = {
    opacity: Math.min(0.9, Math.max(0.05, config.wallpaperOpacity ?? 0.35)),
    filter: config.wallpaperBlur > 0 ? `blur(${config.wallpaperBlur}px)` : undefined,
    transform: config.wallpaperBlur > 0 ? "scale(1.06)" : undefined,
  };
  if (preset && preset.css) {
    return { ...base, background: preset.css };
  }
  return {
    ...base,
    backgroundImage: `url("${wp.replace(/"/g, '\\"')}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

export function applyAppearanceConfig(config: Partial<AppearanceConfig>): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (config.theme) {
    const resolvedDark =
      config.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : config.theme !== "light";
    html.classList.toggle("dark", resolvedDark);
    html.classList.toggle("light", !resolvedDark);
  }
  if (config.fontSize) {
    const px = config.fontSize === "small" ? "13px" : config.fontSize === "large" ? "16px" : "14px";
    html.style.fontSize = px;
  }
  if (config.accentColor !== undefined) {
    const hex = (config.accentColor || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      html.style.setProperty("--primary", hex);
      html.style.setProperty("--ring", hex);
      html.style.setProperty("--sidebar-primary", hex);
    } else {
      html.style.removeProperty("--primary");
      html.style.removeProperty("--ring");
      html.style.removeProperty("--sidebar-primary");
    }
  }
}
