# ADR0085: Retire the legacy UI and its product-specific gates

Date: 2026-10-20. Status: adopted within the owner-directed pivot (ADR0084).

The owner explicitly withdrew the public website, documentation site and Hermes UI.
The prior app shell and browser journeys depend on that UI throughout; retaining a
renamed shell would misrepresent the new product. Retire the entire old shell,
reference tools, mock bridges, themes, fonts, artwork, pixel/fidelity gates and
associated results. Archive source: pre-pivot-2026-10-20; subsequent baseline
checkpoint: 625e48e706d431d546474e2ee9c9f71d7baea127. Historical ADRs remain,
but their website/Hermes implementation dependencies are SUPERSEDED (ADR0085).

apps/web becomes a development-only reuse library, with no HTML entry or user
screen. The gateway returns 404 for retired frontend routes, even if an old
ui_dir still exists. Accept that config key for backward compatibility only.
Desktop UI and first-run are PENDING M3; no placeholder substitutes for them.
Legacy packaging is disabled until real desktop packaging exists in M11.

Retain first-party API/WebSocket, cancellation, health/error truth, audio helpers,
workspace bootstrap and SafeMarkdown after dependency review. Test these again,
including browser Markdown injection and actual gateway retirement responses.
Audio helpers are candidate pack code, not an implemented optional-pack lifecycle.
No theme or upstream assets are retained. React notices remain; source license
verification is recorded in pivot-removal-react-license.json. No Jan code is
introduced in M0; Jan study, source licensing and adaptation decisions belong to M1.

## Gate and scope amendment

Explicitly remove tests for withdrawn UI, reference environment, font comparison,
public-status HTML projection and fidelity/geometry. Preserve journey ID/step and
budget consistency, secret/license checks, backend contracts, all real API smoke
stages, storm/leak/shutdown/overload and containment gates. Replace legacy UI
browser stages with a real-gateway retirement and renderer safety check. Fewer
tests reflect removed scope, not evidence of new desktop functionality. No numeric
budget, tolerance or timeout is relaxed. Full journey status becomes PENDING; the
existing click/key/text budgets remain unchanged. Proposed desktop performance
budgets remain proposals, not enforced acceptance. Historical measurements are
not measurements of this library or the future desktop.

Store a SHA256 removal inventory and retain fresh named baseline logs. Existing
ignored reference checkouts/build outputs may be quarantined under .sanctum/retired;
this preserves local files while taking them out of the active build environment.
The archived commits retain old tracked results; unrelated user files are preserved.

The unsigned runtime development-bundle helper remains, but no longer copies web
assets. Its existing overwrite/path-safety test also rejects bundled apps/web.
This helper is not a native desktop installer.

## Named test-removal audit and follow-up

See [TEST_REMOVAL_AUDIT](../TEST_REMOVAL_AUDIT.md) for every removed test/stage,
feature/evidence mapping and187→183/95→45/19→8 count reconciliation. ADR0087
records restored retained HTTP/dependency assertions and the subsequent dead-code
removal. The original retirement was not lossless; the gaps are explicitly repaired.
