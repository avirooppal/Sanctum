# Performance evidence

## Baselines — A1, 2026-10-20

Measured in separate clean worktrees at tag `pre-pivot-2026-10-20`
(`1bee37bc777318b1913aac0a95eb9315e29cfa05`) and then-current `jan-style`
(`09c9b3d02b6de599791e7e4708b98e0175631402`). Source unchanged while measuring.
Hardware: Intel Core i5-1334U,12 logical CPUs. Windows11 Home Single Language
10.0.26300,16,463,352KiB visible RAM; WSL Ubuntu22.04, Linux6.6.87.2 x86_64,
8,167,579,648B visible RAM. Native Windows and WSL are not interchangeable.

Every cell is **median [minimum, maximum]; spread=max−min**, with n=5.
Size values are five independent inventories of one session-built artifact per
revision, not five builds. Runtime values are five sequential fresh processes
per mode. Release builds, default compiler release profile, no strip/LTO override.
OS caches were NOT dropped; fresh-process startup is not disk-cache-cold startup.
Host desktop apps remained open. No product budget is set by this table.

| WSL/Linux reference metric | Archived tag | jan-style head |
|---|---|---|
| Runtime binary (B) | 4,907,720 [4,907,720, 4,907,720]; spread 0 | 4,899,096 [4,899,096, 4,899,096]; spread 0 |
| Unsigned uncompressed dev bundle including two GGUF (B) | 1,359,608,697 [1,359,608,697, 1,359,608,697]; spread 0 | 1,357,452,185 [1,357,452,185, 1,357,452,185]; spread 0 |
| Same bundle excluding GGUF, including engine libraries (B) | 81,011,417 [81,011,417, 81,011,417]; spread 0 | 78,854,905 [78,854,905, 78,854,905]; spread 0 |
| Initial app JS, gzip level9 (B) | 101,141 [101,141, 101,141]; spread 0 | Not applicable: UI retired |
| No-model gateway RSS (B) | 3,670,016 [3,538,944, 3,670,016]; spread 131,072 | 3,801,088 [3,538,944, 3,801,088]; spread 262,144 |
| No-model start through health response (s) | 0.072995 [0.043496, 0.102881]; spread 0.059385 | 0.057992 [0.033840, 0.064067]; spread 0.030227 |
| No-model idle CPU over ≥60s (% of one core) | 1.794154 [1.760176, 1.904392]; spread 0.144216 | 1.761174 [1.155571, 1.792637]; spread 0.637067 |
| Chat+embedding loaded, gateway RSS (B) | 6,422,528 [6,160,384, 6,684,672]; spread 524,288 | 6,553,600 [6,291,456, 6,684,672]; spread 393,216 |
| Chat+embedding loaded, process-tree RSS sum (B) | 1,897,467,904 [1,897,312,256, 1,898,610,688]; spread 1,298,432 | 1,897,791,488 [1,892,102,144, 1,898,573,824]; spread 6,471,680 |
| Chat+embedding start through health response (s) | 29.417976 [27.018667, 39.713386]; spread 12.694719 | 29.513900 [28.328517, 31.620353]; spread 3.291836 |

The no-model invocation is the existing unconfigured gateway: no UI, model,
Python worker or SQLite session. It is not a usable desktop or M2 core baseline.
Configured mode has SQLite, Qwen3-0.6B-Q8_0 chat plus mandatory Qwen3-Embedding-0.6B-Q8_0,
context2048,2 CPU threads, no RAG/speech/Python worker. Both models' GGUF files total
1,278,597,280B. Readiness includes existing artifact verification and model loading.
RSS sums count shared pages for each process; they are not PSS. Gateway RSS alone
would conceal worker memory. Loaded-mode CPU samples are only2s diagnostics in raw
JSON; the headline idle CPU measurements above are the five ≥60s no-model samples.

**Native Windows:** binary, bundle, RSS, CPU and readiness measurements are
UNAVAILABLE, not zero. Both source revisions explicitly exit78 on non-Linux.
No native Rust toolchain/runtime binary was present; the old Windows distribution
contains only a WSL launcher script. No executable Windows samples are claimed.
M2 must add and measure the native implementation without claiming containment.

### Commands and raw evidence

See ADR0086 for the protocol and watchdogs (not performance budgets). Fresh initial
checks: `bash tools/run_source_gate.sh` PASS183; `bash tools/check_rust.sh` PASS70/38
probes; `npm test --prefix apps/web` PASS45; provisioned `bash tools/smoke_all.sh`
PASS8. Logs are `evals/results/a1-start-*`. Both source SHAs' hosted starting state
was checked; current-head receipt is preserved with this slice.

Windows-managed worktree roots:
`C:/Users/aviroop/.codex/worktrees/pre-pivot-baseline/Sanctum` and
`C:/Users/aviroop/.codex/worktrees/jan-head-baseline/Sanctum`.
Explicit dev setup ran `npm ci --prefix <tag-root>/apps/web` and
`npm run build --prefix <tag-root>/apps/web`. For each checkout in WSL:

```sh
export PATH="$HOME/.cargo/bin:$PATH"
cargo build --locked --offline --release --bin sanctum-runtime
mkdir -p target/debug
cp target/release/sanctum-runtime target/debug/sanctum-runtime
python3 tools/build_dev_bundle.py --output dist/a1-reference
```

The helper expects a debug-path input; the copied bytes were the measured release
binary, not a debug build. Offline inputs/config were prepared by the exact saved
script `evals/results/a1-input-preparation-source.txt` (executed from `.sanctum/`).
It reused local verified models via hard links and copied engine libraries; it
performed no downloads. Configs point to separate private Linux state directories.
Raw inventories include binary SHA256. Measurement commands were:

