# ADR0083: Owner-directed liquid-glass landing page

2026-10-18. Apply the supplied recreation to Sanctum's public website,not chat.
Keep truthful setup,platform and journey-status projections and existing routes.
Replace newsletter/signup/social controls with real app/docs/status links;
there is no newsletter/signup backend. No new product capability is advertised.

React/Vite/Tailwind with pinned framer-motion(MIT) and lucide-react(ISC).
Instrument Serif regular/italic is self-hosted under OFL-1.1 with its notice,
instead of Google Fonts runtime requests. Existing same-origin CSP stays intact.
The five supplied CloudFront clips have unverified redistribution rights:
do not download/ship/reference them at runtime until the owner supplies rights.
Use original first-party vector artwork as the actual current visual treatment;
video support remains gated by an explicit bundled-asset manifest. Do not claim
the supplied footage or real-media fade loop has been validated without assets.

The previous public-page zero-script assertion is superseded by the explicit
React request:require same-origin module scripts,storage0,foreign HTTP/WS0,
no eval/inline executable scripts,unchanged CSP. Preserve all other assertions.
No timeout or old security threshold is relaxed. New initial loaded JS budget
for this separate public route:<=240KiB gzip;fonts<=200KiB total;no new
dependency advisories;44px targets,12px type floor,no390px overflow. These are
new route budgets,not changes to existing chat budgets. Reduced motion renders
static artwork and no reveal/video animation. Failure leaves truthful static
support information and working docs/app links available.

The new multi-entry public route makes the former all-JS-artifacts comparison
span two independent entry graphs. Scope ADR0078's unchanged12KiB JS/8KiB CSS
incremental limits to the authenticated entry graph,including lazy notices;
measure public-route assets separately under the new240KiB limit. Record this
scope change before comparing entry graphs. Never label the old all-artifacts
aggregate as passing:it now also contains a separately requested public app.

Admit tslib2.8.1's verified0BSD license (Microsoft copyright and explicit
permission for any purpose,with or without fee) as a new permissive SPDX type.
Keep exact lockfile integrity/registry matching and proprietary rejection.
This is a reviewed license admission,not a scan exception. Evidence:installed
tslib/LICENSE.txt,its pinned npm tarball and the new admission/rejection tests.
