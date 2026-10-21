# ADR 0095 — Feature Roadmap: Jan and Odysseus Parity, Build Order, and What to Skip

Date: 2026-10-21  
Branch: jan-style  
Status: PROVISIONAL — owner review required before implementation of any section begins.

---

## Context

The owner submitted a structured feature recommendation document on 2026-10-21 covering which features
from Jan (`janhq/jan`, Apache-2.0) and Odysseus (`odysseus-dev/odysseus`, AGPL-3.0-or-later) to adopt,
which to defer, and which to skip entirely.

This ADR records those decisions with their constraints. No code is changed here.

---

## License Prerequisite

Odysseus is licensed **AGPL-3.0-or-later**. The owner reports that code reuse is coordinated with
Odysseus maintainers. **No Odysseus code may be copied until a written permission grant naming the
specific files is on file in this repository.** Without it, any copied Odysseus code forces
AGPL-3.0 obligations over the combined work and will fail `tools/web_license_scan.py`.

Jan is Apache-2.0. Clean-room reimplementation from its public documentation remains the standard
approach per ADR0089.

---

## Decisions

### 1 — ADD NOW: Core of a Jan-like App (Priority 1 build)

| # | Feature | Source | Constraint |
|---|---|---|---|
| 1.1 | **Assistants and Projects** | Jan | Owner-scoped (ADR0027); one assistant profile per project; custom instructions, tool settings, model assignment. |
| 1.2 | **Model Hub with Import** | Jan | Local GGUF import is the default. Downloads must be explicit, consent-based, ledger-logged. No auto-download on first launch (unlike Jan). |
| 1.3 | **Hardware-Aware Recommendations ("Recommended for this PC")** | Odysseus (Cookbook) | Real hardware data only (UNVERIFIED on Windows VRAM-absent GPU); fit estimates labeled "estimate" with formula linked. Requires written Odysseus permission before copying any Odysseus code. Clean-room implementation is the default. |
| 1.4 | **Engine Choice and Parameters Drawer** | Jan | llama.cpp (default) and MLX (macOS) backend selection; sampling/load settings in the existing parameter drawer. |
| 1.5 | **Local OpenAI-Compatible API Server** | Jan | Sanctum gateway already covers most. Add: start/stop toggle, port field, API key field, CORS configuration. All values persisted via typed settings schema (ADR0093). |
| 1.6 | **MCP Manager with Argument-Bound Approvals** | Jan / ADR0093 | Per-call approval UI showing exact arguments. Server lifecycle and multi-server orchestration. Builds on permission broker design (ADR0093). |
| 1.7 | **Optional Cloud Providers (Bring-Your-Own-Key)** | Jan | Off by default. Explicit "Cloud" badge per provider. Every request written to the egress ledger. |

### 2 — ADD NEXT: After Core is Real (Priority 2 build)

| # | Feature | Source | Constraint |
|---|---|---|---|
| 2.1 | **Model Compare Arena** | Odysseus | Real dual-stream from actual installed local models. No simulation. Requires backend dual-stream endpoint first. Odysseus AGPL license: clean-room UI only unless written permission is on file. |
| 2.2 | **Memory and Skills** | Odysseus | Skills = plain Markdown instruction files (data only, no code loading). Memory = local editable notes list. No skill code execution without permission-broker approval. |
| 2.3 | **Local-Only Deep Research** | Odysseus | Research over user's own documents first; no network. Web version only after egress broker, web tool, and ledger exist and are tested. |
| 2.4 | **Documents and Knowledge as a Pack** | Sanctum RAG pack | Attach RAG pack to projects with citations. |
| 2.5 | **Presets, Themes, Prompt Library** | Jan | Data-only: JSON presets, CSS theme tokens, markdown prompt templates. |
| 2.6 | **Computer Use** | Custom | Sanctum sandbox-first design. Neither Jan nor Odysseus is a reference. |

### 3 — PROBABLY SKIP

| Feature | Reason |
|---|---|
| Email, calendar (CalDAV), notes, tasks, image gallery and editor, writing document editor | Attack surface (untrusted content + credentials), conflicts with lightweight goal, out of scope. |
| Scheduled agent tasks | Revisit only after permission broker and egress ledger are proven; unattended agents raise risk. |
| Jan's UI extension loading, analytics, Jan Server hosting | MCP is the extension path. ADR0089 already rejected analytics and updater. |
| Docker-first deployment | Desktop installer with real first-run flow is better than docker compose. |

---

## Where Sanctum Should Do Better Than Jan and Odysseus

1. **Honest Privacy Tiers**: Show what the OS actually enforces. Show a ledger of anything that left the machine.
2. **Argument-Bound Approvals**: Tool calls ask for permission with exact arguments shown.
3. **Consent for Every Network Use**: Downloads, cloud models, and web tools each require explicit user action.
4. **Lightweight, With Numbers**: Track bundle size, RAM, and CPU budgets against measured baselines (ADR0094).

---

## Build Order (Owner-Approved Sequence)

```
Phase 1:  Assistants, Projects, and Model Hub with recommendations.
Phase 2:  Local API server and MCP manager.
Phase 3:  Compare, Memory, and Skills.
Phase 4:  Local deep research over the user's own documents.
```

---

## Enforcement Gates Required Before Each Phase

Before **Phase 1** begins:
- [ ] Odysseus written permission grant on file (or confirmed clean-room only)
- [ ] ADR0095 owner-approved

Before **Phase 2** begins:
- [ ] Phase 1 features have real endpoint contracts and passing tests
- [ ] Egress ledger records all cloud provider calls

Before **Phase 3** begins:
- [ ] Dual-stream backend endpoint exists and is tested
- [ ] Permission broker handles per-call skill execution approval

Before **Phase 4** (web version of deep research):
- [ ] Egress broker is tested and proven
- [ ] Web tool exists with ledger entry per URL fetched

---

## Status

PROVISIONAL. The owner must confirm:
1. Written Odysseus permission status.
2. Phase 1 build approved to begin.
3. Any scope additions or removals from the skip list.

Entries in REVIEW_QUEUE.md: see below.
