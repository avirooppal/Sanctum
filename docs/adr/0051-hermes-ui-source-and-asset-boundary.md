# ADR0051: Hermes UI source pin and asset boundary

2026-10-11, developer setup only. Shallow clone completed at
`b30f95ac4a80d2f6dbe3aa01001b0524314f6d74` from NousResearch/hermes-agent.
Root LICENSE is MIT, Copyright(c)2025 Nous Research. Preserve its exact notice
when adapting code. Target desktop renderer chat (`apps/desktop/src`) plus browser
dashboard settings/analytics (`web/src`); shared themes/protocol live in apps/shared.
ui-tui/website and desktop plugins are not product targets. No community extraction
used; pinned monorepo remains source of truth.

`@nous-research/ui@0.18.2` is the actual pinned upstream dependency, publicly
available and declares MIT (npm metadata and downloaded package.json inspected).
Latest metadata1.5.2 is not the reference pin. The tarball includes Collapse,
Rules Compressed/Expanded, Mondwest and Neuebit WOFF2 files but no LICENSE/COPYING
file found in the published package. Its fonts.css loads those brand fonts.
Package MIT metadata is not sufficient evidence for separate font redistribution.
Do not install/copy the package wholesale; recreate tokens/primitives locally from
MIT monorepo code, excluding all unverified font and brand assets. No product
dependency or frontend code changed by this discovery slice.

Fonts audit: Collapse/Rules/Mondwest/Neuebit redistribution permission unverified,
therefore excluded. JetBrains Mono primary repository publishes OFL1.1, contrary
to web/index.css's Apache comment; exact font-file provenance still pending before
copying. Choose bundled OFL substitutes in the next slice, with their notices and
hashes; do not claim a specific unverified font is shipped. References:
https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt and
https://registry.npmjs.org/@nous-research/ui/-/ui-0.18.2.tgz.

Brand audit: Nous/Hermes logos, caduceus, wordmarks/banners and names excluded from
product identity; required legal attribution is retained. All upstream raster/
SVG/font assets excluded until individually verified. Do not infer icon/image
licenses from the root code license. Desktop plugin hermes-bots has its own MIT
notice(Copyright2026), but remains excluded as unsupported product functionality.

Privacy adaptation: remove Portal/cloud agent/auth, shared metrics consent,
update/restart/auto-install, messaging/cron/terminal and Electron APIs. Use only
Sanctum same-origin APIs, memory-only auth/drafts, existing CSP and local compiler
glue. Reference renderer/mock gateway is developer-only; product gets no mock data.
This is source discovery/preliminary audit, not completed Step U or fidelity.
