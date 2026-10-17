# ADR0078: Cozy directions without replacing the reference

Date: 2026-10-17. Owner-directed design task; single-user scope unchanged.
Status: accepted for implementation; default-theme decision awaits the owner.

Keep the pinned Hermes-derived geometry, palettes and fidelity gate. Add Paper,
Night Study and Studio as data-only packs through the existing themeTokens and
preferences path. Do not replace the shell, add backend capabilities, copy a
product's assets, fetch remote resources or change the owner's saved preference.
The current default is id `sanctum`, label Sanctum. Preserve that id and its
palette bytes. The next implementation slice may label this reference choice
"Hermes" as expressly requested here; that is a theme attribution, not a product
rename or permission to use upstream marks. Update its branding assertion
test-first and preserve every existing canonical-palette assertion.

New directions have both light and dark variants. Paper emphasizes reading;
Night Study emphasizes low-glare warmth; Studio emphasizes scan efficiency.
Use the already admitted Archivo/Spectral fonts and bundled assets initially.
No new library, font, icon set or third-party code is admitted by this ADR.
Research links are references, not license clearance. Existing notices remain.

The new 12px floor supersedes TOKENS.md's 11px design specification for the new
directions. Do not claim the old renderer already complies. Audit and record
any inherited violation; do not silently alter a fidelity reference to hide it.
Normal text, including muted labels, requires 4.5:1; essential control/focus
boundaries require 3:1 against their adjacent surfaces. Decorative separators
are not text and must not be mistaken for the only control boundary.
Every new theme's actual semantic pair map must be tested, not every arbitrary
combination of two palette colors. Existing gates are not relaxed.

Before measuring the new packs, set incremental budgets relative to the same
commit built without them: <=12KiB gzip JS, <=8KiB gzip CSS, zero additional
font/image/icon bytes and zero new npm dependencies for the token slice.
Later illustration/icon admission requires another measured budget entry.
These incremental limits do not replace existing absolute route budgets.
Lab typing/panel interaction p95 <=200ms across >=50 interactions per class;
report this as lab interaction latency, not field INP. Streaming layout shift
<=0.01 over >=50 streamed updates with fixed reference messages; report browser,
hardware, sample count and font readiness. Existing fidelity/latency gates stay.
No performance result is asserted by choosing these targets.

Interaction motion uses transform/opacity only, 120-200ms ease-out, with reduced
motion disabling nonessential transitions. This falls inside the owner's
120-220ms envelope and the local UI skill's 200ms ceiling. No sound, shimmer
dependency or animation that prevents input. New themes use opaque text tokens;
no text opacity below0.7. Paper targets70ch and1.65 line height, within65-75ch
and1.6-1.7; density must not reduce mobile targets below44px or text below12px.

Acceptance protocol is CRITERIA.md. Two genuine screenshot critique iterations
per direction are required before recommending a default. The before/after
comparison must show actual components, identical content/viewports, reference
theme and all three alternatives. No replacement default until an explicit
owner choice; the absence of a reply is not consent. Do not invent screenshots,
user findings, contrast results, fidelity numbers or two-hour comfort claims.

This first slice is documentation/research only. Theme packs, automated contrast
coverage, gallery matrix, screenshots, axe/zoom/keyboard/performance comparisons
and the default recommendation remain pending. Packaging work is preserved on
codex/runnable-installation; this branch starts at its verified1df4286 checkpoint.
