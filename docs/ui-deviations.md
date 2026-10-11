# UI deviations and pending work

Reference source pinned in ADR0051; no UI port has landed yet.

- Product identity is Sanctum. Upstream brand marks/names/links are omitted;
  copyright/permission notices remain in legal attribution.
- Unverified Collapse, Rules, Mondwest and Neuebit font files are excluded;
  permissively licensed substitutes and exact metrics are pending.
- Do not ship the upstream UI package wholesale, despite MIT metadata, because
  bundled font assets lack separately verified redistribution permission.
- ui-tui, marketing, messaging, cron, Honcho, terminal/PTY and desktop plugins
  are omitted. Existing Sanctum screens remain functional; unsupported new pages
  remain hidden until backed by tested services.
- Electron bindings, Portal/cloud agents, shared metrics/update/install calls
  are removed. Product is same-origin/offline and uses memory-only credentials.
- Fidelity, theme-by-theme screenshots, token comparisons, accessibility and
  browser egress gates are **Not done**. No exact-match claim or invented percentage.
