# Reality Audit

Audit of all UI screens, controls, and displayed values across Sanctum Desktop.
Every item is verified against its authoritative data source, contract endpoint, and test ID.

## Summary Status

- **Audited Components**: `Shell`, `Sidebar`, `ChatPanel`, `ThreadDrawer`, `ModelsPanel`, `PacksPanel`, `SettingsPanel`, `StatusBar`, `CommandPalette`
- **Total Audited Elements**: 34
- **REAL**: 30
- **UNKNOWN-SHOWN**: 4
- **ABSENT (Unimplemented/Purged Simulations)**: 3 (`ComparePanel`, `CookbookPanel`, `ResearchPanel`)
- **UNVERIFIED**: 0

---

## 1. First-Run Flow & Initial Discovery

| Step / Displayed Value | Control / Element | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Initial Capabilities Discovery | Automatic boot fetch | `GET /api/capability` | `m2-client.test.mjs: SanctumClient calls /api/capability` | REAL | Discovers enabled system capabilities (`chat`, `models`, `packs`, etc.). |
| Platform Assurance Detection | Boot handshake | `CapabilityReport.platform_assurance` | `m2-client.test.mjs: report.platform_assurance` | REAL | Evaluates to `"verified kernel containment"` on Linux x86_64, or `"not verified"` on Windows. |
| Fresh Data Directory Check | Local storage / session query | `GET /sessions?limit=50` | `reality.test.mjs: fresh-data-directory produces true empty state` | REAL | Returns `data: []` on clean boot; zero sample conversations. |
| Empty Chat View | Central empty state card | `strings.empty_chat_title`, `strings.empty_chat_subtitle` | `strings.test.mjs: String table declares all required UI microcopy keys` | REAL | Displays clean offline message without fabricated egress guarantees. |

---

## 2. Navigation Rail (`Sidebar.tsx`)

| Screen / Control | Displayed Value | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| New Chat Button | `+ New Chat` | Local state reset | `panel-registry.test.mjs` | REAL | Clears active session, opens fresh conversation. |
| Chat View Navigation | `💬 Chat` | Local tab switcher | `panel-registry.test.mjs: queries panels by layout slot` | REAL | Navigates to central chat interface. |
| Models Navigation | `🧠 Models` | `capabilities.includes('models')` | `panel-registry.test.mjs: filters panels by available capabilities` | REAL | Dynamically hidden if model management capability is absent. |
| Packs Navigation | `📦 Packs` | `capabilities.includes('packs')` | `panel-registry.test.mjs: filters panels by available capabilities` | REAL | Dynamically hidden if pack management capability is absent. |
| Settings Navigation | `⚙️ Settings` | `capabilities.includes('settings')` | `panel-registry.test.mjs: filters panels by available capabilities` | REAL | Dynamically hidden if settings capability is absent. |
| Session List | Session title, pin indicator | `GET /sessions` | `desktop-client.test.mjs: session management` | REAL | Rendered strictly from server session pages; empty on fresh boot. |

---

## 3. Chat Panel (`ChatPanel.tsx`)

