# ADR0060: exact OFL assets and component font tiers

2026-10-11. Admit only the five candidates selected by real comparisons in0055:
Spectral Regular, Archivo variable, League Gothic variable, VT323 Regular and
JetBrains Mono variable, from Google/fonts pinbd8f81ddb5c74d5c8897b36ad88b440266245103.
Every exact binary/primary OFL notice has source URL and SHA256 in the dependency
registry, scope web-font. No original Collapse/Rules/Mondwest/Neuebit file copied.
OFL fonts are specifically authorized by the mission; no general package-license
allowlist is widened. Files are unmodified, with their original family names.

Add an offline CI gate rejecting tamper, non-OFL admission, missing/unregistered
fonts and path/symlink escape from the designated public subtrees. Its notice
check verifies evidence integrity, not legal permission by itself; primary-source
audit0053/55 is the admission authority. Four tests first, actual five-font gate
run, browser first failed absent font faces then actual decoded faces loaded.

CSS registrations use only same-origin bundled files. Existing gateway CSP already
has default-src self and permits these fonts; preserve its exact string. No CDN,
remote stylesheet, data URL, unsafe-inline or new dependency. Browser checks must
observe actual FontFace status loaded plus200 responses, not fallback-only text.

Apply brand/card type locally with Spectral, page headings with expanded Archivo,
technical fields/notices with JetBrains Mono; condensed/pixel families available
for the relevant component skins. Never apply brand fonts to layout shells.
Regular Spectral/VT323 may synthesize requested bold; full bold/italic/language
coverage and per-theme typography remain pending U5. Font layout differences
remain0055 deviations; no exact-match claim or performance gate changed.

Three primary OFL notices include upstream trailing spaces. Git whitespace check
initially rejected their exact inclusion in the aggregate notice. Preserve the
named failure and exact bytes with path-specific legal/evidence-only attributes,
as in0042/0056/0057. The exception covers those three notices, the aggregate exact
notice and the raw failing check; no code, test or formatting gate waiver.
