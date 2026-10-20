# ADR0084: Pivot to Jan-style app

Date: 2026-10-20. Status: owner-directed product decision; implementation pending.
Authority: the owner's desktop-pivot instruction in this session. This overrides
conflicting website, docs-site, Hermes-port and earlier feature-freeze directives.
The plan amendment is the current roadmap; original plan text remains historical.

## Decision

Build Sanctum Desktop: a local-first desktop application with model management,
chat, assistants, typed settings, governed tools/MCP and experimental computer use.
Retain the Rust gateway/runtime, supervision, cancellation, admission, containment,
inference router and reusable engine/test infrastructure. Move Knowledge, speech
and vision behind optional, independently budgeted packs. Python is permitted in
development tooling and optional packs, never in the new core runtime path.

Retire the public website, docs website and Hermes UI/reference/fidelity work.
Their historical authority and evidence live at annotated tag
`pre-pivot-2026-10-20`, commit `1bee37bc777318b1913aac0a95eb9315e29cfa05`.
The tag is an archive, not a release or a claim that every historical gate passed.
Work proceeds on `jan-style`; do not merge an unverified slice into main.

This first checkpoint records the baseline and decision. M0 removal remains
PENDING: remove website/docs entries and their tests/build paths; reference
environment, mock gateway/bridge, pixel/fidelity gates/results and Hermes-specific
themes/provenance. Review reusable modules individually before retention.
Update dependent gates atomically with removals, preserving security assertions
for retained functionality. Do not simply delete a failing retained-feature test.
Preserve legally required notices wherever adapted code remains. An obsolete
product requirement is superseded, not a retrospective passing result.

ADRs 0051–0056, 0059–0061, 0064, 0067, 0078–0083 are superseded **where they
mandate the old product, palettes, geometry, public website or reference fidelity**.
Their license obligations, raw historical evidence and applicable safety rules
are not revoked. ADR0071/0072 journey mapping will migrate with executable tests;
old J1–J12 evidence does not establish the new desktop acceptance criteria.

## Architecture decisions still required in M1

- Pin and study Jan at an actual commit; verify LICENSE and any NOTICE at source.
  No Jan code, assets or marks are imported in this checkpoint. Its license has
  not been independently verified in this session.
- Choose Tauri, wry/tao or a minimal system-WebView launcher; no Electron.
  Review the exact dependency tree and settle file-level MPL obligations in a
  separate ADR before admission. No current license allowlist is relaxed here.
- Define pack, settings, permission, egress and platform-assurance contracts.
  Keep network features disabled until explicit enablement. All network traffic
  must use the feature-allowlisted broker and readable ledger; no cloud fallback.
  Native Windows/macOS assurance cannot inherit Linux containment results.
- Choose adaptation versus original implementation per component, preserving
  notices and documenting changes. Other products are principles-only references.

## Baseline and proposed budgets

See `docs/PERFORMANCE.md` and `evals/results/pivot-m0-baseline-measurements.json`.
The existing application has no native desktop shell or usable no-model UI mode.
Unknown desktop metrics are not zero and do not pass a budget.

Proposals for the later budget ADR and CI implementation:

| Metric | Proposed ceiling | Required measurement boundary |
|---|---|---|
| Core installer | 80 MiB | Session-built native artifact; exclude models and optional packs |
| Idle RSS, no model | 200 MiB | Entire app/WebView/gateway/helper process tree |
| Cold launch to usable UI | 2 seconds | Five process-cold launches; report every value and max; cache state explicit |
| Initial UI JS | 300,000 gzip bytes | All initially required chunks; gzip level 9; lazy chunks reported separately |
| Idle CPU | 1% of one core | Entire process tree, 60 seconds after settling; hardware and background load recorded |

These are proposals, not enforced thresholds or observed desktop passes. No
existing numeric gate changes in this checkpoint. Pack budgets must be stated
individually with install size, peak/idle RAM and an honest installation prompt.
M2 must implement CI budget checks; a missing required measurement must fail
acceptance, not be skipped or treated as zero.

## Evidence and limitations

Starting-head hosted CI: run 39099844947, completed/success, all five jobs.
Main remains at a1342cdb3a8b06b74b61e79954740a39e36b3d7b; its run 39053995599
was observed completed/success, all five jobs. Neither result certifies a new SHA.

Before product changes: source 184 tests; Rust 70 tests and 38 denial probes;
web 95 tests, typecheck/build, audit zero; full implemented-feature smoke 19 stages
passed on attempt 4. Attempt 1 lacked environment variables; attempt 2 had no
gateway; attempt 3 timed out in history search. An isolated diagnostic and the
unchanged full rerun passed. The timeout cause is unproven; no assertion, timeout
or selector was changed. Vite emitted upstream `use client` directive warnings.
This is not a zero-warning, full-journey, packaging or release pass.

STATUS history is archived byte-for-byte with SHA256. The new features remain
PENDING and must remain hidden until their journey tests pass. Computer-use
autopilot, platform enforcement, evaluations, installers and fresh-machine
acceptance are not established by this decision.
