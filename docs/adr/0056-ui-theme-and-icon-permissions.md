# ADR0056: third-party palette and icon permissions

2026-10-11. Primary repositories audited for the palette origins named in
Hermes shared/desktop source: Primer GitHub theme, Catppuccin VS Code,
sainnhe Everforest VS Code, Ryan Olson Solarized and Ethan Schoonover Solarized.
All five publish MIT notices. Full primary notices retained in docs/licenses/;
exact audited revisions and byte hashes in ui-theme-license-audit.json.
This license review does not replace the pinned Hermes palettes with newer
theme code or infer that current source is visually identical to the reference.
First-party palette adaptations retain the monorepo MIT notice too. Product
labels rename Nous-branded presets; audit/provenance names remain accurate.

Fetched exact public lucide-react0.577.0 and @tabler/icons-react3.44.0 tarballs
with npm pack --ignore-scripts. Read packaged LICENSE files: Lucide ISC plus
Feather-derived MIT, Tabler MIT Copyright2020-2026 Paweł Kuna. Exact combined
notices retained; MIT portion must not be dropped when using Lucide. No package
admitted to the product yet; lockfile/license scan/audit must pass when installing
only the necessary icon package. Do not import either brand marks or other
desktop fonts merely because the icon libraries are permissive.

The first Solarized URL was incorrect and returned404; corrected primary repo
vscode-solarized-theme and read the actual license. Windows console initially
failed to print Tabler's copyright character with cp1252; reran with Python UTF8
and preserved the exact UTF8 notice. These were inspection failures, not passing
product checks. No thresholds or product scope changed by this ADR.

Exact Solarized primary notice includes a trailing blank line. Git whitespace
check initially rejected it; retain the failure and preserve the original bytes
using a path-specific .gitattributes legal-notice exception, analogous to0042.
This exception applies only to that copyright notice, not source code or tests.
