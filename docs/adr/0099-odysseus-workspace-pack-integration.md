# ADR 0099: Odysseus Workspace Pack Integration Strategy (Option B)

**Date:** 2026-10-21  
**Status:** PROPOSED / DEFAULT IMPLEMENTED (Awaiting Owner Review in REVIEW_QUEUE)  
**Decides:** Question 2B of the One-to-One Port Mandate

---

## 1. Context & Problem Statement

The owner directive requires incorporating Odysseus (`odysseus-dev/odysseus`, pinned at `8877273e195a90d51bc6a37f3a1b60dc3414c431`, AGPL-3.0-or-later) into Sanctum without inventing bespoke UI or redesigning upstream workflows.

Odysseus is a rich Python application (`app.py`, FastAPI/Starlette) with static web frontend templates, personal documents editor, tasks, calendar, deep research, and agents.

Two approaches for integration were evaluated:
- **Option B1 (Default Selected - Workspace Pack):** Run Odysseus as a supervised background child process with an embedded Python runtime, serving on loopback (`127.0.0.1:<port>`), opened within the Sanctum window via a dedicated sidebar navigation entry ("Workspace").
- **Option B2 (Global Design Restyle):** Attempt to rewrite Odysseus's frontend to match Jan's React component tree and CSS design tokens.

---

## 2. Comparison & Rationale

| Dimension | Option B1 (Supervised Workspace Pack) | Option B2 (Re-write Odysseus UI in Jan Tokens) |
|---|---|---|
| **Upstream Fidelity** | **100% exact copy**: Preserves all 24+ features (Notes, Tasks, Calendar, Documents, Cookbook, Deep Research, Gallery) exactly as designed upstream. | Unfaithful: requires inventing new layouts, compromises complex tool UIs, high risk of regression. |
| **Invention Policy** | **Zero invention**: Upstream templates and flows run unmodified. | Violates owner mandate ("any global restyle counts as invention and needs owner approval"). |
| **Process Isolation** | Clear crash and security boundary: runs in its own supervised worker process with strict loopback binding. | Monolithic risk: complex Python dependencies intertwined with Node/Tauri host. |
| **Engine Unification** | Simple: Odysseus points its model endpoint to Sanctum's local OpenAI-compatible server (`http://127.0.0.1:1337/v1`), so one llama.cpp engine serves both. | Complex: duplicate state management. |

---

## 3. Decision

Adopt **Option B1**:
1. Package Odysseus as an optional, supervised "Workspace Pack" (`packs/workspace`).
2. Single-User Auto-Login: Configure Odysseus environment to authenticate the local desktop owner automatically with zero visible password/admin prompt.
3. Unified Data Directory: Store Odysseus databases and notes inside Sanctum's central user data folder (`%APPDATA%/Sanctum/workspace`).
4. Unified Engine: Wire Odysseus's default LLM provider directly to the host's OpenAI server (`http://127.0.0.1:1337/v1`).
5. Egress & Untrusted Content: All external tool actions (email, web search) pass through Sanctum's permission broker.

---

## 4. Measured Budgets & Verification

- **Cold Start:** Supervised spawn < 2.5s.
- **Idle RSS:** Bound to < 180 MB for the Python worker.
- **License Gate:** Gated on `docs/LICENSE_DECISION.md` approval before bundling source code.