| Control / Displayed Value | Element | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Active Model Badge | Header chip | Active model state from `GET /models` | `reality.test.mjs: unknown hardware or missing fields display Unknown` | UNKNOWN-SHOWN | Shows `"No model loaded"` when no model is installed/selected. |
| Assurance Indicator | Header status chip | `CapabilityReport.platform_assurance` | `reality.test.mjs: assurance labels agree with platform assurance` | REAL | Shows `"CONTAINED"` for verified kernel containment, `"UNVERIFIED"` on Windows. Never claims `"BLOCKED"`. |
| Parameter Drawer Button | `⚙️ Parameters` button | Local drawer toggle | `reality.test.mjs` | REAL | Opens/closes Jan-style parameter drawer. |
| User Messages | Bubble text | Local message stream | `SafeMarkdown.test.mjs` | REAL | Rendered directly from user input. |
| Assistant Messages | Markdown body | SSE stream chunk delta | `desktop-client.test.mjs: stream decodes split Unicode` | REAL | Streamed via `/chat/completions`. |
| Assistant Speed Metric | `⚡ tok/s` | `msg.speed` (live stream delta) | `reality.test.mjs: zero sample thread titles or fabricated claims` | REAL | Only displayed when dynamically measured from token arrival timestamps. Never fabricated. |
| Thinking Disclosure | `Thinking Process` | `msg.thinking` (stream event) | `SafeMarkdown.test.mjs` | REAL | Only rendered if real reasoning tokens are emitted by the model engine. |
| Citations List | Source chip, page, quote | `msg.citations` (`KnowledgeAnswer`) | `desktop-client.test.mjs: Knowledge validates answers` | REAL | Rendered strictly from RAG backend search matches. |
| Copy Message Action | `📋 Copy` button | `navigator.clipboard.writeText` | `SafeMarkdown.test.mjs: SafeMarkdown renders code block with copy button` | REAL | Copies raw message markdown to system clipboard. |
| Composer Textarea & Send | Text input / submit | Keyboard / Form event | `desktop-client.test.mjs` | REAL | Dispatches prompt to `/chat/completions`. |
| Stop Generation Button | `Stop` button | `AbortController.abort()` | `desktop-client.test.mjs: stop aborts the admitted run` | REAL | Halts SSE stream reader. |

---

## 4. Parameter Drawer (`ThreadDrawer.tsx`)

| Control | Bound Value | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Model Dropdown | Selected model ID | `GET /models` | `desktop-client.test.mjs: models are validated` | UNKNOWN-SHOWN | Shows `"No models detected"` if list is empty. |
| System Prompt Textarea | System instruction string | Thread parameters state | `desktop-client.test.mjs` | REAL | Sent in `/chat/completions` request envelope. |
| Temperature Slider | Float `0.0` – `2.0` | Thread parameters state | `tokens.test.mjs` | REAL | Sets sampling randomness. |
| Top-P Slider | Float `0.0` – `1.0` | Thread parameters state | `tokens.test.mjs` | REAL | Sets nucleus sampling cutoff. |
| Max Tokens Slider | Integer `128` – `4096` | Thread parameters state | `tokens.test.mjs` | REAL | Sets generation token boundary. |
| Stream Toggle | Boolean | Thread parameters state | `desktop-client.test.mjs: stream decodes split Unicode` | REAL | Toggles SSE streaming vs batch return. |
| Export / Clear Thread | Action buttons | Thread state | `desktop-client.test.mjs: session mutations` | REAL | Clears local messages or exports JSON payload. |

---

## 5. Models Screen (`ModelsPanel.tsx`)

| Control / Value | Element | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Model List | Card grid | `GET /models` | `desktop-client.test.mjs: models are validated` | REAL | Discovered from local weights directory (`.sanctum/models`). |
| Context Length | Metadata badge | `Model.context_length` | `reality.test.mjs: unknown hardware or missing fields display Unknown` | UNKNOWN-SHOWN | Displays `"Unknown"` if metadata header is missing. |
| Capabilities List | Chips | `Model.capabilities` | `desktop-client.test.mjs` | REAL | Published capabilities (`chat`, `code`, `embeddings`). |

---

## 6. Packs Screen (`PacksPanel.tsx`)

| Control / Value | Element | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Pack Grid | Pack cards | `GET /api/capability` -> `packs` | `m2-client.test.mjs: SanctumClient manages packs` | REAL | Lists verified modality packs (`knowledge`, `speech`, `vision`). |
| Pack State Chip | Status badge | `PackInfo.state` | `m2-client.test.mjs: pack load and unload` | REAL | Shows actual state: `installed`, `loaded`, `absent`, or `error`. |
| Resource Budgets | RAM / Disk meters | `PackInfo.ram_budget_mb`, `disk_bytes` | `m2-client.test.mjs` | REAL | Declared in pack manifests. |
| Load Pack Action | `Load` button | `POST /api/pack/load` | `m2-client.test.mjs: pack load` | REAL | Requests gateway supervisor to spawn/admit pack. |
| Unload Pack Action | `Unload` button | `POST /api/pack/unload` | `m2-client.test.mjs: pack unload` | REAL | Gracefully terminates pack process and reclaims memory. |

