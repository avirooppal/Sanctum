# Sanctum Handoff

## 1. What Sanctum Is
Sanctum is an on-device, single-owner private AI platform running models, RAG, speech recognition, dictation, and assistant sessions entirely on local hardware or within the owner's private network. Zero telemetry, zero unreviewed cloud connectors, and default-deny egress are strictly enforced.

## 2. UI Workspace (Branch: `ui-workspace`)
Implemented under ADR 0069 exact specification, all 14 slices (S0–S13) are committed:
- **S0**: Reference environment built with lockfile hashes and 6 screenshots.
- **S1**: Design docs (BRIEF.md, TOKENS.md, COMPONENTS.md, FLOWS.md, MICROCOPY.md, 9 wireframes).
- **S2**: Token schema audit and primitives layer.
- **S3**: PanelRegistry, capability endpoint (`/v1/capabilities`), layout engine with 4 presets, shell.
- **S4**: Sidebar with pin/unpin backend and server-side full-text search.
- **S5**: Tab rail and Quad mode with admission-limit waiting states.
- **S6**: Chat view, composer, attachments, dictation, context usage bar.
- **S7**: Right rail with Artifacts (Files/Code, Links) and Knowledge tree.
- **S8**: Status bar (healthz, offline badge, background jobs, model picker, context bar).
- **S9–S10**: Settings overlay (appearance, layouts, shortcuts, profiles, data management), Full Purge.
- **S11**: Command palette (Ctrl/Cmd+K) and SetupWizard onboarding.
- **S12**: Dashboard as routed pages (`#/dashboard/*`), website and docs reskinned.
- **S13**: 25 named Playwright E2E tests (all PASS), fidelity measurement, quality gates.

## 3. How to Run & Verify
```bash
# 1. Clean source gate (WSL/Linux dev venv, PYTHONPATH cleanly unset)
bash tools/run_source_gate.sh

# 2. Rust foundation checks & containment probes
bash tools/check_rust.sh

# 3. Web test suite, typecheck, build & audit
npm test --prefix apps/web          # 73 tests (71 unit + 2 font metric)
npm run typecheck --prefix apps/web # TypeScript strict
npm run build --prefix apps/web     # Production bundle
npm audit --audit-level=low --prefix apps/web  # 0 vulnerabilities

# 4. E2E Playwright suite (requires Playwright, built dist, and gateway or mock server)
node evals/browser_e2e_suite.mjs [token-file] [output-file]
```

## 4. Current Verification & Gates
- **Source Gates**: 157 passing tests, Ruff linting, formatting, license review.
- **Rust Foundation Gates**: 62 passing tests, Clippy `-D warnings`, 92 crate licenses, 38 kernel denial probes, supervision zero survivors.
- **Web Gates**: 73 unit tests passing, TypeScript clean, production build, `npm audit` 0 vulnerabilities.
- **E2E Browser Gates**: 25 named Playwright tests covering all A1–A11 specifications with zero foreign egress (browser-e2e-25.json).
- **Hosted CI**: merge commit `064a1c4` on `main` all 5 jobs PASS (run 38216308897); branch `ui-workspace` commit `2e990bb` also passed (run 38215304239).
- **Fidelity**: Supplementary invariant checks (ADR 0067) measured, not upstream pixel-exact match.
- **Bundle**: JS 105.74 kB gzipped, CSS 7.44 kB gzipped (within budget).
- **Outstanding**: Full release gates (R-UI through R-HANDOFF in RELEASE_CHECKLIST.md) remain OPEN. Distributable artifacts, native packages, and clean-environment install timings are pending.

## 5. Architecture Summary
- **30 UI component files** in `apps/web/src/ui/` with typed PanelRegistry, error boundaries, code-splitting.
- **Backend additions**: Session pin/unpin, full-text search, preferences store (migration 0002), capabilities endpoint, assistant profiles CRUD (migration 0004), token usage reporting, Full Purge endpoint.
- **Design system**: 16 themes, 5 OFL fonts, WCAG AA contrast guard, 3 density levels, 8px grid.
- **Data-only customization**: Theme/layout/preference JSON validated against schema, no user CSS/script.

