# UI deviations and pending work

Reference source pinned in ADR0051; the full UI port is unfinished.

Palette/token stage (ADR0059) now adapts the11 shared presets, Classic and four
dashboard-only presets into16 local theme choices. Branded IDs/labels renamed.
Semantic text uses opaque contrast-adjusted tiers rather than low-alpha desktop
tiers. That stage retained250px/system-font layout; ADR0060/61 subsequently admit
font tiers and237px responsive rail. The full UI port/fidelity gate is unfinished.

- Product identity is Sanctum. Upstream brand marks/names/links are omitted;
  copyright/permission notices remain in legal attribution.
- Unverified Collapse, Rules, Mondwest and Neuebit font files are excluded.
  ADR0055 selects OFL Spectral/Archivo/League Gothic/VT323 from120 measured local
  render comparisons. Mean width differences5.14%-24.61% remain intentional legal
  deviations, not exact-match claims; full font fidelity is still pending.
  ADR0060 now admits the five exact selected OFL files and scoped styles; full
  per-theme font/bold/italic/language fidelity remains pending.
- Do not ship the upstream UI package wholesale, despite MIT metadata, because
  bundled font assets lack separately verified redistribution permission.
- ui-tui, marketing, messaging, cron, Honcho, terminal/PTY and desktop plugins
  are omitted. Existing Sanctum screens remain functional; unsupported new pages
  remain hidden until backed by tested services.
- Electron bindings, Portal/cloud agents, shared metrics/update/install calls
  are removed. Product is same-origin/offline and uses memory-only credentials.
- Fidelity, theme-by-theme screenshots, token comparisons, accessibility and
  browser egress gates are **Not done**. No exact-match claim or invented percentage.
- Knowledge currently uses the native dialog and existing real workspace/upload/
  ask API. Citations show source, page when available, and supporting quote as
  inert text. A document browser, OCR and region overlays are not claimed. This
  functional surface has not passed the upstream layout fidelity gate.
# Public website scope supplement (ADR0064)

The owner explicitly requested all surfaces with Sanctum information. The pinned
repository's website/ is documentation, while the live marketing homepage is
separate. /website.html is an initial same-origin adaptation of its split blue
hero, platform cards, features and FAQ structure. Original CSS arch artwork
replaces unverified upstream illustrations; existing OFL League Gothic, Archivo
and JetBrains Mono replace unverified homepage fonts. No remote asset is copied.
Commercial Portal plans, cloud deployment and unverified download buttons are
replaced by working local-app navigation and honest support/setup content.
The documentation site, full dashboard/chat fidelity and executable packages
remain pending. Three-viewport functional checks are not pixel-diff acceptance.

## Workspace UI modularity and customisation supplement (ADR 0068 / Amendment 2)
The owner directed a fully modular, customisable, aesthetic, and UX-friendly workspace UI.
- **Shipped & Verified**:
  - D0 design artifacts committed: `BRIEF.md`, `TOKENS.md`, `tokens.schema.json`, `COMPONENTS.md`, `FLOWS.md`, 9 static SVG wireframes in `docs/design/wireframes/`, `MICROCOPY.md`, `CRITIQUE.md`, `UX_ACCEPTANCE.md`, and centralized string table `apps/web/src/ui/strings.ts`.
  - D1 typed `PanelRegistry` with capability discovery (`/v1/capabilities`), React `PanelErrorBoundary` wrapping every panel slot, data/presentation separation, in-repo design gallery route (`/index.html?gallery=1`).
  - D2 data-only customisation: theme presets, WCAG AA contrast guard enforcing >= 4.5:1 ratio, density multipliers (compact/comfortable/spacious), font scale (90-125%), layout presets (4 presets + saved layouts), rebindable shortcuts with conflict detection, SQLite server-backed persistence (`/v1/preferences` via migration `0002-user-preferences.sql`).
  - D3 UX friendliness: Hermes-style setup walkthrough, starter prompt suggestions, command palette (`Ctrl/Cmd+K`), 5-second non-blocking undo toast for destructive deletions, streaming stop control, mobile drawer layout.
  - D5 verification: 51 web unit tests green, Rust check suite green (92 crate licenses, 22 kernel denial probes), production bundle gzipped JS 91.93 kB (budget: <= 300 kB), CSS 6.08 kB (budget: <= 30 kB), `npm audit` 0 vulnerabilities.
