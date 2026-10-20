# ADR0086: Repeatable runtime reference baselines

Date: 2026-10-20. Status: adopted for the owner's A1 measurement request.
No product performance budgets are set by this decision.

Measure the pinned pre-pivot tag and the last green jan-style source in separate
clean worktrees. Build each release runtime offline from its locked Cargo inputs.
Build the archived UI during explicit development setup. Assemble the existing
unsigned development bundle, explicitly copying the release binary into the old
helper's debug input path. Include the same chat+embedding GGUF and engine files
in each bundle. Record both total bytes and bytes excluding GGUF. Five size reads
of the same built bytes are deterministic inventories, not five independent builds.

For each revision, launch five fresh unconfigured gateway processes sequentially.
Measure launch through successful health response, settle for two seconds, then
sample gateway RSS and CPU over at least60 seconds. CPU is percentage of one core,
not divided by logical CPU count. Record all samples, median, min, max and spread.
Then launch five configured runtimes with the same chat+embedding models; record
gateway RSS separately from summed process-tree RSS after readiness and settling.
The current configuration requires embedding as well as chat; do not label this
chat-only. RSS sums double-count shared resident pages; they are not PSS.

Fresh-process starts leave OS page caches intact. WSL/Linux is labelled separately
from native Windows. A runtime that refuses Windows startup has no Windows
RSS/CPU/readiness result; missing values are not zero. No Python worker, UI or
SQLite session exists in the unconfigured gateway case, so this is not a desktop
acceptance metric. Host applications remain open; this is not an isolated lab.

## Harness limits and provenance

A240-second ready-record watchdog,5-second health request bound and10-second
shutdown bound keep a broken measurement from hanging indefinitely. These are new
harness safeguards, not relaxed runtime/SLO thresholds. Forced shutdown invalidates
the sample. A single-run advisory lock prevents overlapping harness instances.
Preserve every failed attempt; do not discard a valid completed run for high usage.

Windows-managed worktrees need explicit native Git administrative paths in WSL.
A freshly recorded Windows Git clean-source receipt may substitute for the slow
WSL status scan; the harness must still match its commit to native Git rev-parse.
Keep source unchanged while measuring and recheck clean state afterwards.

Expected contract failure, Git-path/interop errors and aborted overlapping partial
attempts are named A1 evidence. No completed performance sample from those aborted
attempts is discarded. Scripts and commands are documented in PERFORMANCE.md.
