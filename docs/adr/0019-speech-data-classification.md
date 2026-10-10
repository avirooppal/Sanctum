# ADR 0019: Align speech data classification with the shared envelope

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The speech OpenAPI contract introduced `sensitive`, while the shared diagnostics
envelope, folder-watch contract, and Knowledge catalog use `confidential`. Meeting
notes need to preserve the caller's classification when they are ingested into the
Knowledge catalog.

## Decision

Use the established values `public`, `internal`, `confidential`, and `restricted` in
the speech contract and meeting-to-Knowledge path. Do not add a second synonym or
silently translate classifications. Callers must use `confidential` for sensitive
speech and meeting data.

## Consequences

Speech and Knowledge contracts can pass the same classification value end to end.
Requests using the inconsistent `sensitive` value are rejected and must be updated.