- **Intentional Deviations & Exclusions**:
  - Third-party dynamic plugin loading: Excluded by design; first-party modularity only.
  - User-supplied arbitrary CSS / script injection: Excluded; custom themes are validated against `tokens.schema.json`, rejecting `url()`, `@import`, and script tags.
  - Human participant research: Marked UNVERIFIED as autonomous agents cannot simulate real human subjects; provided 5-participant usability testing script in `docs/design/UX_ACCEPTANCE.md` for owner execution.
  - Messaging channels (Slack, Discord, Telegram, WhatsApp): Omitted by design; they send conversation text off-device to third-party services and have no local backend.
  - Nous Portal: Omitted by design; commercial multi-tenant cloud portal requiring external accounts; violates Sanctum's on-device zero-telemetry invariant.
  - Cloud provider / API key forms: Omitted by design; Sanctum runs local inference engines only; pasting cloud keys violates default-deny privacy by construction.
  - Cron scheduling: Omitted by design; speculative automation surface with no local backend.
  - Interactive terminal / PTY: Omitted by design; direct arbitrary host command execution represents a sandbox-escape surface.
  - Remote gateway / VPS setup: Omitted by design; Sanctum is single-owner on-device and LAN mode only; remote VPS setups are out of scope.

## Dashboard Routed Pages & Website Support Matrix (S12)
- **Shipped & Verified**:
  - Dashboard converted from a modal dialog to routed pages (`apps/web/src/ui/DashboardPage.tsx`) mirroring the Hermes reference dashboard: Status, Models, Sessions, Resources (queue lanes, process/resident RSS memory estimate), Config (only real existing local fields), Licenses (in-app third-party notices), and Docs link (`/docs.html`).
  - Hash routing (`#/dashboard/status`, `#/dashboard/models`, `#/dashboard/sessions`, `#/dashboard/resources`, `#/dashboard/config`, `#/dashboard/licenses`, `#/` for chat workspace) with back/forward navigation support and command palette direct navigation.
  - Reskinned `website.html` and `docs.html` with unified token-based styles (`website.css`), including an honest platform-status section displaying the support matrix and release blockers.
  - Verification test in `apps/web/tests/website.test.mjs` verifies that the public website platform-status section reads only verified session artifacts and fails if it claims any unverified platform from `docs/RELEASE_CHECKLIST.md` as ready.
  - Web unit tests (73 passing), web typecheck (pass), web build (pass), npm audit (0 vulnerabilities), Rust foundation checks (62 pass, 22 kernel denial probes, 16 runtime denial probes), and source gate (exit code 0).

Workflow-first owner amendment (ADR0071): J1-J12 now govern navigation and
empty/error/onboarding states. Restore the existing file speech/Stop controls
lost during workspace integration (ADR0070). Fixed T1 hardware,timer-based
model verification,token bypass and broad privacy/purge claims are defects
to remove,not intentional design deviations. Full live voice/diarization,
vision,agents,ledger,cloud,LAN and crypto remain capability-gated.

ADR0073:workspace widgets wait for sequential authenticated metadata and bundled fonts. The real usage display is retained once in the status bar;the duplicate composer display/poll is removed. No admission limit or fidelity threshold is widened.

## Workflow alignment ADR0074

Setup uses actual owner authentication and runtime metadata,not simulated
provisioning. Unknown hardware/fit/speed remain explicit. Model settings list
actual registry entries. Unbacked layouts,shortcut editing,advanced appearance,
custom themes,full purge and developer gallery entry are unavailable in product
navigation. Existing isolated modules/tests remain. Privacy reports current
startup checks and ledger unavailability. No remote asset or new package added.

ADR0076 removes unconditional dashboard health/denial/memory defaults. The
existing visual structure stays;unavailable metrics show Unknown. Profile
definitions use real storage and honest failed-load states;no fake gateway.

## Cozy directions — ADR0078

Paper,Night Study,Studio are specified,not shipped in this documentation slice.
The current reference id `sanctum` and its default appearance are unchanged.
Owner-requested Hermes theme label awaits a test-first attribution adjustment;
no upstream logo/wordmark permission is inferred. No before/after fidelity,
contrast,a11y or comfort result for these directions is claimed.

## S1 iteration1 — ADR0079

Focused unlock replaces the reference pre-auth shell on the owner's instruction.
Authenticated rail geometry and registered reference palettes remain;no theme
label exposes upstream branding. Initial unlock follows system light/dark;
owner preferences load only after authentication. Third-party notices load in
a separate same-origin chunk;notices are not stripped. Button foreground now
tracks a custom accent. Raw measured baseline/reference smoke remains available;
this is not an upstream pixel-equivalence claim. Other screens remain pending.

S1 iteration2:the pre-auth card now reads real health metadata with a distinct
response-read timestamp and explicit no-ledger/no-new-kernel-test explanation.
The card uses a semantic local surface mix;registered palette bytes and237px
reference rail are unchanged. Public health reads have no auth or credentials.
Bounds and failure behavior are ADR0080;no continuous-egress claim is made.

ADR0081:chip has a reserved timestamp row and64px summary;owner-accent focus
uses the existing contrast guard. Interface metadata floor is12px across app,
website and docs. Unsupported message deletion and fake deletion Undo are hidden.
Reference theme palette and237px rail remain. Native zoom gate remains failed.
