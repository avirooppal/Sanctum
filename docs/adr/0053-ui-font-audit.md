# ADR0053: font exclusions and licensed candidate review

2026-10-11. No font binary is admitted by this ADR yet. Render comparison and
per-file provenance are required before final substitute selection.

| Upstream family | Disposition |
|---|---|
| Collapse (Thin/Light/Regular/Bold and italics) | Exclude: no independent redistribution grant found in package |
| Rules Compressed (Regular/Medium) | Exclude: no permissive grant; foundry offers scoped licenses |
| Rules Expanded (Regular/Bold) | Exclude: same; compare Archivo width axis as candidate |
| Mondwest Regular | Exclude: publisher trial/personal use is not permissive redistribution; compare VT323 and Pixelify Sans |
| Neuebit Bold | Exclude: same publisher boundary, no permissive grant verified |
| System Sans/Serif/Mono, platform emoji fallbacks | CSS fallbacks only; do not redistribute OS fonts |
| Inter, IBM Plex Sans, Work Sans, Atkinson Hyperlegible, DM Sans | OFL1.1 primary notices fetched; binary admission/hash still pending |
| Spectral, Fraunces, Source Serif4 | OFL1.1 primary notices fetched; binary admission/hash still pending |
| JetBrains Mono, IBM Plex Mono, Space Mono, Share Tech Mono, DM Mono, Courier Prime | OFL1.1 primary notices fetched; no remote font stylesheets in product |

Google/fonts primary notices pinned to
bd8f81ddb5c74d5c8897b36ad88b440266245103, under ofl/<family>/OFL.txt.
Candidate notices also include Archivo, VT323 and Pixelify Sans. These are
candidate permissions, not an assertion of visual equivalence or shipped files.
Local dev evidence: .sanctum/upstream/font-audit/. Preserve exact OFL notices
with any admitted binaries; no font modifications or reserved-name changes.

Sources: https://pangrampangram.com/pages/faq (personal trials and scoped app
embedding); https://displaay.net/help/licenses (scoped licenses);
https://github.com/google/fonts/tree/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl.
The upstream JetBrains Apache comment conflicts with its primary OFL notice;
primary evidence governs. Unknown rights mean exclusion, not permission.
