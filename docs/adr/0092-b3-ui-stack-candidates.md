# ADR0092: B3 UI stack candidate evaluation

Date: 2026-10-20. Status: PROVISIONAL — measurements attached; Preact 10 provisionally recommended; owner review required before M3.
Builds on ADR0091 (wry shell provisional recommendation).

## Context

B3 experiments build the same chat-screen skeleton in React 19 and at least one
lighter candidate (Preact or Solid) to compare gzipped bundle size, dependency
count and license profile, npm audit results, and runtime memory in the chosen
shell's WebView. The skeleton must include: thread list, streaming message list,
composer, settings drawer.

This ADR defines the scope and acceptance criteria. The actual build and
measurement results are recorded in evals/results/b3-* when collected.
This ADR is PROVISIONAL until measurements are attached and owner reviews.

## Dependency license gate

All npm packages in the B3 graph must pass the product license gate:
- Permissive only: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, ISC, Unlicense
- MPL-2.0: requires ADR0090 individual review per package (none admitted by default)
- GPL/AGPL-only: excluded
- Proprietary: excluded
Run `npm audit` and record the output as b3-audit.log. Zero high/critical
vulnerabilities required.

## Candidates

### React 19

License: MIT. Core react + react-dom ~140 KB gzip with a real bundler.
Already used in the web layer (apps/web); known to the codebase.
Dependencies: react, react-dom, a bundler (vite/rollup, MIT). Optionally
react-router for routing (MIT). Avoid creating new transitive dependencies
beyond the minimum skeleton.

### Preact (signal-based)

License: MIT. Preact 10 + preact/signals. Core gzip < 5 KB.
Compatible JSX. Drop-in for React in most cases via preact/compat.
Dependency footprint much smaller than React.

### Solid (optional if license and dep tree pass)

License: MIT. SolidJS 1.x. No virtual DOM; compiled component model.
Gzip similar to Preact at < 10 KB. Good streaming/fine-grained reactivity.
If admitted: verify all transitive deps pass the license gate first.

### Svelte (deferred)

Svelte 5 is MIT but its compiled output has changed significantly. Include only
if Preact and Solid measurements are insufficient and Svelte's compiled
dependency tree passes the license gate. Do not include by default.

## Measured results

Measurements collected using `docs/design/experiments/ui/measure_ui.mjs` on 2026-10-20.

| Metric | React 19 | Preact 10 | Delta (React / Preact) |
|---|---|---|---|
| Raw JS bundle | 189,176 bytes (184.7 KB) | 16,542 bytes (16.2 KB) | 11.4x |
| Gzip JS bundle (level 9) | 59,792 bytes (58.4 KB) | 6,859 bytes (6.7 KB) | 8.72x |
| Production dependencies | 2 (react, react-dom) | 1 (preact) | 1 fewer package |
| Locked graph dependencies | 115 packages | 136 packages | +21 in dev tooling |
| License profile | MIT | MIT | Both 100% permissive |
| npm audit vulnerabilities | 0 | 0 | Both clean |
| Build time (Vite 7) | 3.64 s | 0.75 s | 4.8x faster |

Evidence files:
- `evals/results/b3-react-bundle.json`
- `evals/results/b3-preact-bundle.json`
- `evals/results/b3-comparison.json`

## Provisional recommendation

**Preact 10 is provisionally recommended** for the Sanctum Desktop M3 UI layer:
1. **Bundle size**: 6.86 KB gzip vs 59.93 KB gzip (8.72x smaller). Leaves maximum headroom within the proposed 300 KB gzip initial JS budget (ADR 0084).
2. **Standard JSX & React-compatible API**: Uses standard JSX and compatible hook semantics (`useState`, `useEffect`) without virtual DOM bloat.
3. **Clean audit & license**: MIT license, 0 vulnerabilities in `npm audit`.
4. **Fast build**: Builds in under 1 second.

React 19 remains an admissible fallback if complex external ecosystem components require deep React-specific internals.

## REVIEW_QUEUE entry

- B3 UI stack recommendation: Preact 10 provisionally recommended over React 19 based on 8.7x smaller bundle size (6.86 KB vs 59.93 KB gzip).
- PROVISIONAL: owner review required before M3 implementation.

