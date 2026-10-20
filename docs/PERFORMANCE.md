# Performance evidence

## Pre-pivot measurement, 2026-10-20

Source head: `1bee37bc777318b1913aac0a95eb9315e29cfa05`.
Host: Intel Core i5-1334U, 12 logical CPUs; WSL2 Linux 6.6.87.2,
8,167,567,360 bytes visible RAM. These are development measurements, not desktop
release acceptance. Raw host details: `evals/results/pivot-m0-baseline-host.log`.

| Requested metric | Observed result | Scope / limitation |
|---|---|---|
| Initial chat UI JS | 101,141 bytes gzip | Entry script plus modulepreload, level 9; lazy notices excluded and inventoried separately |
| Built web directory | 2,139,977 bytes | All routes/assets, uncompressed, including obsolete public pages |
| Existing Linux archive | 11,437,890 bytes | Existing tar.gz; provenance/install not verified this session |
| Existing Windows archive | 645,275 bytes | Existing zip; not a verified native desktop installer |
| Native installed footprint | UNVERIFIED | No session-built and clean-installed desktop application |
| Desktop idle RSS, no model | UNVERIFIED | No usable no-model desktop process tree exists |
| Desktop cold start to usable UI | UNVERIFIED | Native shell absent; gateway readiness is not usable UI |
| Desktop idle CPU | UNVERIFIED | Browser/WebView and full process-tree measurement absent |

Separate diagnostic: unconfigured **debug gateway only**, no UI, SQLite session,
model or worker. Readiness 0.015699 seconds; RSS 5,898,240 bytes before/after a
10.010498-second idle sample; CPU 1.498427% of one core. No child processes were
observed. This is not a desktop result, and does not satisfy the proposed 1% CPU
ceiling even for this narrower sample. Other development work was active on the
host; this was not a controlled performance acceptance run.

Raw per-file sizes/hashes, archive hashes and process samples:
`evals/results/pivot-m0-baseline-measurements.json`.
The measurement method is reproducible with `tools/measure_pivot_baseline.py`.
Run from the repository root after `npm run build --prefix apps/web`:

```bash
python3 tools/measure_pivot_baseline.py
```

It refuses to overwrite the named baseline output. For another run, use
`--output evals/results/local-pivot-measurements.json`. On Linux it launches and
terminates its own unconfigured `target/debug/sanctum-runtime`; on other systems
it reports the gateway diagnostic unavailable. It does not install artifacts or
measure native UI performance. It needs no Python in the shipped core.

The refactored tool was exercised against the same built assets:
`pivot-m0-measurement-tool-verification.json` again records 101,141 initial gzip
bytes and 2,139,977 web bytes. Its independent debug-gateway sample was
6,029,312 RSS bytes and 2.097033% of one core. The original pre-change measurement
is retained separately; this variation is not averaged away or promoted to a
controlled desktop benchmark. Three contract tests pass; their initial missing-
module failure is preserved in `pivot-m0-measurement-tests-first.log`.

## Budget proposal and next evidence

[ADR0084](adr/0084-pivot-to-jan-style-app.md) proposes 80 MiB installer,
200 MiB full-tree idle RSS, 2-second cold usable UI, 300,000 gzip bytes initial JS
and 1% of one core idle CPU. These are **not implemented CI gates**. M1/M2 must
settle the measurement contract, native shell and per-pack budgets, then enforce
them without reinterpreting missing measurements as passes.

The web build passed but emitted upstream framer-motion `use client` directive
warnings. Baseline logs preserve those warnings. No zero-warning claim is made.
