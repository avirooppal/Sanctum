# ADR 0068: Modular Workspace UI Architecture, Customisation, and UX Quality Gates

## Context
Owner Amendment 2 (`docs/UI_WORKSPACE.md`) directs an aesthetic, modular, customisable, and UX-friendly workspace UI for Sanctum.
Sanctum is single-user, on-device, and private by design. The interface must provide a calm, clear, fast, and forgiving experience for both non-technical owners and power users while strictly upholding privacy invariants (zero foreign egress, zero telemetry, local persistence).

To prevent ad-hoc implementations and unverified claims, this ADR specifies the architecture, data-only customization boundaries, UX quality budgets, and verification thresholds prior to code implementation.

## Decisions

### 1. Design-Before-Code Process (D0)
All UI work follows an artifact-first lifecycle:
- `docs/design/BRIEF.md`: Personas (non-technical document owner, tuning power user), core tasks, principles, non-goals.
- `docs/design/TOKENS.md` & `apps/web/src/ui/tokens.schema.json`: Unified 8px grid semantic tokens (surfaces, borders, text tiers, accents, status, density multipliers, motion).
- `docs/design/COMPONENTS.md`: Multi-layer inventory (tokens -> primitives -> composites -> panels -> layouts -> shell) with state matrices and a11y requirements.
- `docs/design/FLOWS.md` & `docs/design/wireframes/`: Static SVG wireframes covering onboarding, document QA, barge-in voice, model switching, folder ingestion, customization, undoable destruction, engine-down states, and mobile layouts.
- `docs/design/MICROCOPY.md` & `apps/web/src/ui/strings.ts`: Centralized string table; plain, warm, specific tone; truthful privacy disclosures (no unsubstantiated "100% secure" marketing claims).

### 2. First-Party Modular Panel Architecture (D1)
- **PanelRegistry**: A strictly typed registry where panels declare `id`, `title`, `icon`, allowed slots (`left`, `center`, `right`, `bottom`), required capabilities, lazy loaders, min/max dimensions, and default keyboard shortcuts.
- **Capabilities Discovery**: Authenticated `/v1/capabilities` endpoint exposing live runtime features (e.g. `speech`, `knowledge`, `gpu`, `models`) derived from gateway health and config. Shell only activates panels matching reported capabilities.
- **Resilience**: Every slot and panel is isolated by a React ErrorBoundary so failures in one panel never crash the shell.
- **Presentation Separation**: Presentational components receive pure props; data hooks interface with the typed API client.
- **In-Repo Design Gallery**: A dev/test-only gallery component/route displaying primitives and composites across all states, densities, and themes.

### 3. Data-Only Customization System (D2)
- **Zero Script / Style Injection**: Custom themes and preferences are purely declarative JSON validated against `tokens.schema.json`. Any `url()`, `@import`, script, or unrecognized token is strictly rejected.
- **Enforced Contrast Guard**: Custom accent or theme selections are programmatically verified against WCAG AA (>= 4.5:1). Non-compliant colors are automatically adjusted or rejected.
- **Preferences Persistence**: Authenticated gateway SQLite persistence (`user_preferences` table with schema migration) so settings follow LAN sessions; fallback to safe local state on corruption with default recovery notice.

### 4. UX Friendliness, Budgets & Thresholds (D3, D5)
- **Onboarding**: Short, skippable, truthful first-run flow showing hardware detection, model readiness, and live zero-egress self-test result.
- **Performance Budgets**:
  - Fresh install to first answer: <= 3 user clicks post-onboarding.
  - Interaction latency (INP) on typing and slot switching: < 100ms.
  - Cumulative Layout Shift (CLS) during streaming: 0.
  - Production client bundle: JS gzipped <= 300KB, CSS gzipped <= 30KB.
- **Accessibility & Safety**:
  - Target: WCAG 2.2 AA compliance; touch targets >= 44px on mobile; screen reader live regions.
  - Forgiving actions: Soft-delete with undo toasts for conversations; explicit typed confirmation for permanent purges.

## Relaxes Gate?
No. Strengthens UI requirements, establishes formal performance budgets, enforces WCAG AA contrast gates, and mandates zero external egress.

## Status
Accepted.
