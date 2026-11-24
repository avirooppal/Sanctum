# Sanctum — Registry-Driven Feature Inventory

Sanctum is a strictly local, private AI workspace and agent harness for Windows. This document is generated directly from `feature_registry.json`; every active feature is backed by automated tests.

## Known Limits (Stated Plainly)
- Windows-only (.NET Framework 4.7.2, WebView2, Named Pipes, DPAPI, Job Objects).
- Agent & tool reliability depends on local model quality (measured per model via 40-task eval suite).
- workspace_only does NOT OS-sandbox approved run_command shell commands; confinement relies on PowerShell AST evaluation, explicit approval, Job Object memory/process caps, and stripped secret env vars.
- A2UI Rich Replies are Experimental (Off by default; Auto requires >= 70% measured validity on this machine).
- Browser agent pack is optional, off by default, and measured only on a 12-task static benchmark.

## Feature Registry

| ID | Feature | Status | UI / API Entry Point | Proving Test(s) |
|---|---|---|---|---|
| `FEAT-LOCAL-PROVIDERS` | Strictly local model providers (Ollama, loopback OpenAI-compatible, Mock) | **verified** | Header Model Pill (JanModelHeaderPill) | `tests/phase1_local_providers.test.ts` |
| `FEAT-CLOUD-REMOVED` | Cloud LLM providers (Anthropic, OpenAI, Gemini, OpenRouter) | **removed** | Removed (migrated on startup with one-time notice) | `tests/phase1_local_providers.test.ts`, `tests/phase1_cloud_migration.test.ts` |
| `FEAT-EGRESS-FACTORY` | Host-level EgressHttpFactory (deny-by-default allowlist) | **verified** | Settings -> Network activity | `tests/phase1_egress_factory.test.ts` |
| `FEAT-EGRESS-LEDGER-OFFLINE` | Append-only redacted egress ledger & global Offline mode switch | **verified** | Settings -> Network activity | `tests/phase1_egress_ledger_and_offline.test.ts`, `tests/phase1_offline_proof.test.ts` |
| `FEAT-SHELL-AST-CONFINEMENT` | PowerShell AST command evaluator, Job Object limits & secret env stripping | **verified** | Tool Approval Modal / CLI TTY | `tests/phase2_shell_confinement.test.ts` |
| `FEAT-WORKSPACE-TRUST` | Content-hashed workspace trust for .sanctum/*, AGENTS.md, hooks & MCP | **verified** | Trusted channel (/v1/workspace/trust) | `tests/phase2_workspace_trust.test.ts` |
| `FEAT-MEMORY-PROVENANCE` | Host memory store with provenance, untrusted-context save gate & Memory Editor | **verified** | Settings -> Memory | `tests/phase2_memory_poisoning.test.ts` |
| `FEAT-TRUSTED-CHANNEL-AUDIT` | Single-enforcement-point trusted channel & call-bound single-use approvals | **verified** | Named Pipe / Native WebMessageReceived | `tests/phase2_trusted_channel_audit.test.ts` |
| `FEAT-DATA-AT-REST` | Optional DPAPI (CurrentUser) & PBKDF2-AES-256-HMAC portable archives + full erase-all | **verified** | /v1/security/encryption, /v1/export, /v1/erase-all | `tests/phase2_data_at_rest.test.ts` |
| `FEAT-UPDATER-SIGNING` | Manual-only updater with pinned RSA-2048 signature, SHA-256, downgrade refusal & Authenticode build step | **verified** | Settings -> General -> Check for updates | `tests/phase2_updater_and_signing.test.ts` |
| `FEAT-EXPLICIT-NUM-CTX` | Explicit per-session Ollama num_ctx & pre-truncation auto-compaction | **verified** | Chat session context (/v1/sessions/:id/context) | `tests/phase3_context_window.test.ts` |
| `FEAT-ONE-CHAT-PATH` | Unified harness chat path across UI, CLI, and HTTP API | **verified** | ChatScreen / CLI run / /v1/sessions | `tests/phase3_one_chat_path.test.ts` |
| `FEAT-MODEL-TIERS` | Model-adaptive capability tiers (minimal / standard / full) & JSON repair | **verified** | /v1/capabilities/:model & /v1/sessions/:id/tier | `tests/phase3_model_tiers.test.ts` |
| `FEAT-MODEL-EVAL-40` | 40-task per-model tool & agent eval suite with measured UI badge | **verified** | Header Model Pill (measured reliability badge) | `tests/phase3_model_eval_suite.test.ts` |
| `FEAT-THINKING-CONTROLS` | Capability-gated thinking parameter forwarding to Ollama | **verified** | Chat composer thinking toggle | `tests/phase3_thinking_controls.test.ts` |
| `FEAT-A2UI-RICH-REPLIES` | A2UI v0.9.1 Rich Replies (render_ui tool, native React 19 catalog, ErrorBoundary & Markdown fallback) | **experimental** | Chat assistant reply ('Agent-generated UI' frame; Off by default) | `tests/phase3b_a2ui_host.test.ts`, `tests/phase3b_a2ui_ui_and_model.test.ts` |
| `FEAT-SHADOW-GIT-CHECKPOINTS` | Shadow-git workspace checkpoints & full rewind (outside user repo) | **verified** | Checkpoint drawer / /v1/sessions/:id/rewind | `tests/phase4_shadow_git_checkpoints.test.ts` |
| `FEAT-PROJECT-VERIFIER` | Real project verification command discovery (package.json, pyproject, Cargo, dotnet, Makefile) | **verified** | /v1/sessions/:id/verify | `tests/phase4_verifier_plan_subagents.test.ts` |
| `FEAT-PLAN-MODE` | Editable PLAN.md artifact & plan checklist verification | **verified** | Composer Auto/Plan toggle & /v1/sessions/:id/plan | `tests/phase4_verifier_plan_subagents.test.ts` |
| `FEAT-WORKTREES-SUBAGENTS` | Git worktrees with orphan cleanup on startup & subagent permission ceilings | **partial** | /v1/worktrees & /v1/sessions/:id/subagents | `tests/phase4_verifier_plan_subagents.test.ts`, `tests/phase3_context_and_agents.test.ts` |
| `FEAT-SCHEDULER` | Fail-closed unattended scheduler with expiry, autonomy ceiling & markdown reports | **verified** | /v1/schedules | `tests/phase4_scheduler_and_web_tools.test.ts` |
| `FEAT-WEB-TOOLS-OPTIN` | Isolated opt-in web_fetch & web_search (off by default, Offline-blocked, untrusted-wrapped) | **experimental** | Settings -> Network activity (Web fetch / search toggle) | `tests/phase4_scheduler_and_web_tools.test.ts` |
| `FEAT-BROWSER-AGENT-PACK` | Optional browser-use pack (off by default, 12-task static benchmark, Offline-aware) | **experimental** | Browser Agent viewer tab | `tests/phase2_browser_agent.test.ts` |
| `FEAT-RAG-HYBRID-VERSIONED` | Local Hybrid RAG with embedding/chunk versioning, hash incremental re-index, untrusted citations & recall@3 | **verified** | Chat document attachments / Vault | `tests/phase5_rag_versioning_and_recall.test.ts`, `tests/vector_store_rag.test.ts` |
| `FEAT-SPEECH-OCR-LOCAL` | Local-only Speech (Qwen3-ASR / Windows Offline) & OCR (Windows / PaddleOCR-VL) with pack integrity check | **verified** | Settings -> Capabilities & Chat mic/upload | `tests/phase5_speech_ocr_local_only.test.ts` |
| `FEAT-WORKSPACES` | Isolated switchable Workspaces with canonical root validation, host-layer data isolation, attention inbox, CLI & reversible migration | **verified** | Sidebar Workspace Switcher (Ctrl+Shift+W) / SearchDialog (Ctrl+K) / CLI workspaces | `tests/part_a1_workspace_registry_and_migration.test.ts`, `tests/part_a2_workspace_isolation.test.ts`, `tests/part_a3_attention_transfer_cli.test.ts`, `tests/part_a4_workspace_ui.test.ts`, `tests/part_a5_scale_and_log_hygiene.test.ts` |
