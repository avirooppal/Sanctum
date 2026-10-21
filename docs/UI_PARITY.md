# UI Parity Tracking Table: Jan & Odysseus in Sanctum

Central tracking matrix mapping upstream Jan and Odysseus UI screens, controls, and modules to Sanctum backend endpoints, IPC contracts, and automated test IDs.

**Rule:** Every visible control must be backed by a real backend endpoint and a passing test. If an upstream feature does not yet have an active backend contract in Sanctum, it is labeled `PENDING` and hidden from the active UI (never shown disabled or mocked). Removing an upstream feature permanently requires a `REVIEW_QUEUE` entry with owner approval.

---

## 1. Jan Desktop Features

| Upstream Screen / Feature | Upstream Source / Service Calls | Sanctum Implementation / Endpoint | Status | Passing Test ID |
|---|---|---|---|---|
| **Chat View: Main conversation** | `threads.getMessages`, `chat.stream` | `/v1/chat/completions` (streaming SSE) | **ACTIVE** | `chat-run.test.mjs` |
| **Chat View: Stop generation** | `chat.stop` | Client abort signal / `/v1/cancel` | **ACTIVE** | `chat-run.test.mjs` |
| **Sidebar: New Chat** | `threads.create` | `POST /v1/conversations` | **ACTIVE** | `api.test.mjs` |
| **Sidebar: Thread list** | `threads.list` | `GET /v1/sessions` | **ACTIVE** | `api.test.mjs` |
| **Sidebar: Search threads** | Client filter / search | Local search on verified session list | **ACTIVE** | `reality.test.mjs` |
| **Sidebar: Pin thread** | `threads.pin` | `POST /v1/sessions` (`operation: pin`) | **ACTIVE** | `api.test.mjs` |
| **Sidebar: Delete thread** | `threads.delete` | `POST /v1/sessions` (`operation: delete`) | **ACTIVE** | `api.test.mjs` |
| **Model Hub: Installed models list** | `models.list` | `GET /v1/models` | **ACTIVE** | `api.test.mjs` |
| **Model Hub: Local GGUF import** | `models.importGguf` | `POST /api/models/import-gguf` | **ACTIVE** | `phase1-client.test.mjs` |
| **Parameters Drawer: Settings** | `threads.updateParams` | Thread state / request body params | **ACTIVE** | `reality.test.mjs` |
| **Assistants: Profiles list & CRUD** | `assistants.list`, `assistants.save` | `GET /v1/profiles`, `POST /v1/profiles` | **ACTIVE** | `phase1-client.test.mjs` |
| **MCP Servers: List & CRUD** | `mcp.list`, `mcp.add`, `mcp.remove` | `GET /api/mcp/servers`, `POST /api/mcp/servers` | **ACTIVE** | `phase1-client.test.mjs` |
| **MCP Servers: Tool approval modal** | `mcp.respond` | `POST /api/mcp/calls` | **ACTIVE** | `phase1-client.test.mjs` |
| **Providers: Local API server** | `server.start`, `server.stop` | `GET /api/local-api/status`, `POST /api/local-api/start` | **ACTIVE** | `phase1-client.test.mjs` |
| **Providers: Cloud BYOK keys** | `providers.saveKey` | `POST /api/providers/key`, `DELETE /api/providers/key` | **ACTIVE** | `phase1-client.test.mjs` |
| **Settings: General & Data folder** | `app.getDataFolder`, `app.reset` | `GET /api/settings`, `POST /v1/purge` | **ACTIVE** | `m2-client.test.mjs` |
| **Settings: Theme / Scale factor** | `settings.get`, `settings.set` | `GET /api/settings`, `POST /api/settings` | **ACTIVE** | `m2-client.test.mjs` |
| **Settings: Hardware info** | `system.hardware` | `GET /api/capability` (`hardware` block) | **ACTIVE** | `m2-client.test.mjs` |
| **Model Hub: Remote HF catalog search** | `models.searchHuggingFace` | Egress broker `/api/egress/models` | `PENDING` | (Hidden until broker wired) |
| **Model Hub: Remote download** | `models.download` | Egress broker with consent dialog | `PENDING` | (Hidden until broker wired) |
| **Settings: Update checker** | `updater.check` | Stripped (ADR 0089/0096) | `REMOVED-BY-OWNER` | `retirement.test.mjs` |
| **Settings: Analytics toggle** | `posthog.optOut` | Stripped (ADR 0089/0096) | `REMOVED-BY-OWNER` | `retirement.test.mjs` |

---

## 2. Odysseus Workspace Pack Features

| Upstream Feature | Upstream Source Module | Sanctum Implementation / Routing | Status | Passing Test ID / Blocker |
|---|---|---|---|---|
| **Chat with Agents & Tools** | `app.py`, `tool_execution.py` | Workspace Pack loopback `/workspace/agents` | `PENDING` | Gated on Milestone E2 |
| **Cookbook (Hardware recommendations)** | `routes/cookbook.py` | Workspace Pack loopback `/workspace/cookbook` | `PENDING` | Gated on Milestone E2 |
| **Model Compare (Blind side-by-side)** | `routes/compare.py` | Workspace Pack loopback `/workspace/compare` | `PENDING` | Gated on Milestone E2 |
| **Skills & Memory Ledger** | `skill_index.py`, `services/gateway/src/storage.rs` | Gateway CRUD + Workspace Pack | **ACTIVE** | `phase1-client.test.mjs` |
| **Personal Documents Editor** | `src/personal_docs.py` | Workspace Pack loopback `/workspace/documents` | `PENDING` | Gated on Milestone E3 |
| **Notes Management** | `frontend/src/features/notes` | Workspace Pack loopback `/workspace/notes` | `PENDING` | Gated on Milestone E3 |
| **Tasks Manager** | `src/task_endpoint.py` | Workspace Pack loopback `/workspace/tasks` | `PENDING` | Gated on Milestone E3 |
| **Gallery & Image Viewer** | `src/gallery.py` | Workspace Pack loopback `/workspace/gallery` | `PENDING` | Gated on Milestone E3 |
| **File Uploads & Attachments** | `src/upload_handler.py` | Local vault storage + permission broker | `PENDING` | Gated on Milestone E3 |
| **Web Search & Egress Engine** | `src/outbound_fetch.py` | Egress broker allowlist + ledger | `PENDING` | Gated on Milestone E4 |
| **Deep Research Navigator** | `src/research_navigator.py` | Egress broker with step-by-step confirmation | `PENDING` | Gated on Milestone E4 |
| **Email (IMAP / SMTP)** | `src/email_handler.py` | Windows Credential Manager + Egress broker | `PENDING` | Gated on Milestone E4 |
| **Calendar & CalDAV Sync** | `src/calendar_service.py` | Windows Credential Manager + Egress broker | `PENDING` | Gated on Milestone E4 |
| **Scheduled Agent Tasks** | `src/task_scheduler.py` | Supervised background scheduler | `PENDING` | Gated on Milestone E4 |
| **Local 2FA Protection** | `src/two_factor.py` | Hardware key / Windows Hello auth | `PENDING` | Gated on Milestone E4 |
