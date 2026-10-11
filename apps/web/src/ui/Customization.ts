import { ensureContrast, contrastRatio } from './color.js';

export type Mode = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type FontFamily = 'archivo' | 'spectral' | 'system';
export type MessageLayout = 'bubbles' | 'document';
export type ContentWidth = 'narrow' | 'normal' | 'wide';
export type AnimationLevel = 'full' | 'reduced';

export interface LayoutSlots {
  left: string;
  center: string;
  right: string;
  bottom: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  slots: LayoutSlots;
  slotSizes?: { left?: number; right?: number; bottom?: number };
}

export interface UserPreferences {
  theme: string;
  mode: Mode;
  accentColor: string;
  density: Density;
  fontSizeScale: number; // 90 to 125 percent
  fontFamily: FontFamily;
  messageLayout: MessageLayout;
  contentWidth: ContentWidth;
  codeTheme: 'dark' | 'light' | 'match';
  animationLevel: AnimationLevel;
  showTimestamps: boolean;
  showAvatars: boolean;
  sendOnEnter: boolean;
  sidebarSide: 'left' | 'right';
  activeLayout: string;
  savedLayouts: SavedLayout[];
  shortcuts: Record<string, string>;
}

export const DEFAULT_SHORTCUTS: Record<string, string> = Object.freeze({
  'command_palette': 'Ctrl+K',
  'new_chat': 'Ctrl+N',
  'toggle_sidebar': 'Ctrl+\\',
  'open_settings': 'Ctrl+,',
  'focus_composer': 'Ctrl+/',
  'toggle_mic': 'Ctrl+M',
  'stop_generation': 'Escape',
});

export const DEFAULT_PREFERENCES: UserPreferences = Object.freeze({
  theme: 'sanctum',
  mode: 'dark',
  accentColor: '#48a87b',
  density: 'comfortable',
  fontSizeScale: 100,
  fontFamily: 'archivo',
  messageLayout: 'bubbles',
  contentWidth: 'normal',
  codeTheme: 'match',
  animationLevel: 'full',
  showTimestamps: true,
  showAvatars: true,
  sendOnEnter: true,
  sidebarSide: 'left',
  activeLayout: 'full',
  savedLayouts: [
    {
      id: 'full',
      name: 'Full Workspace',
      slots: { left: 'history', center: 'chat', right: 'knowledge', bottom: 'none' },
    },
    {
      id: 'focused',
      name: 'Focused Chat',
      slots: { left: 'history', center: 'chat', right: 'none', bottom: 'none' },
    },
    {
      id: 'dual',
      name: 'Dual Lane',
      slots: { left: 'history', center: 'chat', right: 'knowledge', bottom: 'none' },
    },
    {
      id: 'dashboard',
      name: 'Dashboard Monitor',
      slots: { left: 'none', center: 'dashboard', right: 'chat', bottom: 'none' },
    },
  ],
  shortcuts: { ...DEFAULT_SHORTCUTS },
});

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8}|[A-Fa-f0-9]{3})$/;
const FORBIDDEN_PATTERN = /(url\(|@import|javascript:|http:|https:|data:|<script)/i;

export interface CustomThemeDefinition {
  id: string;
  name: string;
  colors: Record<string, string>;
  darkColors?: Record<string, string>;
}

export function validateThemeTokens(input: unknown): { valid: boolean; error?: string; theme?: CustomThemeDefinition } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'Theme must be a JSON object' };
  }

  const raw = input as Record<string, unknown>;
  const allowedTopKeys = new Set(['id', 'name', 'author', 'colors', 'darkColors']);
  for (const k of Object.keys(raw)) {
    if (!allowedTopKeys.has(k)) {
      return { valid: false, error: `Unrecognized property '${k}' in theme JSON` };
    }
  }

  if (typeof raw.id !== 'string' || !/^[a-z0-9_-]{2,32}$/.test(raw.id)) {
    return { valid: false, error: 'Theme id must be 2-32 alphanumeric characters, dash or underscore' };
  }

  if (typeof raw.name !== 'string' || raw.name.length < 1 || raw.name.length > 48) {
    return { valid: false, error: 'Theme name must be between 1 and 48 characters' };
  }

  function validateColorGroup(name: string, group: unknown): string | null {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      return `${name} must be a color dictionary`;
    }
    const colors = group as Record<string, unknown>;
    const requiredColors = ['background', 'foreground', 'card', 'primary', 'border'];
    for (const req of requiredColors) {
      if (typeof colors[req] !== 'string') {
        return `Missing required color '${req}' in ${name}`;
      }
    }
    for (const [key, val] of Object.entries(colors)) {
      if (typeof val !== 'string') {
        return `Color value '${key}' must be a string in ${name}`;
      }
      if (FORBIDDEN_PATTERN.test(val)) {
        return `Security violation: Forbidden content (url, script, protocol) in color '${key}'`;
      }
      if (!HEX_COLOR_REGEX.test(val.trim())) {
        return `Invalid hex color for '${key}': ${val}`;
      }
    }
    return null;
  }

  const colorErr = validateColorGroup('colors', raw.colors);
  if (colorErr) return { valid: false, error: colorErr };

  if (raw.darkColors) {
    const darkErr = validateColorGroup('darkColors', raw.darkColors);
    if (darkErr) return { valid: false, error: darkErr };
  }

  return {
    valid: true,
    theme: {
      id: raw.id,
      name: raw.name,
      colors: raw.colors as Record<string, string>,
      darkColors: raw.darkColors as Record<string, string> | undefined,
    },
  };
}

