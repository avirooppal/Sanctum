# ADR 0036: Recover resident inference crashes without replaying work

Accepted 2026-10-10. Resident inference guardians may restart their owned worker
following an unexpected exit, after fully reaping the old group. Request-specific
helpers, speech CLIs and Knowledge workers retain their existing lifecycle. Never
restart on gateway shutdown, and never replay the failed inference request.
Use interruptible 100ms, 500ms, 2000ms backoff, at most three restarts in a rolling
minute; exceeding the budget fails closed. All replacements inherit confinement,
process-group ownership and parent-death handling. Other engine processes remain
untouched. Startup/readiness can take up to the existing 120-second model-loading
bound; new admitted requests wait for a successful bounded health probe before forwarding
once. Readiness GETs have 250ms deadlines and may repeat; generation POSTs never
repeat. Existing request permits bound these waits; cancellation kills the waiting
helper/worker. This is recovery, not zero downtime. If multiple in-flight requests
share the crashed model process, each can fail; independent engines stay untouched.
Record this fault-domain limitation explicitly, not as full continuity.

For the real crash gate, kill the chat worker after observing streamed data, assert
the affected stream cannot complete normally, verify an embedding request still
works, observe a replacement and a subsequent successful chat. Real storm resource
and latency tolerances remain ADR 0031 unchanged.

Resource storms compare each persistent process role after ten seconds quiescence
against a baseline warmed with the same concurrent chat/embedding workloads.
Socket counts mean owned live socket descriptors; kernel TIME_WAIT tombstones are
not process-owned open descriptors. Process role set, FDs and socket descriptors
must return exactly; thread +2 and RSS +16MiB per role remain ADR 0031 limits.

The first real disconnect storm FAILED: chat RSS grew 942100 -> 981908KiB
(+39808KiB), exceeding +16384KiB; process/FD/socket/thread counts were unchanged.
Inspection of the pinned llama-b11429 `--help` inside an egress-denied namespace
showed its default prompt RAM cache is 8192MiB. Disable optional RAM prompt caching
with `--cache-ram 0 --no-cache-prompt` for all resident reference engines. This is
a product memory/privacy policy change, not a threshold adjustment. Fixed model/KV
working memory remains; the unchanged storm gate must pass after this change.

The cache-disabled diagnostic rerun passed chat disconnect resource comparisons,
but embedding slow-reader RSS grew 982292 -> 1038228KiB (+55936KiB). Keep that
failed result. Test glibc worker allocation policy: one arena, 64KiB trim and mmap
thresholds, set only by the resident guardian after clearing the environment.
This limits per-thread heap retention and returns large temporary allocations;
it changes neither model kernels nor the +16MiB gate. Measure again before claiming
that allocator retention was the cause or that the gate passes.

A stronger two-admitted-caller crash test FAILED: queued caller also received 502,
because both POSTs were inside the crashed process. Introduce a shared one-slot
execution lease inside the existing two-request admission bound, across Rust and
Python. Pending callers wait cancellably outside the model process; only the
executing request is forwarded. On crash, pending work waits for replacement
readiness and sends once. This refines fault isolation, not a request retry.

The crash/storage integration extension FAILED: a truncated failed stream was saved
as one completed conversation turn. Preserve `engine-crash-storage-first.json`.
Verify helper successful exit when its pipe reaches EOF; propagate a failed exit
as an I/O error. Mark capture complete only on verified EOF, and save turns only
with that completion flag. Client cancellation/incomplete reads never count as
successful generation. Existing complete conversation behavior stays intact.