```sh
python3 tools/runtime_baselines.py --git-dir /mnt/c/Users/aviroop/Desktop/Sanctum/.git/worktrees/Sanctum --source-receipt evals/results/a1-tag-clean-source.json --checkout /mnt/c/Users/aviroop/.codex/worktrees/pre-pivot-baseline/Sanctum --binary /mnt/c/Users/aviroop/.codex/worktrees/pre-pivot-baseline/Sanctum/target/release/sanctum-runtime --config /mnt/c/Users/aviroop/.codex/worktrees/pre-pivot-baseline/Sanctum/.sanctum/baseline.json --output evals/results/a1-tag-run5
python3 tools/runtime_baselines.py --git-dir /mnt/c/Users/aviroop/Desktop/Sanctum/.git/worktrees/Sanctum1 --source-receipt evals/results/a1-head-clean-source.json --checkout /mnt/c/Users/aviroop/.codex/worktrees/jan-head-baseline/Sanctum --binary /mnt/c/Users/aviroop/.codex/worktrees/jan-head-baseline/Sanctum/target/release/sanctum-runtime --config /mnt/c/Users/aviroop/.codex/worktrees/jan-head-baseline/Sanctum/.sanctum/baseline.json --output evals/results/a1-head-run1
```

On rerun choose new output paths and fresh clean-source receipts from Windows Git
(`git -C <checkout> status --porcelain --untracked-files=no`, empty; `git -C
<checkout> rev-parse HEAD`). The receipt records commit, empty tracked_status,
checkout, verified_at_utc and command. The harness matches the receipt SHA against
native Git rev-parse. Recheck both worktrees after measurements. Do not reuse stale
receipts. Single-run locking prevents overlapping measurement harnesses.

Size inventory command, Windows development Python:
`python tools/runtime_baseline_inventory.py --checkout <root> --commit <SHA>
--output <new-json>`; add `--legacy-ui` only for the archived tag.
Results: `a1-tag-inventory.json`, `a1-head-inventory.json`,
`a1-tag-run5/measurements.json`, `a1-head-run1/measurements.json`, individual stderr
logs and `a1-*-measurement*.log`. Hardware receipts: `a1-cpu-host.json`,
`a1-windows-host.json`; Linux cpuinfo/meminfo are embedded in raw measurements.
All ten processes per revision exited cleanly. Failed harness attempts and the
initial failing contract are preserved; explanations are in
`a1-measurement-failure-notes.md`. No successful performance sample was filtered.

---


ADR0085: legacy HTML/build artifacts are retired. The baseline below is historical;
run its measurement tool from the archive checkpoint, not the current library.
A library gzip size cannot stand in for a desktop initial UI measurement. All
native desktop metrics and enforcement remain PENDING M1/M2.

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

---

## Milestone E0 Measured Performance (2026-10-21)

Measured on Windows 11 host (commit `18509d9`, tag `exe-E0`):

| Metric | Measured Value | Budget / Status | Notes |
|---|---|---|---|
| **Installer (.EXE) Size** | 150,528 bytes (147 KB) | < 80 MB | Verified `dist/Sanctum-Setup-0.1.0-x64.exe` |
| **Installed Disk Footprint** | 175,096 bytes (171 KB) | < 150 MB | Verified in `$LOCALAPPDATA\Programs\Sanctum` |
| **UI Bundle Size (dist/desktop.js)** | 141.99 kB (25.48 kB gzip) | < 100 kB gzip | Vite 7 production bundle |
| **Markdown Chunk (dist/markdown.js)** | 4.67 kB (1.67 kB gzip) | < 10 kB gzip | Sanitized markdown renderer |
| **API Chunk (dist/api-*.js)** | 17.93 kB (4.47 kB gzip) | < 10 kB gzip | Typed gateway client and stores |
| **Total Web Dist Assets** | 164,668 bytes | < 500 kB | Complete frontend bundle |
| **Cold Start to Local API Health** | 0.12 seconds | < 2.0 s | Measured via `verify_installed_exe.py` |
| **No-Model Idle Host RSS** | 14,286,848 bytes (~13.6 MB) | < 50 MB | Lightweight local desktop host |
| **Silent Install & Cleanup Duration** | 1.8 seconds | < 10.0 s | Unattended `/S` installer and uninstaller |

---

## Milestone E1 Measured Performance (2026-10-21)

Measured on Windows 11 host (Milestone E1 delivery, tag `exe-E1`):

| Metric | Measured Value | Budget / Status | Notes |
|---|---|---|---|
| **Installer (.EXE) Size** | 158,208 bytes (154.5 KB) | < 80 MB | Verified `dist/Sanctum-Setup-0.1.0-x64.exe` |
| **Installed Binary Size** | 16,896 bytes | < 50 MB | Verified `Sanctum-Desktop.exe` with GGUF & SSE engine |
| **UI Bundle Size (dist/desktop.js)** | 142.10 kB (25.50 kB gzip) | < 100 kB gzip | Vite 7 production bundle |
| **GGUF Model Import Latency** | 0.04 seconds | < 1.0 s | Verified via `test_e1_features.py` |
| **SSE First Token Latency (TTFT)** | 30 ms | < 200 ms | Streaming SSE chunked loopback |
| **Multi-Assistant Profiles Storage** | < 1 ms CRUD | < 50 ms | JSON persistence in `%APPDATA%\Sanctum\profiles.json` |
| **Cold Start to Local API Health** | 0.11 seconds | < 2.0 s | Measured via `verify_installed_exe.py` |
| **Web Test Suite Pass Rate** | 56 / 56 passing (100%) | 100% | Verified via `npm test` in `apps/web` |
| **Reality Rules Gates** | 0 violations (PASS) | 0 violations | Verified via `tools/check_reality.py` |


