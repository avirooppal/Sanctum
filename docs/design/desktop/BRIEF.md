# Sanctum Desktop Design Brief

## 1. Product Vision & Authority
Sanctum Desktop is a private, local-first native desktop AI interface inspired by Jan's modular category patterns, built with uncompromising data sovereignty, zero telemetry, and rigorous platform containment (ADR-0084, ADR-0092, ADR-0093, ADR-0094).

---

## 2. Personas

### Persona A: The Privacy-Conscious Document & Voice Owner (Primary)
- **Profile**: A non-technical researcher, writer, or professional who wants a capable AI assistant running 100% on their own hardware.
- **Goals**:
  - Chat with local LLMs without data leaving the machine.
  - Ingest sensitive documents (PDFs, notes) and obtain citations tied directly to source passages.
  - Speak and listen via local speech synthesis/dictation without third-party cloud streaming.
- **Pain Points**:
  - Complex command lines, cryptic Python tracebacks, or confusing GPU driver configurations.
  - Distrust of SaaS AI terms of service and fear of silent data egress.
  - Slow or bloated interfaces that swallow laptop battery and system RAM.
- **Needs**:
  - Clear, reassuring privacy status: truthful disclosure of exact containment level (e.g. "verified kernel containment" vs "not verified").
  - Simple, predictable chat interface with reliable stop, copy, and export capabilities.
  - Automatic memory warnings and fit indicators before loading models.

### Persona B: The Local AI Power User & Systems Tuner (Secondary)
- **Profile**: A developer, engineer, or enthusiast who self-hosts custom GGUF weights, experiments with MCP tools, and fine-tunes sampling parameters.
- **Goals**:
  - Configure context window, thread count, GPU offload layers, batch sizes, and sampling penalties.
  - Manage modality packs (Knowledge vector store, Whisper/Silero speech, Vision) with strict RAM budgets.
  - Customize workspace layout, color palette, density, and keyboard shortcuts.
- **Pain Points**:
  - Inflexible UIs that hide engine controls or lock parameters behind simplified abstractions.
  - Accidental crashes taking down the entire app when an experimental tool fails.
  - Unresponsive web apps eating CPU at idle.
- **Needs**:
  - Modular panel registry allowing custom panel layout arrangements (Sidebar, Center Chat, Right Rail, Status Bar).
  - Isolated error boundaries per panel to preserve active session data upon individual panel failure.
  - Full keyboard navigability and instant command palette (`Ctrl+K` / `Cmd+K`).

---

## 3. Top Tasks
1. **First Run & Honest Onboarding**: Rapid (<5 min) local initialization displaying detected hardware, profile recommendation, and live egress containment verification.
2. **Private Document & Text Chat**: Streaming conversation with instant stop, safe markdown rendering, and passage citation chips.
3. **Model & Parameter Tuning**: Live switching between local models, real-time context and thread adjustment, and VRAM fit disclosures.
4. **Modality Pack Lifecycle Management**: Inspecting, loading, and unloading optional on-demand packs with clear RAM/disk overhead warnings.
5. **Fast Keyboard Navigation**: Search sessions, trigger commands, and switch panels via the Command Palette (`Ctrl+K`).
6. **Data-Only Customization**: Switching themes, adjusting density (compact/comfortable/spacious), setting AA-contrast-guarded accents, and exporting/importing JSON preferences.

---

## 4. Design Principles
- **Calm**: Minimalist visual rhythm, distraction-free typography, and deliberate whitespace.
- **Clear**: Transparent hardware allocation, real-time token metrics (or honest "unknown"), and visible operational status.
- **Fast**: High-performance interaction (INP < 100ms), zero jank during token streaming, and an ultralight bundle footprint (<15 KB gzip).
- **Honest about Privacy**: Never claim "100% secure". State strictly what is verified (e.g. Linux kernel seccomp/cgroups verified; Windows unconfined fallback explicitly noted as "not verified").
- **Forgiving**: Reversible actions with undo toasts, explicit typed confirmations for irreversible purges, and automatic draft preservation across panel switches.
- **Keyboard-First**: Every interactive element is reachable and operable via keyboard, with standard ARIA semantics and visible focus rings.

---

## 5. Explicit Non-Goals
- **No Marketing / Public Website**: apps/web is an internal desktop UI library, not a public web application or promotional portal.
- **No Cloud Telemetry or Automatic Fallbacks**: Zero analytics pings, remote error tracking, or silent fallback to cloud models when local inference is offline.
- **No Executable Third-Party Plugin Code**: The UI runs data-only panels and validated configuration JSON. No untrusted JavaScript or remote CSS injection.
- **No Heavy Multi-Megabyte Frameworks**: No Electron runtime in the core; UI bundle is constrained to a lightweight Preact footprint under the 50 KB target and 100 KB hard gate.
