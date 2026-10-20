# ADR0091: B2 shell candidate measurements and provisional recommendation

Date: 2026-10-20. Status: PROVISIONAL — owner review required before any
shell is selected for M2. Rust and source CI gates must be green at the
exact head that includes these results; hosted CI receipt to be added after push.

## Context

B2 experiments built three hello-world shells in an isolated Cargo workspace
under `docs/design/experiments/shells/`. No Jan code was copied. No candidate
is approved for shipping. The workspace is excluded from the product dependency
tree. Binaries are built to `~/.cache/sanctum-shell-lab-target` outside the repo.

Candidates:
- **tauri**: Tauri 2 framework (MIT/Apache-2.0; MPL-2.0 via CSS crates, see ADR0090)
- **wry**: direct wry+tao (MIT/Apache-2.0; MPL-2.0 via option-ext/dirs, see ADR0090)
- **browser**: tray + xdg-open / ShellExecute launcher; opens the OS default browser

## Measurement harness

Harness: `docs/design/experiments/measure_shells.py` using psutil 7.2.2.
Protocol per ADR0086: processes started fresh per run with OS caches intact;
2-second stabilisation after SANCTUM_LAB_READY marker; 20-second idle sample.
RSS is the kernel-reported resident set; shared pages are double-counted in
the tree sum.

Runs: **3 per candidate per platform** — the B2 plan required 5; this shortfall
is recorded as a limitation. Runs 4 and 5 cannot be repeated in this session:
cargo is absent from Windows PATH; WSL2 X display is limited for GUI candidates.
Hosted CI does not run GUI measurement jobs. These three-run medians are
provisional; the five-run protocol remains the standard.

## Metric definitions

| Column | Definition |
|---|---|
| shell-only RSS | root process only (root_rss_bytes) |
| tree RSS | sum of root + all descendants at idle sample |
| 2-frame ready | monotonic seconds from process start to SANCTUM_LAB_READY |
| CPU % | fraction of one core busy during 20 s idle sample |
| binary | release-build ELF/PE on disk |

## Linux / WSL2 measurements

Platform: Linux 6.6.87.2-microsoft-standard-WSL2, glibc 2.35.
WebView: webkit2gtk (system package, not bundled).
Browser candidate opened Epiphany (WSL2 default); xdg-open dispatches to
whatever default is configured — tree RSS is highly environment-dependent.

| Candidate | shell-only RSS | tree RSS | 2-frame s | CPU % | binary |
|---|---|---|---|---|---|
| tauri (run1, 3 runs) | 184 MB | 474 MB | 1.48 s | 0.05% | 3,498,248 B |
| wry (run2, 3 runs) | 186 MB | 469 MB | 1.48 s | 0.05% | 705,576 B |
| browser (run1, 3 runs) | 26 MB launcher-only | 694 MB with Epiphany | 4.16 s | 0.0% | 799,344 B |

Browser launcher: the 26 MB is the launcher process only and is not the total
desktop cost. The user's browser adds 469 MB+ regardless. Run 1 took 9.97 s
(Epiphany cold start); runs 2-3 took 4.0-4.2 s (warm). Tree RSS spread was
302 MB across three runs — highly variable and environment-specific.

webkit2gtk system requirement: webkit2gtk >= 2.40 must be installed by the OS
package manager. It is not bundled. Offline installs on minimal Linux systems
may require additional packages.

## Windows 11 measurements

Platform: Windows 11 10.0.26300. WebView: Microsoft Edge WebView2 runtime
(msedgewebview2.exe; pre-installed on Windows 11 via Windows Update).
Binaries cross-compiled from WSL2; native MSVC build required for M2.

| Candidate | shell-only RSS | tree RSS | 2-frame s | CPU % | binary |
|---|---|---|---|---|---|
| tauri (run1, 3 runs) | 30 MB | 374 MB | 0.68 s | 2.06% | 3,235,840 B |
| wry (run1, 3 runs) | 26 MB | 362 MB | 0.67 s | 1.38% | 613,888 B |
| browser (Windows) | not measured | not measured | not measured | not measured | — |

Browser launcher on Windows: ShellExecute-based; not measured this session.
Launcher-only RSS would be under 30 MB but total cost depends on existing
browser state and cannot be honestly bounded.

WebView2 runtime notes:
- Windows 11 ships WebView2 via Windows Update; version varies.
- Machines without it need the evergreen bootstrapper (~2 MB download,
  installs ~100-150 MB runtime) or fixed-version standalone installer (>=170 MB).
- The WebView2 runtime is governed by Microsoft's software license terms;
  redistribution requires the bootstrapper, not bundling runtime files.
- WebView2Loader.dll from webview2-com-sys 0.39.1 (matching Microsoft.Web.WebView2
  1.0.3800.47) is BSD-3-clause; SHA256
  86545b66cdb0603bc26b626fb9ad610cb6e71f28d468f5ea66df23b03dda96d5;
  LICENSE.txt and NOTICE.txt are in docs/licenses/. The loader DLL must be
  distributed alongside the binary; its BSD notice must appear in the
  redistributed notices bundle.
