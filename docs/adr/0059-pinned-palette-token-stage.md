# ADR0059: pinned palette tokens before full renderer migration

2026-10-11. Copy only shared MIT palette/color files at the ADR0051 pin; preserve
root and third-party palette notices, exact original hashes and modifications.
Rename Nous preset labels/IDs to Sanctum; no brand asset or package/font import.
Classic uses the inspected desktop converter's fixed color seeds and sRGB/contrast
helpers; dashboard-only Teal/Teal Large/Rose/Cream Blue keep inspected source seeds.
Do not copy arbitrary skin CSS or remote font selectors. This stage ports colors
and usable local theme controls; full typography, spacing and shell remain pending.

Use semantic foreground tiers with opacity1 and at least4.5:1 contrast against the
base backdrop using the pinned helper's0.2 ladder. This deliberately differs from
desktop text tiers that use alpha below the mission's0.7 floor. Exact source
palette fields stay available; semantic accessibility transformations are recorded
as deviations, not a claim of exact token parity. All-surface axe still pending.
Theme/mode live only in React memory; default Sanctum follows the browser's system
color preference, with explicit light/dark overrides and a cleaned-up media-query
listener. Tests emulate both system preferences; no product default changed merely
to ease a test. System-font stage until licensed binaries/tiers are admitted.

Existing browser background assertion changes from the former green palette to
the actual pinned default sidebar color rgb246,248,250. Existing250px layout and
all functional flows remain for this stage;237px desktop rail belongs to shell
migration. No latency threshold, cancellation tolerance or phase gate changed.
New theme coverage is16 palettes x2 modes x3 prescribed viewports; readable text
floor12px, opacity1 for disabled controls, no horizontal overflow and no foreign
HTTP origin. These are new assertions, not the full WS/fidelity/a11y U6 gate.

Regular rebase check initially refused unstaged STATUS edits; after committing
those edits, retry reported branch up to date against origin/main. No stashing,
history rewrite or unrelated-file changes; record the failure rather than a pass.
