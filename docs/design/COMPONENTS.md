# Component Inventory & Architecture: Sanctum Workspace

## 1. Architectural Layers Overview
The Sanctum UI component architecture strictly separates presentation from state and divides components into six distinct layers:
```
Layer 6: AppShell (Slot engine, navigation rails, global overlays)
   ▲
Layer 5: Layout Presets & Slot Containers (Left, Center, Right, Bottom slots)
   ▲
Layer 4: Panels (ChatPanel, KnowledgePanel, SpeechPanel, DashboardPanel, HistoryPanel, SettingsPanel)
   ▲
Layer 3: Composites (MessageList, Message, Composer, SessionList, SearchBox, ModelPicker, CitationChip, ToolCard, StatusItem, CommandPalette, UndoToast)
   ▲
Layer 2: Primitives (Button, Input, Textarea, Select, Dialog, Card, Badge, Tooltip, Toast, Skeleton, Switch, IconButton)
   ▲
Layer 1: Design Tokens (Colors, Typography, 8px Spacing, Radii, Shadows, Motion, Density)
```

---

## 2. Layer 2: Primitives

### 2.1. Button (`data-ui-button`)
- **Variants**: `primary` (solid accent), `outline` (border + surface), `quiet` (ghost, minimal border), `danger` (destructive red).
- **States**: `default`, `hover` (brightness shift), `focus` (2px accent focus ring with 2px offset), `disabled` (opacity 0.5, cursor not-allowed), `loading` (inline spinner, aria-busy="true").
- **A11y**: Native `<button type="button">`, explicit `aria-label` when icon-only, min touch target 44px on mobile.

### 2.2. Input & Textarea (`data-ui-input`)
- **Variants**: Single-line text, multi-line auto-resizing textarea, search input.
- **States**: `default`, `hover`, `focus-visible` (accent border + focus ring), `disabled`, `error` (danger border + aria-invalid="true").
- **A11y**: Always connected to `<label>` via `htmlFor` or `aria-labelledby`, error states announce with `aria-describedby`.

### 2.3. Modal Dialog (`data-ui-dialog`)
- **States**: Closed, Opening (200ms ease), Open, Closing (150ms ease).
- **Features**: Traps focus inside modal, closes on `Escape` key, backdrop click dismiss (unless destructive), restores focus to origin trigger upon close.
- **A11y**: Native `<dialog>` or `role="dialog"`, `aria-modal="true"`, `aria-labelledby` linked to title.

### 2.4. Badge & Chip (`data-ui-badge`)
- **Variants**: Neutral, Accent, Success (egress verified), Warning (queued), Danger (error).
- **States**: Default, interactive/hover (when acting as filter chip).

### 2.5. Skeleton (`data-ui-skeleton`)
- **Usage**: Content loading placeholders with calm pulsing gradient (suppressed when `prefers-reduced-motion` is set).
- **A11y**: Marked `aria-hidden="true"`, container marked `aria-busy="true"`.

---

## 3. Layer 3: Composites

### 3.1. MessageList
- **Responsibility**: Renders chat messages efficiently, provides scroll anchoring, virtualized rendering for transcripts > 100 turns.
- **States**:
  - `empty`: Shows starter suggestions and hardware-aware guidance.
  - `loading`: Displays initial response skeleton.
  - `streaming`: Smooth token rendering with active stick-to-bottom lock; unlocks immediately if user scrolls up.
  - `error`: Displays inline retry banner with engine diagnostic details.
- **Key Sub-element**: Floating "Jump to Latest" pill button appearing when scrolled up during active generation.

### 3.2. Message
- **Responsibility**: Displays single turn (User or Assistant).
- **Sub-elements**:
  - Author Avatar & Role Label ("You" / Model name e.g. "Qwen 2.5 7B").
  - Content Body: Rendered with XSS-safe `SafeMarkdown` (isolated code blocks, blocked remote media).
  - Citation Chips: Inline interactive tags linking to source passages.
  - Action Bar (revealed on hover or keyboard focus): Copy text, Regenerate/Retry, Branch/Edit, Delete turn.
- **States**: `default`, `streaming` (cursor blinker), `error` (amber/red border with retry action).
- **A11y**: `role="article"`, distinct semantic headings, accessible action button labels.

### 3.3. Composer
- **Responsibility**: User prompt entry with multiline expanding input, file dropzone, voice push-to-talk, stop button during streaming.
- **Sub-elements**:
  - Textarea: Handles `Enter` (send) vs `Shift+Enter` (newline) configurable by user.
  - Attachment Tray: Shows staged text/PDF documents with validation size indicators.
  - Active Model Badge: Clicking triggers `ModelPicker`.
  - Send/Stop Button: Dynamic morph between Send arrow (when idle) and Stop square (when streaming).
