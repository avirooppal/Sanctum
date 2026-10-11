# ADR 0067: UI Design Fidelity Verification and Invariants

## Context
The user requested that Sanctum's web and chat UI surfaces replicate the layout, structure, responsive behavior, tokens, and visual system of the upstream reference interface (adapted with Sanctum branding, local model status, and on-device features).
To prevent subjective claims of fidelity ("it looks good"), we define objective, programmatically measurable criteria for:
1. Geometry & Layout tokens: 237px navigation sidebar width, minimum 640px mobile breakpoint, typography minimums (12px minimum body floor, 0.7 minimum text opacity).
2. Zero egress invariants: Zero foreign HTTP requests, zero remote WebSockets, zero telemetry/analytics calls, zero remote fonts or remote image loads across website, dashboard, chat, and speech panels.
3. Contrast & accessibility: WCAG AA compliant contrast ratios for foreground and secondary text tokens across all 16 built-in theme presets.
4. Client bundle limits: Production client bundle size under bounded thresholds (under 300KB JS gzipped).

## Decision
- Enforce layout geometry invariants via headless browser evaluations (`evals/browser_fidelity.mjs`) and unit test assertions.
- Verify zero network egress on all 4 surfaces: website (`/website.html`), chat (`/`), knowledge (`/v1/workspaces`), and dashboard (`/healthz`).
- Any network request whose origin differs from loopback `127.0.0.1` immediately fails verification.

## Status
Accepted.
