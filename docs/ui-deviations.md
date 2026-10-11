# UI deviations and pending work

Reference source pinned in ADR0051; the full UI port is unfinished.

Palette/token stage (ADR0059) now adapts the11 shared presets, Classic and four
dashboard-only presets into16 local theme choices. Branded IDs/labels renamed.
Semantic text uses opaque contrast-adjusted tiers rather than low-alpha desktop
tiers. Current250px legacy layout and system fonts remain until renderer/font
migration; this color-control stage is not the completed UI port or fidelity gate.

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
