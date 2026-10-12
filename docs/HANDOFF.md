# Sanctum Handoff

## 1. What Sanctum Is
Sanctum is an on-device, single-owner private AI platform running models, RAG, speech recognition, dictation, and assistant sessions entirely on local hardware or within the owner's private network. Zero telemetry, zero unreviewed cloud connectors, and default-deny egress are strictly enforced.

## 2. In-Progress Architecture & UI Workspace
Active implementation is on branch `ui-workspace` under ADR 0069 exact specification:
- **Public Website (`/website.html`)**: Marketing and architecture overview, responsive, dependency-free, zero foreign requests.
- **Documentation Site (`/docs.html`)**: Offline documentation covering architecture, kernel containment, API contracts, and quality gates.
- **Browser Chat UI (`/`)**: 237px navigation sidebar, 640px dock floor, SafeMarkdown renderer (XSS-safe, code blocks, remote image blocking), slash commands, model badge, session history.
- **Platform Dashboard**: Currently a modal monitor; being migrated to routed pages (`/dashboard/*`) under ADR 0069 S12.
- **Reference Launcher (ADR 0065)**: Upstream reference environment built and verified; lockfile hashes recorded (`evals/results/reference-lockfile-hashes.json`) and 6 multi-viewport screenshots captured (`evals/results/reference-screenshots/`).
- **Fidelity & Invariants (ADR 0067 / 0069)**: Invariant checks currently automated via `evals/browser_fidelity.mjs`; pixel-diff fidelity vs upstream screenshots tracked under S0/S13.

## 3. How to Run & Verify
```bash
# 1. Clean source gate (WSL/Linux dev venv, PYTHONPATH cleanly unset)
bash tools/run_source_gate.sh

# 2. Rust foundation checks & containment probes
bash tools/check_rust.sh

# 3. Web test suite, typecheck, build & audit
npm test --prefix apps/web
npm run build --prefix apps/web
npm audit --prefix apps/web

# 4. Packaging scripts (provisional; release verification pending)
bash tools/package_linux.sh
powershell -ExecutionPolicy Bypass -File tools/sanctum_windows.ps1 -Package
```

## 4. Current Verification & Gates
- **Source Gates**: 157 passing tests, Ruff linting, formatting, license review.
- **Rust Foundation Gates**: 62 passing tests, Clippy `-D warnings`, 92 crate licenses, 38 kernel denial probes, supervision zero survivors.
- **Web Gates**: 51 unit tests passing, 2 font metric tests passing, TypeScript clean, `npm audit` 0 vulnerabilities.
- **Hosted CI**: 100% green on `main` across all 5 hosted jobs (Ubuntu, macOS, Windows source gates, Rust foundation, Web).
- **Distributable Artifacts**: Packaging scripts exist in `tools/`; final release bundle verification and clean-environment install timings remain pending Phase 6.
