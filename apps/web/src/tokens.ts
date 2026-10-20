/**
 * Semantic Design Tokens and Customisation Engine.
 * Implements docs/design/TOKENS.md and docs/design/tokens.schema.json.
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

export interface ColorPalette {
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  accent: string;
  accentHover: string;
  accentMuted: string;
  danger: string;
  success: string;
  warning: string;
}

export const DARK_THEME: ColorPalette = {
  surface: '#0b0f17',
  surfaceRaised: '#121824',
  surfaceHover: '#1a2332',
  border: '#1e293b',
  borderSubtle: '#141d2b',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  textDisabled: '#475569',
  accent: '#38bdf8',
  accentHover: '#0ea5e9',
  accentMuted: 'rgba(56, 189, 248, 0.15)',
  danger: '#f43f5e',
  success: '#10b981',
  warning: '#f59e0b',
};

export const LIGHT_THEME: ColorPalette = {
  surface: '#f8fafc',
  surfaceRaised: '#ffffff',
  surfaceHover: '#f1f5f9',
  border: '#e2e8f0',
  borderSubtle: '#cbd5e1',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  textDisabled: '#cbd5e1',
  accent: '#0284c7',
  accentHover: '#0369a1',
  accentMuted: 'rgba(2, 132, 199, 0.12)',
  danger: '#e11d48',
  success: '#059669',
  warning: '#d97706',
};

export const DENSITY_MULTIPLIERS: Record<DensityMode, number> = {
  compact: 0.85,
  comfortable: 1.0,
  spacious: 1.15,
};

export interface ThemeConfig {
  mode: ThemeMode;
  density: DensityMode;
  scaleFactor: number;
  reducedMotion: boolean;
  accentColor?: string;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  density: 'comfortable',
  scaleFactor: 1.0,
  reducedMotion: false,
};

/**
 * Calculate relative luminance according to WCAG 2.1 specifications.
 */
export function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return 0;
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate contrast ratio between two hex colors.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verify whether text against background satisfies WCAG AA (4.5:1 for normal text).
 */
export function verifyWcagAA(textHex: string, bgHex: string): boolean {
  return getContrastRatio(textHex, bgHex) >= 4.5;
}

/**
 * Resolve active palette from theme configuration.
 */
export function resolvePalette(config: ThemeConfig, systemPrefersDark = true): ColorPalette {
  const isDark = config.mode === 'system' ? systemPrefersDark : config.mode === 'dark';
  const base = isDark ? { ...DARK_THEME } : { ...LIGHT_THEME };

  if (config.accentColor && /^#[0-9a-fA-F]{6}$/.test(config.accentColor)) {
    // Check contrast against surface
    if (verifyWcagAA(config.accentColor, base.surface)) {
      base.accent = config.accentColor;
    }
  }

  return base;
}
