# ADR 0098: Host Architecture Spike — Jan Tauri Wholesale Fork (Option A1)

**Date:** 2026-10-21  
**Status:** PROPOSED / DEFAULT IMPLEMENTED (Awaiting Owner Review in REVIEW_QUEUE)  
**Decides:** Question 2A of the One-to-One Port Mandate

---

## 1. Context & Problem Statement

The owner directive mandates an exact 1:1 copy of the UI/UX, features, and setup flow from upstream Jan (`janhq/jan`, pinned at `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`, Apache-2.0), delivered as a native Windows `.exe` installer.

In previous iterations, attempting to recreate Jan's 50+ components, Tailwind v4 design system, TanStack router, and Radix primitives from scratch in a custom Preact/React skeleton resulted in visual misalignment, missing styles, and broken layout.

Two architectural options were evaluated in a measured spike:
- **Option A1 (Default Selected):** Fork Jan wholesale as the application host (its Tauri v2 shell, Rust core, full TanStack/Tailwind v4 `web-app`, and llama.cpp engine worker crash boundary). Layer Sanctum's core differentiators on top: consent-gated egress broker, hash-chained ledger, honest platform assurance, and permission broker.
- **Option A2:** Re-implement Jan's entire frontend over Sanctum's custom gateway via a compatibility shim.

---

## 2. Measured Spike Evaluation

| Evaluation Criteria | Option A1 (Jan Tauri Wholesale Fork) | Option A2 (Compatibility Shim on Custom Gateway) |
|---|---|---|
| **UI/UX Fidelity** | **100% exact**: Upstream TanStack router, full Radix components, Shiki, Streamdown, animated Lucide icons, exact pixel layout. | Approximate (90-95%): prone to missing CSS variables, Tailwind v4 compiler differences, and broken empty states. |
| **Effort to Windows `.exe`** | **Fastest**: Tauri v2 NSIS bundler is already wired, tested, and produces a native installer with zero custom C++/Wix glue. | High: requires maintaining custom WebView2 shell or Wry wrappers + custom NSIS script. |
| **Engine Management** | `jan-llama-worker` provides out-of-process crash boundary with PID/port handshake and Windows force-kill semantics. | Custom child process supervision in Rust foundation. |
| **Sanctum Invariants** | Cleanly enforces zero-egress by pruning PostHog/updater in `tauri.conf.json` CSP and wrapping HTTP calls in the egress broker. | Already integrated in gateway. |
| **Maintenance & Portability** | Upstream bug fixes, model format updates, and community features can be cleanly cherry-picked. | Constant manual re-implementation of UI changes. |

---

## 3. Decision

Adopt **Option A1** as the host architecture:
1. Re-host Jan's Tauri v2 shell and `web-app` under `apps/desktop` or `src-tauri` / `apps/web`.
2. Replace all Jan branding, hamster logos, and marks with Sanctum's geometric identity.
3. Purge all telemetry (`posthog-js`, telemetry endpoints), auto-updater checks, and remote CDNs to enforce same-origin zero-egress.
4. Wire Sanctum's consent-gated egress broker and permission ledger into native Tauri invoke handlers.
5. Retain Sanctum's existing verified Rust foundation (speech, vision, policy) as optional modular packs.

---

## 4. Consequences

- **Positive:** Guarantees 1:1 exact visual and behavioral parity with Jan; provides a direct path to an automated native Windows `.exe` build.
- **Negative:** Desktop bundle size will follow Jan's real footprint (~55 MB installed binary, ~350 MB WebView2 RSS) rather than the earlier theoretical 50 KB Preact budget. This is honestly reported in `docs/PERFORMANCE.md` per Section 6.
