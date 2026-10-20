# Sanctum Microcopy & Communication Guidelines

This document governs tone of voice, error message formats, empty-state messaging, and truthful privacy disclosures across Sanctum Desktop.

---

## 1. Tone of Voice
- **Plain**: Use direct, everyday language. Avoid gratuitous technical jargon where a clear word suffices.
- **Warm & Respectful**: The user is the sovereign owner of their machine. Be helpful, not patronizing or playful.
- **Specific**: Quantify numbers, states, and operations rather than using generic abstractions (e.g. "Ingesting 14 of 42 documents (33%)" instead of "Processing...").
- **Truthful**: Never over-promise. Be rigorously precise about privacy and security guarantees.

---

## 2. Privacy & Platform Assurance Vocabulary
Sanctum NEVER uses misleading marketing claims such as "100% secure", "unhackable", or "military-grade encryption".

| Context | Forbidden Phrasing | Required Truthful Phrasing |
|---|---|---|
| Platform Security | "100% Secure & Private" | "Verified kernel containment" (Linux) or "Not verified (unconfined host process)" (Windows/macOS) |
| Local Operation | "Cloud-free AI" | "100% local inference on loopback interface" |
| Network Egress | "Safe from eavesdropping" | "Egress broker enabled: external network calls blocked" |
| Memory Fit | "Runs smoothly" | "Estimated VRAM requirement: 4.2 GB / 8.0 GB available" |

---

## 3. Error Message Formula
Every user-facing error message must follow the three-part format:
1. **What happened**: Clear factual statement of the immediate problem.
2. **Why it happened**: Root cause (e.g., missing permissions, memory exhaustion, file not found).
3. **What you can do**: Actionable next step or remediation command.

### Example Formats:
- *Model Load Failure*:
  - **What**: Could not load model `llama-3.2-3b.gguf`.
  - **Why**: Requested context window (8192) requires 4.8 GB RAM, but only 3.1 GB is available.
  - **Action**: Lower the context window slider in Model Settings or close background applications.
- *Engine Disconnection*:
  - **What**: Connection to local inference engine was lost.
  - **Why**: The background worker process terminated unexpectedly.
  - **Action**: Click "Restart Engine" or inspect logs in the diagnostics panel.

---

## 4. Empty-State Copy
Empty states must educate the user and provide an immediate call to action:
- **No Conversations**:
  - *Title*: "Start a conversation"
  - *Description*: "Type a message below or press Ctrl+K to explore commands and settings."
  - *Action*: Focus composer or suggest starter prompt.
- **No Documents Ingested**:
  - *Title*: "Your Knowledge library is empty"
  - *Description*: "Attach a local folder to enable private citation-backed search across your notes and PDFs."
  - *Action*: "Select Folder" button.
- **No Models Installed**:
  - *Title*: "No local models found"
  - *Description*: "Download a recommended model or import an existing GGUF file from your disk."
  - *Action*: "Download Recommended Model" button.

---

## 5. String Table Inventory
All user-facing strings are centralized in `apps/web/src/strings.ts` to support localization and prevent ad-hoc hardcoded strings:
- Navigation labels (`nav_chat`, `nav_models`, `nav_packs`, `nav_settings`).
- Action labels (`action_send`, `action_stop`, `action_new_chat`, `action_export`, `action_import`).
- Assurance badges (`tier_verified_containment`, `tier_not_verified`).
- Dialog prompts (`confirm_purge`, `confirm_delete`).
