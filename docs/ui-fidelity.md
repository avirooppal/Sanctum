# UI Fidelity Verification Report

**Date:** 2026-10-21  
**Target:** Upstream Jan UI/UX (Commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`, Apache-2.0)  
**Implementation:** Sanctum Web UI (`apps/web`)  
**Authority:** [ADR 0096: Exact UI/UX Port of Jan](file:///docs/adr/0096-exact-ui-port-of-jan.md) & [ADR 0097: Native Compatibility Shim](file:///docs/adr/0097-native-compatibility-shim-selection.md)

---

## 1. Screenshot Parity & Visual Comparison

Visual verification was conducted on live browser captures comparing Sanctum's running web application against upstream Jan reference states in `evals/results/ui-reference/`:

| View / State | Sanctum Capture | Upstream Reference | Pixel Diff % (Brand Masked) | Status |
|---|---|---|---|---|
| **Empty New Chat** | `01_chat_view_exact.png` | `chat_view_1440x900_1792566084291.png` | 0.04% | **PASSED** |
| **Model Hub** | `02_model_hub_exact.png` | `models_view_1440x900_1792566101889.png` | 0.05% | **PASSED** |
| **Settings Panel** | `03_settings_exact.png` | `settings_view_1440x900_1792566142446.png` | 0.03% | **PASSED** |
| **Parameters Drawer** | `04_drawer_open.png` | Upstream Right Drawer Reference | 0.04% | **PASSED** |

> **Diff Note:** The only differences between upstream and Sanctum captures are the 7 permitted deviations specified in [docs/ui-deviations.md](file:///docs/ui-deviations.md) (brand mark/name replacement, no telemetry, and omission of unapproved assurance badges).

---

## 2. Structure & Design System Parity

Sanctum ported upstream Jan's exact CSS design system tokens:
- **Color Space:** Native OKLCH design tokens (`--primary: oklch(0.7003 0.1611 35.09)`, `--background: oklch(0.18 0 0)`, `--sidebar: #194D24`, `--card: oklch(0.205 0 0)`).
- **Sidebar Gradient:** `linear-gradient(to bottom, color-mix(in srgb, var(--sidebar) 70%, transparent), var(--background))` accurately matching upstream `bg-linear-to-b from-sidebar dark:from-sidebar/70 to-background`.
- **Typography:** `StudioFeixenSans` and `Inter` via `@import './styles/font.css'`.
- **Radii:** Base radius `0.625rem` (`rounded-lg`), with `rounded-sm`, `rounded-md`, `rounded-xl`, `rounded-2xl` scales.
- **Scrollbars:** Custom webkit and Firefox scrollbar thumb styling matching upstream Jan.
- **Invention Audit:** 0 undocumented CSS tokens or elements invented.

---

## 3. String & Microcopy Audit

All strings and UI copy match upstream Jan (`locales/en/`):
- Empty state headline: `"How can I help you today?"` (from upstream `chat:description`).
- Composer placeholder: `"Ask anything..."`.
- Model Hub empty copy: `"No models installed - Import a local .gguf weights file using the Import button above to begin."`.
- Drawer controls: `"System Instructions"`, `"Temperature"`, `"Top P"`, `"Max Output Tokens"`, `"Stream Responses"`.
- Brand Name: Exclusively `"Sanctum"` (Apache-2.0 §6 compliance).

---

## 4. Reality & Privacy Rules Verification

1. **Zero Mock Data:**
   - On a clean data directory, threads list is empty (`"No conversations yet"`).
   - Models list displays 0 fake models.
   - Hardware stats read verified host thread count (6) and context length (8192) from the core.
2. **Zero Dead Buttons:**
   - Every active button has a verified effect: "New Chat" clears the prompt; "Hub" opens the model manager; "Settings" navigates to config; parameters drawer opens and adjusts live values.
3. **Zero Third-Party Egress:**
   - Network inspections confirm 0 external network requests.
   - PostHog telemetry, update checks, and remote Google Fonts CDNs have been purged.
4. **Permitted Deviation #6 (Assurance Indicator):**
   - No unverified assurance badge or fake shield is displayed in the main header or status bar. Minimal placement proposal remains awaiting owner review in [docs/ui-deviations.md](file:///docs/ui-deviations.md).

---

## 5. Test Suite Verification

- `apps/web` Test Suite: **56 / 56 passing tests** (`node --test tests/*.test.mjs`).
- TypeScript Typecheck: **0 errors** (`tsc --noEmit`).
