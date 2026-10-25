# ADR0094: B7 measured desktop performance budgets and CI enforcement

Date: 2026-10-20. Status: PROVISIONAL — owner review required.
Builds on ADR0084 (pivot), ADR0086 (A1 baseline), ADR0091 (B2 shell measurements), and ADR0092 (B3 UI measurements).

## Context

The initial pivot amendment (ADR0084) suggested preliminary target proposals:
- Installer < 80 MiB
- Idle RSS < 200 MiB
- Cold start < 2.0 s
- Initial UI JS < 300,000 gzip bytes
- Idle CPU < 1% of one core

Real empirical measurements from B2 (`docs/adr/0091-b2-shell-candidate-measurements.md`) and B3 (`docs/adr/0092-b3-ui-stack-candidates.md`) demonstrated that:
1. **One single idle RSS number is dishonest**:
   - The native Rust gateway/core without WebView consumes only **26.8 MB** median RSS (A1 baseline).
   - Any modern system WebView (WebKit2GTK on Linux, Edge WebView2 on Windows) spawns multi-process rendering, GPU, and network sandboxes that add 300–450 MB of memory.
   - Total process tree RSS sits at **362 MB** (Windows 11) and **469 MB** (Linux WSL2). Claiming "under 200 MB" while running a WebView is physically impossible on either platform.
2. **Model-loaded memory is dominated by weights**:
   - Loading a 7B Q4_K_M model requires ~4.4 GB of RAM/VRAM.
   - Model memory is dictated by tensor weights and context KV caches, not application overhead.
3. **Idle CPU on Windows exceeds 1%**:
   - Windows WebView2 process tree sits at **1.38%** median idle CPU due to compositor polling.

## Measured Performance Budgets (Milestone 2 & Milestone 3)

The following distinct, enforceable budgets are established from real session measurements:

| Metric | Enforced Ceiling | Measured Baseline | Platform / Scope | Status vs ADR0084 Proposal |
|---|---|---|---|---|
| **Core Gateway RSS (no model)** | **50 MiB** | 26.8 MiB | Linux/Windows Rust gateway | Stricter (26.8 MB << 200 MB) |
| **Full Process Tree RSS (no model)** | **500 MiB** | 362 MiB (Win) / 469 MiB (Linux) | Entire shell + WebView + gateway tree | **Looser** than 200 MiB guidance (REVIEW_QUEUE) |
| **Cold Launch to Usable UI** | **2.50 s** | 0.67 s (Win) / 1.48 s (Linux) | 5-run cold process start to ready signal | Bounded headroom over 2.0 s proposal |
| **Initial UI JS (Gzip Level 9)** | **50 KiB** (Preact target) / **100 KiB** (hard gate) | 6.86 KiB (Preact) / 58.4 KiB (React) | All initial chunks; excluding lazy modules | Stricter than 300 KiB proposal |
| **Core Installer Size (no models/packs)** | **25 MiB** | ~1.5 MiB (binaries + DLL) / <15 MiB package | Excludes GGUF models and optional packs | Stricter than 80 MiB proposal |
| **Idle CPU (Process Tree)** | **2.0%** of one core | 1.38% (Win) / 0.05% (Linux) | 60s sample after 20s settling | **Looser** than 1.0% proposal (REVIEW_QUEUE) |

## Model Memory Disclosure

When a model is loaded, Sanctum Desktop does not make a "lightweight" claim. The UI must explicitly report:
- Active model weight bytes in VRAM / RAM
- KV context cache allocation bytes
- Total system RAM utilization percentage
- A low-memory warning when total system RAM headroom drops below 1.5 GB.

## CI Enforcement Plan

Milestone 2 implements automated CI regression gates:
1. `tools/check_desktop_budgets.py`:
   - Asserts gateway standalone RSS <= 50 MiB on Linux and Windows runners.
   - Asserts built UI gzipped JS <= 100 KiB.
   - Asserts built installer binary size <= 25 MiB.
2. In release regression jobs:
   - Run 5 cold launches; fail if max exceeds 2.50 s.
   - Measure 20-second idle CPU and tree RSS; fail if CPU > 2.0% or RSS > 500 MiB.
3. Fail-closed: If any measurement cannot be collected, CI fails; missing metrics are not treated as zero.

## REVIEW_QUEUE entries

- **Full Process Tree RSS Budget (500 MiB)**: Looser than earlier 200 MiB informal guidance. Justified by empirical evidence: Edge WebView2 requires ~336 MB and WebKit2GTK requires ~283 MB of baseline infrastructure. Owner review required.
- **Idle CPU Ceiling (2.0%)**: Looser than earlier 1.0% proposal. Justified by measured Windows WebView2 1.38% compositor idle baseline. Owner review required.
