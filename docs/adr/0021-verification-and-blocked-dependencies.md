# ADR 0021: Verification scope and blocked dependencies

Accepted 2026-10-10 for the autonomous implementation mission.

The plan's phase exit criteria remain authoritative. The current user instruction
allows independent implementation to continue when hardware or environment checks
are blocked. Work may therefore proceed on contracts and independent components in
roadmap order, but this does not satisfy a phase's exit gate. Phase 7 remains deferred.

Use `phase-N-green` only after the full phase regression/security suites and the
plan's exit criteria are verified. Partial implementations are not "green with
unverified items" merely because their unit tests pass. Report source-slice checks
separately from product and hardware acceptance. Earlier completion claims are
historical evidence, not freshly rerun results.

Record the tested base commit before each slice; the conventional commit containing
that record identifies the resulting slice. A subsequent status record can name its
hash. This avoids a self-referential commit hash in a committed document.

No benchmark is replaced with a mock score. Preserve historical synthetic datasets
as diagnostic evidence; new product-quality claims require labeled real documents
and measured model behavior. Runtime failures remain fail-closed.
