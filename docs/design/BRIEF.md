# Design Brief: Sanctum Workspace UI

## 1. Executive Summary
Sanctum is an on-device, single-owner private AI platform providing local model inference, document retrieval-augmented generation (RAG), speech recognition, dictation, and voice conversation without foreign egress or telemetry.
The Sanctum Workspace UI transforms the system from a diagnostic utility into a polished, calm, highly customisable, and modular daily driver workspace.

---

## 2. Personas

### Persona A: Dr. Eleanor Vance (Non-Technical Single Owner)
- **Profile**: Clinical researcher and author. Manages confidential patient notes, clinical trial reports, and interview audio. Uses a high-spec laptop (Mac/Windows). Not an engineer; does not want to see terminal outputs, raw JSON, or CUDA error traces.
- **Goals**:
  - Drag and drop research folders and immediately ask questions with trustworthy, exact citations.
  - Dictate notes and converse via natural voice without fear of clinical data leaving the device.
  - Simple, beautiful, distraction-free environment that feels like a quiet study.
- **Pain Points**:
  - Overwhelmed by jargon (quantization, context windows, temperature, embedding dimensions).
  - Anxious about privacy leaks ("Is this uploading to a cloud? How do I know?").
  - Frustrated by brittle UIs that lose unsaved drafts or hang silently when local models are busy.
- **UI Needs**:
  - Clear, truthful privacy feedback (e.g. "On-device only • Egress verified: 0 outbound connections").
  - Natural conversation view with interactive citation chips linking directly to source excerpts.
  - Forgiving undo on accidental deletions.

### Persona B: Marcus Reed (Power User & Systems Tuner)
- **Profile**: Senior software engineer and local AI tinkerer. Runs Sanctum on a custom dual-GPU Linux workstation and laptop. Manages 8+ local models (GGUF, speech, embedding), tests custom prompts, tunes context lengths, and integrates local dev tools.
- **Goals**:
  - Rapid model switching with instant visibility into VRAM/RAM allocation and inference speed (tokens/sec).
  - Dense, multi-panel workspace layouts (Chat + Document Viewer + System Metrics + History).
  - Pure keyboard control (Ctrl/Cmd+K command palette, vim-adjacent shortcuts, quick pane toggles).
  - JSON-based customization (themes, hotkeys, panel layouts) that can be imported/exported and synced across LAN.
- **Pain Points**:
  - Inflexible fixed-width layouts that waste 4K screen real estate.
  - "Toy" chat interfaces that hide queue status, token throughput, or exact retrieval chunk scores.
  - Bloated web apps with laggy inputs (INP > 100ms) or forced cloud accounts.
- **UI Needs**:
  - Modular slots (left, center, right, bottom) supporting custom-sized panels.
  - Deep telemetry panels (engine admission lanes, queue depth, RSS memory).
  - Granular density controls (Compact/Comfortable/Spacious) and rebindable shortcuts.

---

## 3. Top Tasks
1. **First-Run Onboarding**: Verify hardware, choose profile, observe zero-egress self-test, select first Knowledge folder, and initiate first prompt in <= 3 clicks.
2. **Document-Grounded Question Answering**: Ingest documents/folders, submit queries, and review answers with clickable citation chips that reveal exact source text.
3. **Voice Interaction & Barge-In**: Start hands-free speech input, view real-time transcript streaming, interrupt model generation naturally (barge-in), and review audio turn history.
4. **Model Switching & Capability Inspection**: Switch active models across tiers without reload; inspect hardware fit and lane admission status.
5. **Workspace Customization**: Reconfigure panel slots, choose or customize color themes with contrast verification, set density and typography, and persist preferences.
6. **Session & History Management**: Search conversations, rename sessions, branch/retry prompts, and safely delete with undo toast protection.
7. **System Health & Engine Recovery**: Monitor engine queue and memory; recover gracefully if a local worker restarts or becomes busy, with transparent retry timers.

---

## 4. Design Principles
1. **Calm & Focused**: Generous spacing rhythm (8px grid), muted base surfaces, subtle borders, and intentional hierarchy. The interface stays out of the user's way.
2. **Clear & Honest about Privacy**: Never use false claims like "100% secure". State verifiable facts: "All computation local to 127.0.0.1; zero external egress verified by kernel & test suite."
3. **Fast & Responsive**: Zero input latency (INP < 100ms), instant panel toggles (< 50ms), zero layout shift during streaming (CLS = 0).
4. **Forgiving & Safe**: Destructive operations provide immediate undo toasts. Long generation can be stopped without losing partial text. Drafts persist across panel and tab switches.
5. **Keyboard-First**: Every interactive control has a defined keyboard shortcut or command palette access (`Ctrl/Cmd+K`). Full WCAG 2.2 AA keyboard navigation.
6. **Modular & Resilient**: Panels are self-contained, capability-aware plugins in a typed registry. An error in one panel is isolated by an ErrorBoundary and never crashes the workspace.

---

## 5. Explicit Non-Goals
1. **No Third-Party Plugin / Remote Code Execution**: No untrusted web scripts, iframe widgets, or npm extensions loaded at runtime. First-party modularity only.
2. **No Multi-User / Enterprise Collaboration**: Sanctum is an on-device, single-owner system. No team chats, RBAC permissions, cloud sync, or multi-tenant sharing.
3. **No Cloud Telemetry or Analytics**: Zero tracking pixels, Google Analytics, Sentry, or third-party error beacons.
4. **No User-Supplied Raw CSS / Javascript**: Custom themes are strictly validated JSON color tokens; no `url()`, `@import`, or stylesheet injection.
5. **No Synthetic / Mock Data in Verification**: All test scenarios and acceptance verifications run against real outputs and live gateway APIs.
