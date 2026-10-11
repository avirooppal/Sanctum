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
