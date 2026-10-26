# ADR 0101: Windows Executable Resource and Verification Thresholds

- **Status**: ACCEPTED
- **Date**: 2026-10-25
- **Builds on**: ADR 0091 (shell candidates), ADR 0093 (core contracts), ADR 0094 (measured performance budgets), ADR 0100 (installer pipeline)

## 1. Context

To build and verify the standalone native Windows x64 executable and installer (`Sanctum-Setup-1.0.0-x64.exe`), objective, enforceable numeric thresholds must be set prior to running verification suites. Under standing rules, thresholds cannot be retroactively loosened without an ADR and a REVIEW_QUEUE entry.

## 2. Resource Budgets & Leak Ceilings (Section 3 Scenarios)

| Scenario / Check | Metric | Pre-set Threshold Ceiling | Return-to-Baseline Tolerance | Reference ADR |
|---|---|---|---|---|
| **1. Idle Soak** (30 min short / 8 h long) | Steady-state private bytes slope | **< 2.0 MB / hour** (95% CI) | N/A (steady state) | ADR 0094 |
| **1. Idle Soak** | Process tree RSS | **< 100 MB** (host) / **< 500 MB** (with WebView2) | N/A | ADR 0094 |
| **1. Idle Soak** | Idle CPU (after settling) | **< 2.0%** of one core | N/A | ADR 0094 |
| **1. Idle Soak** | Handle growth | **< 5 handles / hour** | N/A | ADR 0101 |
| **2. Chat Soak** (SSE streaming loops) | Private bytes slope | **< 5.0 MB / hour** | Within **10 MB** of post-warmup baseline | ADR 0094, ADR 0101 |
| **2. Chat Soak** | JS Heap in WebView | Detached DOM nodes **= 0**; listener growth **= 0** | Within **5 MB** of baseline | ADR 0101 |
| **3. Model Load/Unload** (20 short / 200 long) | Memory after unload | Full return to baseline | **± 15 MB** RSS tolerance; 0 leaked VRAM | ADR 0101 |
| **3. Model Load/Unload** | Orphan worker processes | **0 orphan processes** | Exactly 0 | ADR 0093 |
| **4. Thread Lifecycle** (1,000 threads) | SQLite / store query latency | **< 25 ms** p95 latency | Database size proportional to records | ADR 0088, ADR 0101 |
| **5. Navigation Loops** (500 short / 5,000 long) | Memory delta after loops | Slope **< 1.0 MB / 1,000 iterations** | Within **5 MB** of baseline | ADR 0101 |
| **6. Download Cycles** (pause/resume/cancel) | Leaked handles / sockets / temp files | **0 leaked sockets, 0 partial files** | Sockets return to 0 open | ADR 0093, ADR 0101 |
| **7. Attachments/RAG/Speech Cycles** | Memory slope during ingestion | **< 10 MB / 100 chunks** | Return to baseline within **15 MB** | ADR 0094, ADR 0101 |
| **8. Window Lifecycle** (DPI/resize/minimize) | GDI / USER object leaks | Growth slope **= 0** | Exact baseline return (± 2 objects) | ADR 0101 |
| **9. Crash & Restart Loops** (100 kills) | Orphan processes / Stale locks | **0 orphan processes; 0 stale locks** | Port 1337-1400 unbound upon kill | ADR 0093 |
| **9. Crash & Restart Loops** | Database integrity | `PRAGMA integrity_check` = `ok` | 100% data consistency | ADR 0093, ADR 0101 |
| **10. Fault Injection** (disk/mem/lock) | Error handling | Safe failure; zero unhandled crash | Crash dump / log contains zero secrets | ADR 0093, ADR 0101 |

## 3. Downloads & Egress Budgets (Section 4)

- **Consent Dialog**: 100% required before any network connection; names exact target host.
- **Host Allowlist**: Strictly enforced. Redirects to non-allowlisted domains rejected immediately.
- **TLS Verification**: Enforced. Zero bypass flags allowed.
- **Resumability**: HTTP Range headers supported; survives process restart.
- **Integrity**: SHA-256 hash verified against catalog; corrupt downloads rejected and purged from disk.
- **Disk Reserve**: Abort download if free disk space is less than download size + 500 MB reserve margin.
- **Atomic Finalization**: Download to `.part` temporary file; atomic rename upon full SHA-256 match.

## 4. Performance & Start Budgets (Section 7)

- **Cold Launch to Interactive UI**: **< 2.50 s** (ADR 0094 budget).
- **Time to First Token (TTFT)** (local SSE): **< 200 ms** (Milestone E1 budget).
- **Core Installer Size**: **< 25 MB** (no embedded weights; ADR 0094 budget).
- **Installed Disk Footprint**: **< 150 MB** (ADR 0094 budget).
- **Initial UI JS (Gzip Level 9)**: **< 100 KiB** (ADR 0094 hard ceiling).

## 5. Security & Containment Budgets (Section 6)

- **Network Listeners**: 100% Loopback only (`127.0.0.1` / `::1`). Non-loopback listening sockets: **0**.
- **Outbound Network on First Launch (without user consent)**: Exactly **0 bytes**.
- **Secret Leaks**: Exactly **0 plaintext secrets/tokens** in logs, dump files, or registry.
- **Vulnerabilities**: `npm audit` production vulnerabilities: **0**.
