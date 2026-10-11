# Speech residency probe v1 (developer evaluation only)

Use the pinned upstream Parakeet library, one CPU context, six threads and the
existing 16 kHz mono PCM16 fixture. Load once and decode that recording three
times without freeing the context. Report load duration and RSS, each decode
duration and RSS, peak RSS, transcript and artifact hashes. A failed decode is
a failed experiment, never a latency sample. This is not a resident product worker.

Measure 30 Flite `--version` launches separately from 30 short-text synthesis
launches. Report every sample and p50/p95; version launch is a lower-bound process
startup measurement, synthesis includes voice initialization and generation.
Run inside the existing egress-denied namespace/filter through the owned supervisor.
No new performance threshold and no physical-audio or T1 SLO claim.