export function enforceContrastGuard(accentHex: string, backgroundHex: string, minRatio = 4.5): {
  compliant: boolean;
  ratio: number;
  effectiveHex: string;
} {
  const currentRatio = contrastRatio(accentHex, backgroundHex) ?? 1.0;
  if (currentRatio >= minRatio) {
    return { compliant: true, ratio: currentRatio, effectiveHex: accentHex };
  }
  const adjusted = ensureContrast(accentHex, backgroundHex, minRatio);
  const adjustedRatio = contrastRatio(adjusted, backgroundHex) ?? minRatio;
  return { compliant: false, ratio: adjustedRatio, effectiveHex: adjusted };
}


export function sanitizePreferences(raw: unknown): { preferences: UserPreferences; wasRecovered: boolean } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preferences: { ...DEFAULT_PREFERENCES }, wasRecovered: true };
  }
  const obj = raw as Record<string, unknown>;
  let recovered = false;

  const validModes: Mode[] = ['light', 'dark', 'system'];
  const validDensities: Density[] = ['compact', 'comfortable', 'spacious'];
  const validFonts: FontFamily[] = ['archivo', 'spectral', 'system'];

  const mode = validModes.includes(obj.mode as Mode) ? (obj.mode as Mode) : ((recovered = true), DEFAULT_PREFERENCES.mode);
  const density = validDensities.includes(obj.density as Density) ? (obj.density as Density) : ((recovered = true), DEFAULT_PREFERENCES.density);
  const fontFamily = validFonts.includes(obj.fontFamily as FontFamily) ? (obj.fontFamily as FontFamily) : ((recovered = true), DEFAULT_PREFERENCES.fontFamily);

  let fontSizeScale = typeof obj.fontSizeScale === 'number' ? obj.fontSizeScale : ((recovered = true), 100);
  if (fontSizeScale < 90 || fontSizeScale > 125) {
    fontSizeScale = Math.max(90, Math.min(125, fontSizeScale));
    recovered = true;
  }

  let accentColor = typeof obj.accentColor === 'string' && HEX_COLOR_REGEX.test(obj.accentColor) ? obj.accentColor : ((recovered = true), DEFAULT_PREFERENCES.accentColor);

  return {
    preferences: {
      theme: typeof obj.theme === 'string' && obj.theme.length <= 32 ? obj.theme : ((recovered = true), DEFAULT_PREFERENCES.theme),
      mode,
      accentColor,
      density,
      fontSizeScale,
      fontFamily,
      messageLayout: obj.messageLayout === 'document' ? 'document' : 'bubbles',
      contentWidth: obj.contentWidth === 'narrow' || obj.contentWidth === 'wide' ? obj.contentWidth : 'normal',
      codeTheme: obj.codeTheme === 'dark' || obj.codeTheme === 'light' ? obj.codeTheme : 'match',
      animationLevel: obj.animationLevel === 'reduced' ? 'reduced' : 'full',
      showTimestamps: typeof obj.showTimestamps === 'boolean' ? obj.showTimestamps : true,
      showAvatars: typeof obj.showAvatars === 'boolean' ? obj.showAvatars : true,
      sendOnEnter: typeof obj.sendOnEnter === 'boolean' ? obj.sendOnEnter : true,
      sidebarSide: obj.sidebarSide === 'right' ? 'right' : 'left',
      activeLayout: typeof obj.activeLayout === 'string' ? obj.activeLayout : 'full',
      savedLayouts: Array.isArray(obj.savedLayouts) && obj.savedLayouts.length > 0 ? (obj.savedLayouts as SavedLayout[]) : DEFAULT_PREFERENCES.savedLayouts,
      shortcuts: typeof obj.shortcuts === 'object' && obj.shortcuts ? { ...DEFAULT_SHORTCUTS, ...(obj.shortcuts as Record<string, string>) } : { ...DEFAULT_SHORTCUTS },
    },
    wasRecovered: recovered,
  };
}
