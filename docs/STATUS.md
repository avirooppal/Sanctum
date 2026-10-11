# Current state

- Mission: [MISSION.md](MISSION.md), Amendment1; single owner ADR0027.
- Step: U4 palette/token controls implemented on `ui-hermes-port`; full port pending.
- Last hosted-green: `8d3e98c`, run38132080056/all5 jobs PASS.
- Blockers: none for UI; T1/GPU/physical audio/native targets UNVERIFIED.
- Next three steps:237px
  responsive shell; isolated pinned reference/fidelity/axe/WS egress gates.

| Gate | Latest actual results |
|---|---|
| Linux/Rust |157/57 PASS; fmt/lint/types/clippy;26/72/92 package licenses plus reviewed MIT source |
| Egress/startup/supervision |38 denial/startup probes PASS;3 supervision scenarios/zero survivors |
| Web |26 tests +2 metrics PASS; typecheck/build/npm audit0 |
| Theme browser |96 theme/mode/viewport cases +3 system-mode checks; no foreign HTTP/storage/overflow |
| Incremental smoke |6 real stages PASS; release_complete=false |
| Full UI/product/release |NOT DONE; font/shell/fidelity/axe and later roadmap remain; no phase/release tags |

## Preserved evidence

All preceding STATUS narratives preserved verbatim in
[native-primitives archive](status-archive/2026-10-11-native-primitives.md), SHA256
`3c3bf6fbe5be3ac756c3cd0aa1ec69e2285ad3a9d5d6f664444f45cfeb4b25ea`.
It links all older archives and their hashes, commits, real results and failures.
No measurement deleted or rewritten. [REVIEW_QUEUE](REVIEW_QUEUE.md) preserves decisions.

Token slice: contract and3 tests first (missing module FAILED), then only pinned
MIT shared palette/color files copied with exact notices and provenance.16 actual
choices, in-memory light/dark/system controls; unknown IDs fail. Source registered
in profiles/registry.json, no npm dependency added. Source hashes include both
checkout bytes and canonical Git blobs; original checkout report retained.
ADRs0056/59 describe palette rights, renamed identity and opaque semantic tiers.
System mode added after its browser assertion FAILED first; listener cleaned up.
Fonts remain system-provided; legacy250px layout remains until shell migration.

Commands actually run: `npm test/typecheck/build`, `npm audit --audit-level=low`,
`node evals/browser_themes.mjs <playwright> evals/results/ui-themes-browser.json`,
`node evals/browser_licenses.mjs <playwright> evals/results/ui-themes-licenses-browser.json`,
Linux `python tools/check.py`, `bash tools/check_rust.sh`, and full incremental
`bash tools/smoke_all.sh` after final system-mode changes. All PASS, numbers above.
Raw ui-themes-release-* and browser JSON preserve final runs; prior smoke/supervision
measurements restored. Actual text minimum12px/ancestor opacity>=0.7 across96
cases; system dark/light transitions observed at each viewport; storage0,
no horizontal overflow. Screenshots inspected; not reference fidelity evidence.

Legal-notice EOF whitespace initially FAILED; preserved source notices intact by
adding a nonempty closing explanation after them, rather than editing the notice.
Unstaged STATUS caused an initial rebase refusal; after committing, retry reported
up to date against origin/main; no stashing or unrelated-file change. All failures
recorded; no thresholds loosened. Native notice still matches bundled text exactly.

Candidate token slice not yet hosted verified. No merge to main until U6 passes.
Runtime PID1327 remains active on8769, .sanctum/runtime-dispatch.json, for the next
UI slice; do not rebuild during real engine measurements. No software gap is
classified as hardware-only UNVERIFIED. Voice pipeline currently advertises false.

Font admission slice: palette1fdf041 exact hosted run38130611442/all5 jobs PASS.
Four font-gate tests first FAILED on missing module, then PASS4; actual offline
`python tools/web_font_assets.py` PASS5 exact binaries and primary OFL notices.
Registry records all source revisions/URLs and binary/notice hashes. Source CI now
runs this gate; rejects tamper/unregistered/non-OFL/escaping paths. No new npm dep.

`node evals/browser_fonts.mjs <playwright> evals/results/ui-font-assets-browser.json`
first FAILED absent FontFace registration, then PASS actual decoded5 faces,5 HTTP200
responses, foreign HTTP0 and identical existing CSP string. Scoped Spectral/Archivo/
JetBrains tiers applied; layout shells retain system fonts; original brand fonts
are absent. Full source157/Rust57, fmt/lint/types/clippy/licenses/denial38,
supervision3/zero survivors and full incremental smoke6 stages PASS after wiring.
Named ui-font-assets-* raw results; prior smoke/supervision evidence restored.
Font-dependent themes96 +system3 and native notice3-view keyboard/exact text/
centering/no-overflow checks rerun PASS. Screenshots inspected. No fidelity claim.

Three exact primary notices have trailing spaces; initial Git whitespace failure
preserved. ADR0060/REVIEW_QUEUE scopes legal/evidence-only byte-preservation rules;
no source/test formatting exception or threshold change. Original font bytes and
names unchanged. Bold/italic/language and full per-theme fidelity remain pending.
Font8d3e98c pushed; exact hosted run38132080056/all5 jobs PASS. Next responsive shell and reference harness.