- Idle CPU on Windows (tauri 2.06%, wry 1.38%) exceeds the proposed 1% budget
  from ADR0084. The B7 budget ADR must address this explicitly and it must be
  in REVIEW_QUEUE until resolved.

## Binary size and dependencies

| Candidate | Binary | MPL-2.0 crates in locked graph |
|---|---|---|
| tauri | ~3.2-3.5 MB | cssparser, cssparser-macros, dtoa-short, option-ext, selectors |
| wry | ~0.6-0.7 MB | option-ext (via dirs) |
| browser | ~0.8 MB | option-ext (via dirs/tray) |

Full dependency tree: evals/results/b2-cargo-tree.txt
Full license inventory: evals/results/b2-source-license-inventory.json

MPL-2.0 status: no MPL crate is admitted to the product graph. ADR0090
proposes a file-level allowlist mechanism. ADR0090 is PROVISIONAL; owner
approval is required before any MPL dependency enters the product.

Installer size: no installer was built in B2. A wry binary (~0.6 MB) plus
WebView2 loader DLL (~0.4 MB) yields under 2 MB for the Rust artifact, but
the installer must include notices, WebView2 prerequisites, and will exceed
5-10 MB. Size is not claimed until measured.

## Optional data points not collected

Jan reference measurement: deferred. Jan 0.5.x/0.6.x uses Electron/Chromium;
idle RSS expected 300-600 MB per published reports, not measured here.
If collected, would be labelled b2-jan-reference-*.

Native Rust GUI (egui/iced): not built this session. egui (MIT) and iced (MIT)
are permissive-licensed. Accessibility is limited (no AT-SPI/NSAccessibility in
wgpu backends as of 2026). Markdown/code rendering requires a custom widget.
Would require a separate spike experiment.

## Provisional recommendation

wry is the recommended candidate for B3/B4 experiments, subject to:

1. MPL-2.0 policy approval (ADR0090): option-ext via dirs is MPL-2.0. No wry
   build enters the product until ADR0090 is approved or dirs is replaced with
   a hand-rolled MIT/Apache-2.0 data-dir helper (which would eliminate MPL
   exposure entirely).
2. WebView2 on Windows: disclosed to the user at install time; bootstrapper
   included in offline installer.
3. Run count: extend to >=5 runs per candidate on a stable display server
   before final recommendation.
4. Idle CPU: Windows wry ~1.4% median exceeds ADR0084 proposal. B7 must set
   an honest ceiling; this stays in REVIEW_QUEUE until resolved.
5. webkit2gtk on Linux: must be declared as a system prerequisite in the
   installer.

Tauri's footprint is essentially identical to wry's (same WebView backend)
but its binary is 5x larger and adds more MPL-2.0-exposed crates.

The browser launcher is not a viable primary shell: total footprint is
environment-dependent and cannot be bounded; readiness takes 4-10 s cold;
the user's browser state is uncontrolled; and a proper native window/tray
would require rebuilding the WebView shell anyway.

## Evidence files

| File | Contents |
|---|---|
| evals/results/b2-linux-tauri-run1/measurements.json | Linux Tauri, 3 runs |
| evals/results/b2-linux-wry-run1/measurements.json | Linux wry, partial first attempt |
| evals/results/b2-linux-wry-run2/measurements.json | Linux wry, 3 representative runs |
| evals/results/b2-linux-browser-run1/measurements.json | Linux browser, 3 runs |
| evals/results/b2-windows-tauri-run1/measurements.json | Windows Tauri, 3 runs |
| evals/results/b2-windows-wry-run1/measurements.json | Windows wry, 3 runs |
| evals/results/b2-linux-build-first-failure.log | First build failure (preserved) |
| evals/results/b2-license-gate-first.log | First license gate rejection (preserved) |
| evals/results/b2-cargo-tree.txt | Full dependency tree |
| evals/results/b2-source-license-inventory.json | Full source license inventory |
| docs/licenses/WebView2-1.0.3800.47-LICENSE.txt | WebView2 loader BSD license |
| docs/licenses/WebView2-1.0.3800.47-NOTICE.txt | WebView2 loader NOTICE |

All failed runs are preserved as named evidence. No measurement was discarded
or substituted. PASS_MEASUREMENT_ONLY means the harness completed; it does not
certify egress containment, accessibility, or production quality.

## Notes on native Windows build

Binaries measured on Windows were cross-compiled from WSL2 and copied to
.sanctum/shell-lab-windows/. A native MSVC build using windows-latest hosted
CI is required for M2. This is not a measurement limitation (same WebView2
runtime regardless of compiler) but is a gap for production builds.

## REVIEW_QUEUE entries

- ADR0090 MPL policy: owner approval required before any MPL crate enters
  the product graph.
- ADR0091 shell recommendation: wry provisionally recommended; owner must
  confirm before M2 restructuring begins.
- Idle CPU budget: Windows wry 1.38% median exceeds the 1% ADR0084 proposal;
  B7 must set an honest ceiling.
- 5-run protocol: only 3 runs collected; extend when display server and
  Windows build toolchain are available.
