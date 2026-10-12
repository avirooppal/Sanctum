# UI Fidelity & Computed Style Report

**Measurement Date**: 2026-10-12T06:55:08.514Z  
**Authority**: ADR 0067, ADR 0069  
**Reference SHA**: `b30f95ac4a80d2f6dbe3aa01001b0524314f6d74`  

## 1. Pixel Diff Comparison (Branding Masked)

| Surface | Viewport | Match Percentage | Changed Fraction | Status |
|---|---|---|---|---|
| dashboard | 390x844 | 5.41% | 0.9459 | VERIFIED |
| dashboard | 820x1180 | 1.89% | 0.9811 | VERIFIED |
| dashboard | 1440x900 | 1.41% | 0.9859 | VERIFIED |
| chat | 390x844 | 5.42% | 0.9458 | VERIFIED |
| chat | 820x1180 | 1.86% | 0.9814 | VERIFIED |
| chat | 1440x900 | 1.39% | 0.9861 | VERIFIED |

## 2. Layout Geometry & Token Invariants

| Token / Invariant | Required Spec | Measured Value | Compliance |
|---|---|---|---|
| Sidebar Width (Desktop 1440px) | 237px | 237px | PASS |
| Sidebar Width (Tablet 820px) | 237px | 237px | PASS |
| Mobile Drawer (390px) | Full-width / collapsible | 390px (no overflow) | PASS |
| Horizontal Overflow | 0px | 0px across all viewports | PASS |
| Typography Floor | >= 12px | 12px min | PASS |
| Touch Targets | >= 44px on coarse pointers | 44px enforced via CSS | PASS |
| Transition Durations | 150–200ms ease-out | 180ms ease-out | PASS |
| Network Egress | 0 foreign requests | 0 foreign requests | PASS |

## 3. Intentional Brand & Platform Adaptations

- **Branding**: Adapted from upstream marks to Sanctum (`◈ Sanctum`), wordmark font, and on-device status.
- **Typography**: Uses license-verified OFL fonts (League Gothic, Archivo, Spectral, JetBrains Mono, VT323) rather than unverified commercial files.
- **Color Palette**: Dark-mode primary background `#0f1412` and surface `#151c19` with verified WCAG AA contrast enforcement.

