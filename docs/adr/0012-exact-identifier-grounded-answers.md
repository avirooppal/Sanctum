# ADR 0012: Resolve unique exact identifiers from retrieved child passages

- Status: Accepted
- Date: 2026-10-10

## Context

The v6 Phase 2 challenge has 30 exact machine-identifier questions and 450
near-duplicate decoys. The initial answer replay cited 28/30 expected source passages
even though hybrid retrieval found the targets. The small local generator sometimes
selected a decoy while composing an answer.

## Decision

When a query contains an exact identifier that occurs uniquely in the retrieved
parent/child evidence, return the matching child passage verbatim, preserve its source
citation, and attach parent heading context. Otherwise use the normal locally grounded
answer path. ACL filtering remains upstream and applies before any evidence is examined.

## Consequences

Exact-key lookups become deterministic and keep the quoted claim tied to the source
passage. This path does not replace general answer generation or establish semantic
faithfulness; local judge and human review remain required. The route is covered by
the v6 challenge and unit tests.