- **States**: `idle`, `has-text`, `drag-over` (shows dropzone overlay), `streaming` (stop active), `disabled` (engine offline).

### 3.4. SessionList & SearchBox
- **Responsibility**: Navigation sidebar listing saved conversations.
- **Features**:
  - Debounced search box filtering sessions by title.
  - New Chat button (`Ctrl+N`).
  - Active session indicator with high-contrast indicator bar.
  - Hover/focus actions: Inline rename (Enter commits, Esc cancels), Delete (triggers soft delete with undo toast).
- **States**: `loading` (skeleton list), `populated`, `empty` ("No conversations yet"), `search-no-results`.

### 3.5. ModelPicker
- **Responsibility**: Dropdown or popover displaying installed local models, memory footprint, context length, and quantization tier.
- **States**: `default`, `switching` (transient loading spinner), `disabled` (when generation in flight).
- **A11y**: `role="listbox"`, `aria-activedescendant` keyboard arrow selection.

### 3.6. CitationChip
- **Responsibility**: Displays document source badge (e.g. `[Doc 1: clinical_trial_phase3.pdf #Chunk 4]`).
- **Interaction**: Click opens a side drawer or popover displaying the exact retrieved quote and similarity score.
- **States**: `default`, `hover`, `active-open`.

### 3.7. StatusItem
- **Responsibility**: Displays live telemetry in header/status bar.
- **Items**:
  - Egress State: Green lock pill ("On-device • 0 egress").
  - Memory / VRAM: Real-time RSS usage vs profile limit.
  - Queue / Admission: Shows admitted requests and lane queue count.

### 3.8. CommandPalette (`Ctrl/Cmd+K`)
- **Responsibility**: Fast keyboard-driven launcher for any application action.
- **Sections**: Quick actions (New chat, Clear, Export Markdown), Layout presets, Theme switching, Settings navigation.
- **A11y**: Traps focus, lists options with `role="option"`, announces matching count.

### 3.9. UndoToast
- **Responsibility**: Non-blocking toast floating at bottom-right after destructive actions (e.g., conversation delete).
- **Features**: 5000ms duration with subtle progress countdown bar; "Undo" action immediately restores item; "Dismiss" closes early.
- **A11y**: `role="status"`, `aria-live="polite"`.

---

## 4. Layer 4: Panels (Modular First-Party Registry)
Each panel implements the typed `PanelDefinition` interface:
```typescript
interface PanelDefinition {
  id: string;
  title: string;
  icon: string;
  allowedSlots: ('left' | 'center' | 'right' | 'bottom')[];
  requiredCapabilities: string[]; // e.g. ['chat'], ['knowledge'], ['speech'], ['health']
  defaultVisibility: boolean;
  minSize: { width?: number; height?: number };
  maxSize?: { width?: number; height?: number };
  shortcut?: string;
  component: React.ComponentType<PanelProps>;
}
```

- **ChatPanel**: The core conversational interface (MessageList + Composer).
- **KnowledgePanel**: Folder ingestion, indexed document browser, chunk inspection, and upload dropzone.
- **SpeechPanel**: Real-time microphone capture, audio waveform/level indicator, ASR transcript, TTS playback controls.
- **DashboardPanel**: System health, hardware tier diagnostics, engine admission queues, memory charts.
- **HistoryPanel**: Session history search, pinned conversations, export all.
- **SettingsPanel**: Customization center (themes, density, typography, layouts, shortcuts, persistence).

---

## 5. Layer 5: Layout Engine & Slot System
The workspace layout engine divides the viewport into four slots:
- `left`: Navigation / sidebars (default: History / Knowledge). Min width 200px, max 400px.
- `center`: Primary work surface (default: ChatPanel). Flexible width.
- `right`: Auxiliary inspector (default: Knowledge or Speech). Min width 280px, max 500px.
- `bottom`: Status and dock utilities (default: Metrics / Speech status). Min height 40px, max 200px.

Four Built-in Presets:
1. **Full Workspace**: Left (History), Center (Chat), Right (Knowledge), Bottom (Status).
2. **Focused Chat**: Left (History - collapsible), Center (Chat). Right/Bottom collapsed.
3. **Dual Lane**: Left (History), Center (Chat), Right (Knowledge Doc Viewer).
4. **Dashboard Monitor**: Center (DashboardPanel), Right (ChatPanel), Bottom (Telemetry).

---

## 6. Layer 6: AppShell
- Global keyboard event router (`Ctrl+K` for palette, `Ctrl+\` for sidebar toggle, `Ctrl+/` for shortcuts).
- Slot container renderer wrapping each slot in an `ErrorBoundary`.
- Global portals for dialogs, popovers, and toast notifications.
