# Web themes v1

Pinned MIT desktop palettes plus clean dashboard-only palettes, adapted to the
Sanctum identity. Explicit theme ID and light/dark mode; unknown IDs fail. No
remote font URL, package/IPC install, backend mutation or browser persistence.
Return fresh semantic CSS-token maps, never mutable shared palette references.
Primary/secondary/tertiary/disabled/on-accent tokens; opacity remains1, readable
font floor12px. Legal-font substitution and full typography migration are separate.

Test all desktop presets and dashboard-only Teal/Teal Large/Rose/Cream Blue;
check pinned canonical colors, classic conversion, contrast computation and
mode behavior, invalid IDs, immutability, and absence of network/font URLs.
Real browser theme changes must be exercised before declaring the control usable.
This slice does not complete U5 all-theme fidelity or axe verification.
