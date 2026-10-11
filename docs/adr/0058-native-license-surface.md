# ADR0058: in-app legal notice and native primitive foundation

2026-10-11. Mandatory in-app notice is implemented before the full renderer port.
Native dialog provides inert background, Escape and focus return without importing
Radix/Electron/upstream package assets. Exact THIRD_PARTY_NOTICES text is bundled
and rendered as React text; no links fetched or HTML interpreted. This does not
claim all release dependency notices are complete: the existing notice states its
incremental scope explicitly. Component palette stays the existing Sanctum palette
until the theme port; system fonts only, no excluded font binaries shipped.

Button geometry references the reviewed desktop MIT button:2.5px radius,6px gap,
12px type and100ms color transition. Native controls are first-party adaptations;
provenance records the inspected source hash. Override upstream disabled opacity
with semantic text and opacity1 per the mission's0.7 floor. Input/Card groundwork
is not a new backend screen; use them in subsequent shell slices.

New legal-dialog geometry: centered, width min860px or viewport minus32px, maximum
height min720px or86dvh, padding24px. Browser centering tolerance1CSS pixel for
fractional rendering, minimum readable font12px, control opacity1, reduced-motion
transition0s, no horizontal overflow and zero foreign HTTP requests. These are new
surface assertions, not changes to previous phase gates or latency tolerances.
Full axe, all-theme font tiers, WS-aware egress and upstream fidelity remain pending.

Screenshot inspection found Tailwind Preflight's margin reset placed the native
dialog at the top-left despite the initial keyboard/text checks passing. Add the
centering regression before correction; preserve its failed run and earlier
diagnostic result. Explicit margin/inset/max-width restores intended native modal
placement; no tolerance widened. No new npm dependency or audit suppression.
