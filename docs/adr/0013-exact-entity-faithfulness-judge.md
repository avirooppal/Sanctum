# ADR 0013: Require exact entity evidence in faithfulness judgments

- Status: Accepted
- Date: 2026-10-10

## Context

Manual inspection of the v6 vector-only review samples found answers citing values
from decoy records whose identifiers differed from the identifier asked about. The
configured local model judge marked those answers supported (30/30), the same as the
correct hybrid answers. Its original prompt did not prevent a semantically similar
decoy passage from being mistaken for evidence about the requested entity.

## Decision

When a question contains an exact identifier of at least 12 uppercase alphanumeric
characters, a judgment is unsupported unless that exact identifier occurs in the
retrieved parent/child evidence. Apply this deterministic relevance check before
calling the local entailment judge. Preserve the original answer results and record
the calibrated judge under a separate run tag.

## Consequences

The judge cannot mark a decoy record as supporting a question about another entity.
For matching-identifier evidence, the local model still checks entailment. The check
is intentionally narrow; broader semantic judge calibration remains future work.
Phase 2 must be re-evaluated with this rule before its local-judge gate can pass.
