# ADR0089: Pinned Jan study; fresh implementation boundaries

Date: 2026-10-20. Status: PROVISIONAL owner review; proceed with fresh code.

JAN_STUDY.md pins the source, records exact license bytes and NOTICE absence,
and provides the component decision table. Study was source inspection, not
a Jan runtime test. Apache-2.0 declaration and primary full text are preserved.
No transitive license admission follows from the root declaration.

Recommend fresh Sanctum UI, settings, pack, broker, tool/MCP and computer-use
boundaries; retain Sanctum's verified runtime/library components. Jan provides
architecture/UX principles only. No Jan source or asset adaptation is approved.
Future adaptation requires an ADR identifying paths, obligations, changes and
tests before copying; update provenance and third-party notices at that time.

The rationale is the existing tested Rust core, required network/permission
boundaries, smaller dependency budget and the ban on UI extension code.
Jan's telemetry, updater/mirror behavior and docs site do not carry over.
No scope or threshold is reduced. B2/B3 must measure actual candidates before
the shell/UI decisions; B7 then proposes numeric budgets.
