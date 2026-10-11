# Design Tokens Specification: Sanctum Workspace

## 1. Overview & Audit of Existing Tokens
Sanctum's UI foundation audited the existing Hermes-derived tokens (`apps/web/src/ui/themes.ts`, `palettes.ts`, `primitives.css`):
- **Audited & Reused**:
  - Base colors: `--ui-background`, `--ui-surface`, `--ui-sidebar`, `--ui-border`, `--ui-accent`, `--ui-input`
  - Text tiers: `--ui-text-primary`, `--ui-text-secondary`, `--ui-text-tertiary`, `--ui-text-disabled`, `--ui-text-on-accent`
  - Interactive highlights: `--ui-focus`, `--ui-user-bubble`
  - Font floor: `--ui-base-size` (15px standard, 18px large)
- **Added in Amendment 2**:
  - Elevated surfaces: `--ui-surface-raised`
  - Semantic status feedback: `--ui-success`, `--ui-warning`, `--ui-danger` (with corresponding text on status)
  - 8px modular spacing grid (`--ui-space-1` through `--ui-space-12`)
  - Radii system (`--ui-radius-sm`, `--ui-radius-md`, `--ui-radius-lg`, `--ui-radius-full`)
  - Shadows (`--ui-shadow-sm`, `--ui-shadow-md`, `--ui-shadow-lg`)
  - Motion tokens (`--ui-duration-fast`, `--ui-duration-normal`, `--ui-duration-slow`)
  - Z-Index layering (`--ui-z-dock`, `--ui-z-overlay`, `--ui-z-modal`, `--ui-z-toast`, `--ui-z-tooltip`)
  - Density multipliers (`compact`, `comfortable`, `spacious`)

---

## 2. Semantic Color Scale
Every color token is required to guarantee WCAG AA contrast (>= 4.5:1 for normal text, >= 3.0:1 for large text/icons against its backing surface).

| Token Name | Semantic Purpose | Dark Mode Default (Sanctum) | Light Mode Default |
|---|---|---|---|
| `--ui-background` | Canvas / application base background | `#0f1412` | `#f4f6f4` |
| `--ui-surface` | Primary content surface (main panels, chat list) | `#151c19` | `#ffffff` |
| `--ui-surface-raised` | Elevated containers (cards, dropdowns, dialogs) | `#1c2622` | `#f8faf8` |
| `--ui-sidebar` | Navigation sidebar background | `#121815` | `#ebf0ec` |
| `--ui-border` | Subtle structural dividers and component outlines | `#283832` | `#c9d4ca` |
| `--ui-text-primary` | High-emphasis body, headings, primary copy | `#e8efe9` | `#16201b` |
| `--ui-text-secondary` | Medium-emphasis labels, timestamps, metadata | `#9fb3a4` | `#526658` |
| `--ui-text-tertiary` | Low-emphasis placeholders, shortcuts, muted tags | `#758b7b` | `#7a8e80` |
| `--ui-text-disabled` | Inactive interactive controls (never below 3.0:1) | `#5a6d60` | `#94a398` |
| `--ui-accent` | Primary brand/focus color (interactive buttons, tabs) | `#48a87b` | `#23583f` |
| `--ui-text-on-accent`| Text contrast color on top of `--ui-accent` | `#0f1412` | `#ffffff` |
| `--ui-success` | Verifications, egress pass, active engine state | `#34d399` | `#15803d` |
| `--ui-warning` | Queue wait, high memory warning, degraded state | `#fbbf24` | `#b45309` |
| `--ui-danger` | Deletions, engine offline, critical failures | `#f87171` | `#b91c1c` |
| `--ui-focus` | Keyboard focus ring indicator (2px solid) | `#6ee7b7` | `#23583f` |

---

## 3. Typography & Type Scale
Font families are strictly bundled and license-verified (OFL Archivo for UI/body, OFL Spectral for document reading, system monospace for code).

| Step | Font Size | Line Height | Usage |
|---|---|---|---|
| `xs` | 11px (0.733rem) | 16px | Status badges, keyboard shortcut chips, micro-metadata |
| `sm` | 13px (0.867rem) | 18px | Secondary labels, citations, panel tabs, tooltips |
| `base` | 15px (1.000rem) | 22px | Standard message text, composer input, body copy |
| `md` | 17px (1.133rem) | 24px | Section titles, user bubble text, emphasized text |
| `lg` | 20px (1.333rem) | 28px | Panel headers, modal dialog titles |
| `xl` | 24px (1.600rem) | 32px | Wizard headers, landing headings |
| `2xl`| 30px (2.000rem) | 36px | Large hero titles |

---

## 4. Spacing System (8px Modular Grid)
Base unit: 8px. Half-step: 4px for tight padding and inline chips.

| Token | Dimension | Common Use |
|---|---|---|
| `--ui-space-1` | 4px | Chip padding, button icon gap, badge margin |
| `--ui-space-2` | 8px | Standard component gap, list item vertical padding |
| `--ui-space-3` | 12px | Composer input vertical padding, table cell padding |
| `--ui-space-4` | 16px | Card padding, toolbar horizontal spacing, slot gutter |
| `--ui-space-5` | 20px | Panel header padding, modal header gap |
| `--ui-space-6` | 24px | Dialog interior padding, spacious card container |
| `--ui-space-8` | 32px | Section margin, empty state illustration gutter |
| `--ui-space-10` | 40px | Major container gutters |
| `--ui-space-12` | 48px | Top-level shell margin on desktop |

---

## 5. Radii, Shadows, Motion & Z-Index

### Border Radii
- `--ui-radius-sm`: `4px` (buttons, badges, citation chips, inputs)
- `--ui-radius-md`: `8px` (cards, floating menus, toasts)
- `--ui-radius-lg`: `12px` (modal dialogs, panels, onboarding cards)
- `--ui-radius-full`: `9999px` (pill badges, avatar circles)

### Elevation & Shadows
- `--ui-shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.15)`
- `--ui-shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.25)`
- `--ui-shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.35)`

### Motion & Transitions
- `--ui-duration-fast`: `100ms` (hover, button click feedback)
- `--ui-duration-normal`: `200ms` (panel slide, modal open, toast display)
- `--ui-duration-slow`: `350ms` (layout slot rearrange)
- `prefers-reduced-motion`: all animations drop to `0ms` (transition: none).

### Z-Index Stacking
- `--ui-z-base`: `0`
- `--ui-z-dock`: `10` (bottom composer, persistent toolbars)
- `--ui-z-sticky`: `20` (slot headers, sticky message date separators)
- `--ui-z-overlay`: `30` (dropdown popovers, flyout menus)
- `--ui-z-modal`: `40` (settings dialog, model manager, shortcut help)
- `--ui-z-toast`: `50` (undo notifications, alert toasts)
- `--ui-z-tooltip`: `60` (hover tooltips, hotkey previews)

---

## 6. Density Multipliers
Users can customize visual density to fit their workflow and display scale:
1. **Compact (`0.85`)**:
   - Base font: `13px`
   - Spacing multiplier: `0.75x`
   - Message bubble gap: `6px`
   - Optimized for Marcus (Power user with multiple open panels on a 1440p+ display).
2. **Comfortable (`1.00`, Default)**:
   - Base font: `15px`
   - Spacing multiplier: `1.00x`
   - Message bubble gap: `12px`
   - Balanced reading and editing cadence.
3. **Spacious (`1.15`)**:
   - Base font: `16px`
   - Spacing multiplier: `1.25x`
   - Message bubble gap: `18px`
   - Optimized for Dr. Eleanor Vance (Long-form reading and calm review).
