# UI Deviations Log

Per ADR 0096, all UI elements, layout, components, tokens, typography, and copy are copied exactly from Jan (`janhq/jan` at commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`). Only the following strictly unavoidable differences are permitted, and each is documented here.

---

## Permitted Deviations

| # | Category | Upstream Behavior | Sanctum Behavior | Justification | Evidence / Status |
|---|---|---|---|---|---|
| 1 | **Brand & Marks** | Shows "Jan", Jan logomark, Hamster mascot images | Replaced with "Sanctum" text and neutral geometric mark | Apache-2.0 §6 expressly denies trademark grants | Clean plain mark; no brand assets copied |
| 2 | **Telemetry & Third-Party Egress** | PostHog telemetry in `useAnalytics`, auto-updater (`tauri-plugin-updater`), crash reporting | Completely stripped. Zero telemetry calls; strict same-origin CSP | Sanctum core privacy contract: zero unexpected WAN egress | Verified by egress test and secret scan |
| 3 | **First-Launch Auto-Download** | Automatically starts downloading default model without prompting user | Prompts user with an explicit consent dialog naming host and byte size before any download begins | Consent-for-network rule; offline import remains first-class | Dialog matches upstream modal style |
| 4 | **Native/Tauri Bridge** | Invokes Tauri v2 native commands directly via `@tauri-apps/api` | Handled via compatibility adapter mapping to Sanctum's gateway core and shell | Enables running in both standalone desktop shell and web preview without changing UI code | Passing mock-free integration tests |
| 5 | **Model Hub Downloads** | Downloads models directly over public WAN | Downloads routed through egress broker with ledger record | Every external fetch must be ledger-logged | Egress ledger test |
| 6 | **Privacy / Assurance** | No assurance indicator in upstream app | Proposed minimal placement in Settings > Privacy, pending owner sign-off. Until approved, no assurance claim is shown | Owner rule: no made-up or unverified assurance badges | Documented proposal only; no badge added to core UI |
| 7 | **Security Hardening** | Standard Markdown rendering | Sanitized Markdown rendering (blocks `javascript:`, dangerous iframe/script tags) | Attack surface reduction | Passing XSS/sanitization test suite |
