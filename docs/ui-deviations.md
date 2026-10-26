# UI Deviations Log: Sanctum vs Upstream Jan v0.8.7

This document logs all deviations from upstream Jan v0.8.7 in accordance with MASTER_PROMPT.md, Amendment 1, and ADR 0103.

---

## Deviations Matrix

| ID | Feature / Component | Upstream Jan v0.8.7 Behavior | Sanctum Behavior | Justification / Authority |
|---|---|---|---|---|
| **DEV-01** | Brand name & wordmark | "Jan" displayed in header, About, CLI guide, and window title | "Sanctum" displayed in identical typography and locations | Trademark law (Apache-2.0 §6); Master Prompt Section 3.1 |
| **DEV-02** | Application Icon | Jan Hamster mascot logo | Custom icon generated from owner-supplied `Beta.jpg` | Owner instruction; Master Prompt Section 5 |
| **DEV-03** | First-run engine & embedding downloads | Automatically begins downloading without prompt | Bundles CPU llama.cpp engine; displays explicit consent modal with host & size before initiating network downloads | Privacy & egress guarantee; Master Prompt Section 3.3 |
| **DEV-04** | Automatic update check | Default ON; contacts remote update server | Default OFF; checks only against owner-controlled release channel via consent-gated broker | Standalone privacy; Master Prompt Section 3.4 |
| **DEV-05** | Hub catalog queries | Directly contacts Hugging Face APIs | Displays consent prompt naming `huggingface.co` before first egress; full offline fallback with local models | Consent broker; Master Prompt Section 3.5 |
| **DEV-06** | Cloud BYOK providers | Directly calls OpenAI, Anthropic, etc. | Prompts leave machine only after explicit consent confirmation; credentials in Windows Credential Manager; "Cloud" badge shown on active threads | Privacy hardening; Master Prompt Section 3.6 |
| **DEV-07** | Telemetry & analytics | PostHog telemetry and opt-out switch in Privacy | Completely purged at build time; Privacy tab displays real host assurance tier, live connection ledger, and consent management | Zero unauthorized egress; Master Prompt Section 3.7 |
| **DEV-08** | External documentation links | Opens web browser to `jan.ai` | Opens bundled local offline markdown documentation | Offline operation; Master Prompt Section 3.8 |
| **DEV-09** | Live Request Lifecycle Status | Minimal streaming indicator | Inline phase stepper pill (`RequestStatusLine`) displaying elapsed time, TTFT, tok/s, thinking drawer, and Stop/Retry controls | **Owner-Authorized Addition** (Amendment 1 & ADR 0102) |
| **DEV-10** | Appearance Studio | Pre-set dark/light themes | Fully customizable appearance and token editor | **Owner-Authorized Addition** |
