# ADR0076: Runtime-backed dashboard and working profile admission

J9/J11 require actual evidence. Remove unconditional dashboard health,denial,
isolation,hardware,memory and cloud-success defaults. Unknown is not offline
or zero. Reuse the eight-check privacy predicate and safe error taxonomy.
Sequential cancellable metadata avoids admission bursts;retain5s polling and
prevent overlap. No server limit,deadline or quality threshold changes.

Profile writes currently enter bodyless control and return413. Admit them in
the existing metadata/chat lane,retaining64KiB handler bound and all owner
checks. Contract/tests first,then real create/update/list/delete on unique
fixture IDs only. This repairs existing controls,not a new feature.

A separate real transport-abort test exposes the old profiles silent-empty
fallback. Track loading/ready/failed;cancel stale loads;only a successful empty
list may say no definitions exist. Safe error and explicit tab reopening recover
without retrying writes. Keep this failed run as evidence;no timeout change.
