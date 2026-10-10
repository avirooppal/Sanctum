# ADR 0038: Warm every persistent workload before comparing retained resources

Accepted 2026-10-10, before rerun. The first allocator/execution run passed chat
and embedding slow-reader/overload resource comparisons, then failed after Knowledge
cancellations: embedding RSS 931460 -> 1085324KiB (+153864KiB). The harness baseline
had warmed only short six-token direct embedding inputs, despite subsequently
adding large structure-aware document ingestion cancellations. Its baseline omitted
that workload. Retained model working buffers may depend on input shape; this is
a hypothesis to test, not proof that the increase is harmless.

Warm exactly one complete representative Knowledge ingestion before the baseline:
same 100-section document generator as the cancellation suite, numeric index 49
(the largest case in the 50-sample suite). Warm direct chat/embedding at the existing
concurrency four, then quiesce ten seconds. No warming until a plateau or repeating
the failing storm to inflate baseline. Keep every storm, sample count, per-process
+16MiB RSS, +2 threads, exact FD/socket/process and ten-second recovery limits.
Preserve the prior failed result. If the corrected baseline still grows, fix the
product; do not relax the allowance.

The complete ingestion warmup exceeded the harness client's incidental 60-second
read wait and failed before a baseline was recorded. Explicit setup exception:
allow 240 seconds for this one warmup ingestion, inside the existing 300-second
worker and 330-second caller bounds. Do not change any measured storm/cancellation
or lane latency threshold. Restart the reference runtime before the corrected run
so prior failed warmup cannot inflate its baseline. Preserve the timeout log.
