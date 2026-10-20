# Sanctum Component Inventory & Architecture

This document catalogs Sanctum Desktop's component architecture across six progressive layers, detailing interactive states, error boundaries, and accessibility (WCAG 2.1 AA) contracts.

---

## Layer 1: Tokens
- Standardized variables defined in `docs/design/TOKENS.md` and `apps/web/src/tokens.ts`.
- Injected at runtime as CSS custom properties on `:root` or panel containers.

---

## Layer 2: Primitives
Foundational, single-purpose interactive and display elements:
1. **Button**:
   - Variants: `primary`, `secondary`, `ghost`, `danger`.
   - States: `default`, `hover`, `focus-visible` (ring outline), `active`, `disabled`, `loading` (spinner + `aria-busy="true"`).
   - a11y: Standard `<button>` with explicit `aria-label` when icon-only.
2. **TextInput & Textarea**:
   - Single-line and auto-expanding multi-line inputs.
   - States: `default`, `hover`, `focus`, `disabled`, `error` (`aria-invalid="true"`).
3. **Badge / Pill**:
   - Status indicators (`success`, `warning`, `accent`, `muted`).
   - Used for platform assurance, fit warnings, and capability chips.
4. **Slider / Range**:
   - Context window and thread count selectors with step intervals and numerical value displays.
   - a11y: `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.
5. **Switch / Toggle**:
   - Boolean setting toggles.
   - a11y: `role="switch"`, `aria-checked`.

---

## Layer 3: Composites
Rich interactive widgets formed from primitives:
1. **Composer** (`apps/web/src/components/Composer.tsx`):
   - Auto-growing multiline input, Enter-to-send (with Shift+Enter multiline), attachment trigger, stop/send toggle button.
   - States: `idle`, `typing`, `sending`, `disabled` (engine offline).
2. **CitationChip**:
   - Clickable citation source tag displaying document title and passage page/offset.
   - States: `default`, `hover`, `active` (highlights matching passage in drawer).
3. **SafeMarkdown** (`apps/web/src/markdown.tsx`):
   - Secure sanitized parser isolating paragraphs and code blocks with syntax highlighting, language badge, and copy-to-clipboard button.
4. **SessionListItem**:
   - Thread item in sidebar with title, timestamp, pin button, and delete action.
   - States: `default`, `hover`, `active` (selected), `editing` (rename).
5. **ModelCard**:
   - Displays model name, format, parameter size, quantized precision, and memory fit warning.
6. **PackCard**:
   - Discloses modality pack RAM/disk requirements, load/unload actions, and active status.
7. **StatusItem**:
   - Displays engine connection health, platform assurance tier, and active hardware metrics.

---

## Layer 4: Panels
Autonomous functional views managed via `PanelRegistry` (`apps/web/src/panels/registry.ts`):
1. **ChatPanel** (`apps/web/src/components/ChatPanel.tsx`):
   - Main conversation stream, virtualized message list, stop generation button, and message actions (copy, retry, delete).
2. **Sidebar** (`apps/web/src/components/Sidebar.tsx`):
   - Session search, New Chat button, session list, and navigation triggers.
3. **ModelsPanel** (`apps/web/src/components/ModelsPanel.tsx`):
   - Model switching, context window slider, CPU thread slider, and hardware memory fit disclosure.
4. **PacksPanel** (`apps/web/src/components/PacksPanel.tsx`):
   - On-demand modality packs (Knowledge vector index, Speech ASR/TTS, Vision) with RAM overhead warnings.
5. **SettingsPanel** (`apps/web/src/components/SettingsPanel.tsx`):
   - General, Models, Privacy tabs, theme toggle, scale slider, and JSON export/import.
6. **StatusBar** (`apps/web/src/components/StatusBar.tsx`):
   - Real-time hardware telemetry, engine readiness, and platform containment assurance pill.
7. **CommandPalette** (`apps/web/src/components/CommandPalette.tsx`):
   - Modal overlay activated by `Ctrl+K` / `Cmd+K` for instant command filtering, session switching, and navigation.

---

## Layer 5: Layouts
Configurable desktop arrangements orchestrating panel slots:
- **Default 3-Column**: Left navigation/session sidebar, center active conversation, right parameter/pack drawer.
- **Minimal / Focused**: Hidden right drawer, focused center chat, auto-collapsing sidebar.
- **Power User**: Left sessions, center chat, right live model & engine telemetry, bottom hardware status.

---

## Layer 6: Shell (`apps/web/src/Shell.tsx`)
Root desktop coordinator:
- Discovers backend capabilities via `/api/capability`.
- Filters available panels based on reported capabilities.
- Wraps each panel in a dedicated `PanelErrorBoundary` for crash isolation.
- Manages global keyboard shortcuts (`Ctrl+K`, `Ctrl+N`, `Ctrl+,`).
- Persists session state and UI customisation preferences.