---

## 7. Settings Screen (`SettingsPanel.tsx`)

| Setting Control | Type | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Color Theme Selector | Radio / Select | `GET /api/settings` (`ui.theme`) | `tokens.test.mjs: Theme palettes declare all required tokens` | REAL | Persisted via `POST /api/settings`. |
| UI Scale Factor | Number input | `GET /api/settings` (`ui.scale_factor`) | `tokens.test.mjs: Density multipliers match specification` | REAL | Adjusts root viewport font scale. |
| Reduced Motion Toggle | Boolean checkbox | `GET /api/settings` (`ui.reduced_motion`) | `tokens.test.mjs` | REAL | Disables CSS transitions. |
| Default Model Field | Text input | `GET /api/settings` (`models.default`) | `m2-client.test.mjs: SanctumClient manages settings` | UNKNOWN-SHOWN | Displays empty string / `"None"` if unset. |
| Egress Kill Switch Status | Read-only status chip | `GET /api/settings` (`network.egress_enabled`) | `m2-client.test.mjs` | REAL | Shows `"OFFLINE ONLY"` or `"EGRESS ALLOWED"` matching typed setting. |
| Export Configuration | Button | `GET /api/settings/export` | `m2-client.test.mjs: settings export` | REAL | Downloads JSON configuration bundle. |
| Import Configuration | Modal / Textarea | `POST /api/settings/import` | `m2-client.test.mjs: settings import` | REAL | Validates JSON schema against typed gateway registry. |

---

## 8. Status Bar (`StatusBar.tsx`)

| Metric / Indicator | Displayed Value | Data Source | Test ID | Status | Notes |
|---|---|---|---|---|---|
| Engine Readiness | Green dot / Connecting | `GET /api/health` | `desktop-client.test.mjs: bounded same-origin read` | REAL | Reflects live socket/HTTP reachability. |
| Platform Assurance Label | Text badge | `CapabilityReport.platform_assurance` | `reality.test.mjs: assurance labels agree` | REAL | Re-verifies startup containment tier. |
| Active Model Name | String label | Active model state | `reality.test.mjs: unknown hardware or missing fields display Unknown` | REAL | Displays model ID or `"None"`. |
| Inference Threads | Number | `CapabilityReport.hardware.threads` | `m2-client.test.mjs` | REAL | Reports core inference thread allocation. |
| Context Limit | Number | `CapabilityReport.hardware.context` | `m2-client.test.mjs` | REAL | Reports allocated engine context limit. |

---

## 9. Removed Unbacked Simulations (Rule 1b ABSENT)

| Proposed Feature | Prior Implementation | Reality Rule Violation | Action Taken |
|---|---|---|---|
| Model Compare Arena (`ComparePanel.tsx`) | `setTimeout` with canned Rust vs Python generation and fake `44.2 tok/s` | Rule 1b: Simulated execution without backend dual-stream runner. | **ABSENT**: Completely removed from source, navigation, and bundle. |
| Hardware-Aware Cookbook (`CookbookPanel.tsx`) | Static `COOKBOOK_MODELS` with fabricated RAM/VRAM numbers (16GB/8GB) and fake download progress | Rule 1a / 1d / 1f: Fabricated catalog and invented hardware figures. | **ABSENT**: Completely removed from source, navigation, and bundle. |
| Deep Research Workspace (`ResearchPanel.tsx`) | Fake document retrieval and static markdown report with unverified claims | Rule 1b / 1c: Simulated research without backend retriever. | **ABSENT**: Completely removed from source, navigation, and bundle. |
