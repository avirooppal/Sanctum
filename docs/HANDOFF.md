# Sanctum Handoff

## 1. What Sanctum Is
Sanctum is an on-device, single-owner private AI platform running models, RAG, speech recognition, dictation, and assistant sessions entirely on local hardware or within the owner's private network. Zero telemetry, zero unreviewed cloud connectors, and default-deny egress are strictly enforced.

## 2. Completed Architecture & UI Port
All surfaces adapted to Sanctum with truthful platform status and open-license assets:
- **Public Website (`/website.html`)**: Marketing and architecture overview, responsive, dependency-free, zero foreign requests.
- **Documentation Site (`/docs.html`)**: Offline documentation covering architecture, kernel containment, API contracts, and quality gates.
- **Browser Chat UI (`/`)**: 237px navigation sidebar, 640px dock floor, SafeMarkdown renderer (XSS-safe, code blocks, remote image blocking), slash commands (`/help`, `/clear`, `/stop`, `/info`), model selection badge, session history (search, rename, atomic delete).
- **Platform Dashboard (`/healthz`)**: Local runtime health monitor, daemon isolation status, engine dispatch queue lane counters, and privacy invariants.
- **Reference Launcher (ADR 0065)**: Pinned upstream reference launcher running with `--network none` in container, with mock Electron bridge and mock gateway fixtures for visual fidelity comparison.
- **Fidelity & Egress Verification (ADR 0067)**: Headless browser automation (`evals/browser_fidelity.mjs`) asserting 237px sidebar geometry, zero overflow at 390px, and zero external network/WebSocket egress across all screens.

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

# 4. Packaging
bash tools/package_linux.sh
powershell -ExecutionPolicy Bypass -File tools/sanctum_windows.ps1 -Package
```

## 4. Current Verification & Gates
- **Source Gates**: 157 passing tests, Ruff linting, formatting, license review.
- **Rust Foundation Gates**: 62 passing tests, Clippy `-D warnings`, 92 crate licenses, 38 kernel denial probes, supervision zero survivors.
- **Web Gates**: 44 unit tests passing, 2 font metric tests passing, TypeScript clean, `npm audit` 0 vulnerabilities.
- **Hosted CI**: 100% green on `main` and `ui-hermes-port` across all 5 hosted jobs (Ubuntu, macOS, Windows source gates, Rust foundation, Web).
- **Distributable Artifacts**:
  - Linux: `dist/sanctum-linux-x86_64.tar.gz` (SHA256: `6a71eb3e997141b0797a21c49d2d2330b6ece03b35479343c531130877e6936e`)
  - Windows: `dist/sanctum-windows-x64.zip` (SHA256: `5b00d9b4d0aa3ec4fdd82191cfa7e55347801f34ac4abb756fbb70ede097f401`)
