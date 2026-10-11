# ADR 0062: Composer cancellation and wrap-up evidence

The existing adapter accepts an AbortSignal but the composer did not expose Stop.
Use one owned ChatRun per mounted composer and a native Stop generation button.
Abort propagates through fetch to the existing gateway disconnect context. Suppress
late deltas; refuse overlapping starts; never retry automatically. Partial text is
memory-only unless the gateway completed its existing persistence path. This slice
does not add undo or change server deadlines, cancellation bounds, or persistence.

The browser test first waited for response headers and missed the short completed
generation before clicking. Preserve that failure. Observe request initiation
instead and assert requestfailed, visible stopped state, no retry, then a real
successful next Send. This verifies browser cancellation, not engine-slot release
or p95 latency. No existing threshold or timeout changes; Step 0 gates remain.

The user requires WRAPUP.md and status archives verbatim. Disable Git newline
normalization for these two exact paths and verify committed bytes by SHA256.
This follows ADR0042's evidence-preservation rule, with no code lint exception.
Initial documentation commit normalized CRLF; the follow-up restores exact source
bytes. No measurements are rewritten. The first editing helper used Windows'
default encoding and failed before editing main.tsx; explicit UTF-8 fixes the
helper. Tests and real execution are rerun after the successful edit.
