# ADR0082: Focus the chat workspace

Owner-directed,2026-10-18. The supplied screenshot exposes repeated status,
permanent bright history actions,and a full-width oversized composer. Keep the
237px reference rail and registered palettes;change hierarchy and spacing.

History becomes one quiet row with native details for Rename/Delete;confirmation
and real persistence remain. Footer diagnostics move behind native details,
with one truthful startup-report summary visible. Speech and meeting disclosures
remain mounted and reachable below the composer. No backend feature is removed.
Use browser-native disclosure keyboard behavior,not a new focus implementation.

Before measuring:set composer width<=800CSSpx and empty height<=160CSSpx at
1440x900;retain44px actionable target floor,12px type floor,AA contrast and all
existing deadlines/SLOs. Transcript is the single chat scroller;composer stays
visible. History actions must be keyboard reachable when disclosed;delete still
requires confirmation. Mobile390px must have no root overflow. Preserve HTTP/WS
same-origin enforcement and all legacy behavior tests;update interaction steps
to open disclosures without deleting assertions. No dependency/assets admitted.

This is the first conversation/sidebar/composer refinement,not completion of
their required three/two critique rounds or the outstanding zoom/axe gates.
