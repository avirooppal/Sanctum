# Sanctum Interaction Flows

This document specifies the primary user journeys and interaction flows implemented in Sanctum Desktop, paired with static wireframe references in `docs/design/wireframes/`.

---

## Flow 1: First Run & Honest Onboarding
- **Wireframe**: `docs/design/wireframes/first_run.html`
- **Steps**:
  1. App launches with no models or configuration.
  2. Gateway inspects host environment: CPU cores, RAM, GPU offload capability (Vulkan/Metal/CUDA), and kernel containment capability.
  3. UI displays detected hardware tier and truthful platform assurance pill ("verified kernel containment" on Linux x86_64; "not verified" on Windows).
  4. User is presented with a recommended lightweight default profile (e.g. 4-bit quantized small model) with estimated RAM fit.
  5. One-click initialization downloads or imports model with determinate progress bar and cancel button.
  6. Upon completion, navigates directly to the primary chat interface. Returning users skip this step permanently.

---

## Flow 2: Private Chat with Document Citations
- **Wireframe**: `docs/design/wireframes/chat_with_drawer.html`
- **Steps**:
  1. User enters query in Composer and presses Enter.
  2. If Knowledge pack is enabled, vector store queries locally indexed passages without external egress.
  3. Tokens stream into `ChatPanel` with zero layout shift; active generation displays a red "Stop" button.
  4. Response includes interactive `CitationChip` components referencing source document names and page numbers.
  5. Clicking a citation chip highlights the exact passage snippet in the right drawer without losing chat focus.

---

## Flow 3: Model Switching & Parameter Tuning
- **Wireframe**: `docs/design/wireframes/models_engine_settings.html`
- **Steps**:
  1. User clicks "Models" in the sidebar navigation or opens the right drawer.
  2. UI queries available local GGUFs and displays active model with RAM fit badge.
  3. User adjusts context window (e.g. 2048 to 8192) or CPU threads via slider.
  4. Selecting a new model unloads the previous model from memory, runs memory headroom checks, and loads the new weights with status updates in the status bar.

---

## Flow 4: Modality Pack Management
- **Wireframe**: `docs/design/wireframes/packs.html`
- **Steps**:
  1. User selects "Packs" to view optional on-demand modules (Knowledge, Speech ASR/TTS, Vision).
  2. Each card clearly discloses RAM and disk requirements.
  3. User clicks "Load Pack". The gateway verifies resources, spins up the worker under supervision, and updates the capability registry.
  4. If system memory is constrained, an explicit warning is displayed before loading.
  5. User can click "Unload" at any time to immediately reclaim memory.

---

## Flow 5: Settings & Data Customisation
- **Wireframe**: `docs/design/wireframes/settings_sections.html`
- **Steps**:
  1. User opens Settings (`Ctrl+,` or sidebar gear icon).
  2. Navigates between General, Models, and Privacy sections.
  3. Switches Theme (Dark/Light/System) or adjusts density (Compact/Comfortable/Spacious).
  4. Accent color picker validates choice against WCAG 2.1 AA (3:1 contrast against surface).
  5. User can export the current configuration to a JSON file or import a saved JSON profile.

---

## Flow 6: Destructive Action with Forgiving Undo
- **Steps**:
  1. User clicks the delete icon on a thread in the sidebar.
  2. Thread is moved to a soft-delete state and removed from active list view.
  3. A temporary undo toast appears at the bottom of the screen ("Thread deleted. [Undo]").
  4. Clicking "Undo" immediately restores the thread and preserves all messages.
  5. If the undo window expires, the thread is pruned from local storage.
  6. For catastrophic actions (e.g. "Full Purge" of all local data), the user must type an exact confirmation string ("DELETE EVERYTHING") before execution.

---

## Flow 7: Engine Error & Down States
- **Steps**:
  1. If the background gateway or llama.cpp worker crashes, the health observer detects the disconnection.
  2. `StatusBar` transitions to an engine-down warning badge (`#f43f5e`).
  3. `ChatPanel` disables the Composer input and displays an informative banner: "Local engine disconnected. Attempting to restart background service..."
  4. When the gateway recovers, the UI automatically reconnects without requiring an app reload.
  5. Individual panel failures are isolated by `PanelErrorBoundary` so other panels remain interactive.

---

## Flow 8: Narrow & Responsive Viewports
- **Steps**:
  1. On viewports below 768px width (mobile/narrow desktop windows), the multi-column layout collapses gracefully.
  2. Sidebar converts to an off-canvas drawer toggled via a hamburger menu.
  3. Center chat consumes 100% of the viewport width with touch-friendly 44px minimum touch targets.
  4. Command Palette and Settings modals render as full-screen overlays.
