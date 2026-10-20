# Sanctum Design Tokens Specification

This document details the semantic design tokens, scale rules, and contrast guards used in Sanctum Desktop, implemented in `apps/web/src/tokens.ts` and validated against `docs/design/tokens.schema.json`.

---

## 1. Color System (Semantic Tokens)

The palette is strictly semantic and audited for WCAG 2.1 AA compliance (contrast ratio >= 4.5:1 for body text, >= 3.0:1 for large text/borders).

| Token | Dark Mode Default | Light Mode Default | Role / Description |
|---|---|---|---|
| `surface` | `#0b0f17` | `#f8fafc` | Base application background |
| `surfaceRaised` | `#121824` | `#ffffff` | Panels, cards, sidebars, modal surfaces |
| `surfaceHover` | `#1a2332` | `#f1f5f9` | Hover state for interactive items |
| `border` | `#1e293b` | `#e2e8f0` | Standard dividing borders |
| `borderSubtle` | `#141d2b` | `#cbd5e1` | Subtle separators and nested dividers |
| `textPrimary` | `#f8fafc` | `#0f172a` | Primary headings, message text |
| `textSecondary` | `#94a3b8` | `#475569` | Secondary descriptions, timestamps |
| `textTertiary` | `#64748b` | `#94a3b8` | Muted hints, shortcuts, breadcrumbs |
| `textDisabled` | `#475569` | `#cbd5e1` | Disabled controls, inactive toggles |
| `accent` | `#38bdf8` | `#0284c7` | Brand highlight, active pills, focused inputs |
| `accentHover` | `#0ea5e9` | `#0369a1` | Hover state on primary buttons |
| `accentMuted` | `rgba(56, 189, 248, 0.15)` | `rgba(2, 132, 199, 0.12)` | Subtle chip/tag backgrounds |
| `danger` | `#f43f5e` | `#e11d48` | Destructive actions, fatal error banners |
| `success` | `#10b981` | `#059669` | Verified engine states, successful actions |
| `warning` | `#f59e0b` | `#d97706` | High memory alerts, unverified platform warnings |

### Contrast Guard Algorithm
Any user-customized accent color is tested against `surfaceRaised` using relative luminance:
`L = 0.2126 * R + 0.7152 * G + 0.0722 * B`
`Ratio = (L1 + 0.05) / (L2 + 0.05)`
If the contrast ratio is < 3.0:1, the custom accent is rejected and falls back safely to default.

---

## 2. Spacing & 8px Grid System

All layouts adhere to an 8px base rhythm:
- `space-1`: 4px (tight badge padding, icon gap)
- `space-2`: 8px (standard element spacing, input padding)
- `space-3`: 12px (card inner padding, list item gaps)
- `space-4`: 16px (standard container padding, layout gaps)
- `space-6`: 24px (section margins, drawer header padding)
- `space-8`: 32px (major layout segment separation)

---

## 3. Density Multipliers

Sanctum supports three interactive density modes:
- **Compact (`0.85x`)**: Higher information density for power users monitoring multiple models and long transcripts.
- **Comfortable (`1.0x`)**: Default balanced spacing for daily reading and typing.
- **Spacious (`1.15x`)**: Larger touch and click targets, enhanced line-height for accessibility and relaxed reading.

---

## 4. Typography Scale

Uses bundled system/native fonts (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `sans-serif`) to eliminate external font downloads and latency:
- **Display**: 20px / 1.3 line-height / 600 weight (Panel titles, headers)
- **Title**: 16px / 1.4 line-height / 600 weight (Section titles, modal headers)
- **Body**: 14px / 1.5 line-height / 400 weight (Standard chat text, settings labels)
- **Caption**: 12px / 1.4 line-height / 400 weight (Timestamps, token counters, citations)
- **Micro**: 11px / 1.2 line-height / 500 weight (Platform assurance badge, status pills)
- **Code**: 13px / 1.6 line-height / monospace (Code blocks, inline code snippets)

---

## 5. Radii & Shadows
- **Radius Small (`4px`)**: Buttons, input boxes, citation chips.
- **Radius Medium (`8px`)**: Cards, dropdowns, error boundary containers.
- **Radius Large (`12px`)**: Modals, command palette dialog, active panel containers.
- **Elevation / Shadows**:
  - `shadow-sm`: `0 1px 2px rgba(0, 0, 0, 0.2)` (Buttons, chips)
  - `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.3)` (Flyout menus, tooltips)
  - `shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.4)` (Command palette, dialog overlays)

---

## 6. Motion & Accessibility
- Standard transition: `150ms cubic-bezier(0.4, 0, 0.2, 1)`.
- When `reducedMotion: true` (or system `prefers-reduced-motion` matches), transitions are reduced to `0ms` to eliminate vestibular triggers.
