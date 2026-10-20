# ADR0088: Index retained history lookup

Date: 2026-10-20. Status: adopted corrective change; owner review recorded.

The restored A2 HTTP journey timed out searching history after a real chat.
A read-only diagnostic found 3,716 conversations, 3,717 turns and no turns
index in the test database. A correlated conversation/content lookup exceeded
the diagnostic's 15-second cancellation bound. This is retained functionality.

Add a migration indexing turns by conversation. Preserve query semantics,
owner checks, ordering, content search and all request bounds. The regression
fixture contains 4,000 conversations/turns and an absent search term, exercising
the full search. Its existing HTTP metadata budget is 10 seconds; this is not
a new relaxed threshold. Test old behavior before migration and preserve output.
Reopen the migrated database to test idempotence and existing content preservation.
The 15-second read-only probe is diagnostic only, not an acceptance threshold.
The first fixture used tiny requests and passed before the fix (a2-history-red.log,
3.20 seconds for both searches). Keep that result; the revised fixture uses
4,000-byte request payloads to represent the observed 15 MiB database.

The original failed HTTP run remains named a2-retained-state-first. Repeat that
journey against a rebuilt runtime and retain both results. No baseline performance
number is replaced by the corrective run.

Observed: representative fixture29.656911s before the index; two searches plus
reopen/content checks0.40s total after it. The fixture was then strengthened to
create the old schema directly before populating, so opening Store migrates
already-populated history; the full10-test sessions suite passed in0.30s.
The rebuilt-runtime HTTP journey passed all10 recorded checks without retries.
