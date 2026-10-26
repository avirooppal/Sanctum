# UI Parity Tracking Table (Jan v0.8.7 Exact Match)

Central tracking matrix mapping all screens, dialogs, and controls from upstream Jan v0.8.7 to Sanctum backend handlers and test verifications.

---

| Section / Screen | Upstream v0.8.7 Feature | Owner Screenshot | Sanctum Backend Handler / IPC | Status | Verification Test / Journey |
|---|---|---|---|---|---|
| **First Run** | Step 1: Onboarding welcome card | `preview.webp` | Built-in llama.cpp CPU check | **ACTIVE** | `jan_parity_flow.test.ts` |
| **First Run** | Step 2: System hardware probe | Upstream source | `GET /api/capability` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **First Run** | Step 3: Recommended model / Hub link | Upstream source | `GET /v1/models` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Wordmark & Layout | `Screenshot 2026-10-25 190854.png` | `Sanctum` branded header | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Download Manager popover button | `Screenshot 2026-10-25 190854.png` | Circular progress ring & state | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Collapse toggle | `Screenshot 2026-10-25 190854.png` | `useAppStore.toggleExplorer` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | New Chat (Ctrl+N) | `Screenshot 2026-10-25 190854.png` | `createNewChatSession` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | New Projects (Ctrl+P) | `Screenshot 2026-10-25 190854.png` | Opens `AddProjectDialog` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Search (Ctrl+K) | `Screenshot 2026-10-25 190854.png` | Opens `SearchDialog` | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Hub link | `Screenshot 2026-10-25 190854.png` | Switches active view to Hub | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Settings link | `Screenshot 2026-10-25 190854.png` | Switches active view to Settings | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Sidebar** | Projects list & thread tree | `Screenshot 2026-10-25 190854.png` | Persistent project / thread storage | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Command Palette** | Search Threads modal (Ctrl+K) | `preview (2).webp` | Searches active threads by title & body | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Command Palette** | "New Chat" row action | `preview (2).webp` | Creates and selects new chat session | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Command Palette** | Keyboard navigation & esc close | `preview (2).webp` | Arrow keys, Enter, Esc | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Projects** | Create New Project dialog | `preview (3).webp` | Validates name & creates project folder | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Projects** | Select assistant dropdown | `preview (3).webp` | Links custom assistant to project | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | Hugging Face search box | `preview (1).webp` | Egress-gated query or local search | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | Sort menu ("Newest" / "Most downloaded") | `preview (1).webp` | Real sort comparator on catalog | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | "Downloaded" filter toggle switch | `preview (1).webp` | Filters list to downloaded models | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | Model card with "Fits" badge | `preview (1).webp` | VRAM/RAM fit calculation | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | "Download · Q4_K_M" action button | `preview (1).webp` | Consent modal -> download pipeline | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | Metadata tags: Tools, Multimodal, params | `preview (1).webp` | Parsed model capability flags | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Model Hub** | "Show variants" expandable table | `preview (1).webp` | Lists quantizations with sizes | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Downloads Popover** | Active item card with progress bar | `186e7d53-2468-4c1c-b016-18af1233da1f.png` | Real byte & percentage tracker | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Downloads Popover** | Pause, resume, and cancel buttons | `186e7d53-2468-4c1c-b016-18af1233da1f.png` | AbortController / HTTP Range resume | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | General tab | `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` | Version, update check, data folder | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Data folder change & copy path | `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` | Copies path / triggers relocation dialog | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | App Logs: Show in Explorer & Open Logs | `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` | Shell file reveal & inline viewer | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Reset to Factory Settings | `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` | Scoped data reset with modal prompt | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Appearance, Assistants, Attachments | Upstream source | Full config schemas | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Local API Server, HTTPS Proxy, Web Search | Upstream source | Host loopback listeners | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Hardware & Privacy | Upstream source | Real hardware specs & ledger | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | MCP Servers & Integrations | Upstream source | Real MCP tools registry | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Settings** | Remote Providers (OpenAI, Anthropic, etc.) | Upstream source | Windows Credential Manager storage | **ACTIVE** | `jan_parity_flow.test.ts` |
| **Chat & Threads** | Live streaming, reasoning, stop, retry | Upstream + Amend 1 | `LocalEngineClient` + `RequestStatusLine` | **ACTIVE** | `jan_parity_flow.test.ts` |
