# ADR 0028: Bounded concurrent dispatch and Step 0 gates

Accepted 2026-10-10. Replace the serial application dispatch with six bounded
blocking workers first. Existing inference/SQLite/IPC are blocking; they must never
run on an eventual async transport event loop. Reserve 2 control slots, 1 voice,
2 chat and 1 background slot; cap waiting work at 8, expire after 10 seconds.
Voice precedes chat and background when selecting eligible jobs. No new dependency.

This is an incremental migration, not an exemption from the continuation brief.
tiny_http's internal accept/parser behavior is not a proven connection bound;
transport replacement/limits, true engine cancellation and hosted WS remain Step 0
work. Do not proceed to Step 1 until all Step 0 tests pass.

Predeclare held-voice-test gates: health/models p95 <=250ms and short chat completion
p95 <=5s on this T0 reference, at least 50 samples per route with a held authenticated
WS, compared to idle baseline. Mixed load: 2 chat streams + 1 voice + 1 ingestion.
Queue overload must respond 503/429 with Retry-After within 1 second. Disconnect and
slow-client storm: 100 attempts, return process/FD counts to baseline after 10-second
cleanup (allow only documented persistent workers). Actual voice p95 <800ms remains
the separate Phase 3 gate; these responsiveness bounds do not weaken it.
