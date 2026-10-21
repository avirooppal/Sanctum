# UI Parity Tracking Table

Central tracking matrix mapping upstream Jan UI screens and controls to Sanctum backend endpoints and automated test IDs.

**Rule:** Every visible control must be backed by a real backend endpoint and a passing test. If an upstream feature does not yet have an active backend contract in Sanctum, it is labeled `PENDING-BACKEND` and hidden from the UI (never shown disabled or mocked).

---

| Upstream Screen / Feature | Upstream Service Calls / State | Sanctum Gateway Endpoint / IPC | Status | Passing Test ID |
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
| **Parameters Drawer: Temperature, top-p, max tokens** | `threads.updateParams` | Thread state / request body params | **ACTIVE** | `reality.test.mjs` |
| **Assistants: Custom profiles list** | `assistants.list` | `GET /v1/profiles` | **ACTIVE** | `phase1-client.test.mjs` |
| **Assistants: Create / Edit / Delete profile** | `assistants.save`, `assistants.delete` | `POST /v1/profiles` | **ACTIVE** | `phase1-client.test.mjs` |
| **MCP Servers: List & status** | `mcp.list` | `GET /api/mcp/servers` | **ACTIVE** | `phase1-client.test.mjs` |
| **MCP Servers: Add / Remove server** | `mcp.add`, `mcp.remove` | `POST /api/mcp/servers` | **ACTIVE** | `phase1-client.test.mjs` |
| **MCP Servers: Tool approval modal** | `mcp.respond` | `POST /api/mcp/calls` | **ACTIVE** | `phase1-client.test.mjs` |
| **Providers: Local API server toggle** | `server.start`, `server.stop`, `server.status` | `GET /api/local-api/status`, `POST /api/local-api/start` | **ACTIVE** | `phase1-client.test.mjs` |
| **Providers: Cloud BYOK keys** | `providers.saveKey`, `providers.removeKey` | `POST /api/providers/key`, `DELETE /api/providers/key` | **ACTIVE** | `phase1-client.test.mjs` |
| **Settings: General & Data folder** | `app.getDataFolder`, `app.reset` | `GET /api/settings`, `POST /v1/purge` | **ACTIVE** | `m2-client.test.mjs` |
| **Settings: Theme / Scale factor** | `settings.get`, `settings.set` | `GET /api/settings`, `POST /api/settings` | **ACTIVE** | `m2-client.test.mjs` |
| **Settings: Hardware info** | `system.hardware` | `GET /api/capability` (`hardware` block) | **ACTIVE** | `m2-client.test.mjs` |
| **Model Hub: Remote HF catalog search** | `models.searchHuggingFace` | Egress broker `/api/egress/models` | `PENDING-BACKEND` | (Hidden until broker wired) |
| **Model Hub: Remote download** | `models.download` | Egress broker with consent dialog | `PENDING-BACKEND` | (Hidden until broker wired) |
| **Settings: Update checker** | `updater.check` | Stripped (ADR 0089/0096) | `REMOVED-BY-OWNER` | `retirement.test.mjs` |
| **Settings: Analytics toggle** | `posthog.optOut` | Stripped (ADR 0089/0096) | `REMOVED-BY-OWNER` | `retirement.test.mjs` |
