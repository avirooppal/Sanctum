# Upstream UI Inventory

Detailed inventory of routes, components, state stores, services, and native bindings in Jan (`janhq/jan`, commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`, `web-app`).

---

## 1. Top-Level Routes (`web-app/src/routes`)

| Route | Upstream File | Description | Sanctum Status |
|---|---|---|---|
| `/__root` | `routes/__root.tsx` | Main application shell, title bar, left sidebar navigation | **PORT 1:1** |
| `/` | `routes/index.tsx` | Root redirect to `/threads` or onboarding | **PORT 1:1** |
| `/threads/$threadId` | `routes/threads/$threadId.tsx` | Main chat conversation workspace with right parameter drawer | **PORT 1:1** |
| `/hub` | `routes/hub/index.tsx` | Model Hub: catalog and installed model manager | **PORT 1:1** (Installed models ACTIVE; remote catalog gated) |
| `/hub/$modelId` | `routes/hub/$modelId.tsx` | Detailed model parameters, format, and quantization details | **PORT 1:1** |
| `/project` | `routes/project/` | Project workspaces and file attachments | **PORT 1:1** |
| `/local-api-server` | `routes/local-api-server/` | Local OpenAI-compatible server status & toggle | **PORT 1:1** |
| `/system-monitor` | `routes/system-monitor.tsx` | System resource monitor (CPU, RAM, GPU/VRAM) | **PORT 1:1** (Real hardware only) |
| `/artifacts` | `routes/artifacts.tsx` | Artifact viewer | **PORT 1:1** |
| `/logs` | `routes/logs.tsx` | Application log viewer | **PORT 1:1** |
| `/settings/general` | `routes/settings/general.tsx` | General preferences, data folder, clear data | **PORT 1:1** |
| `/settings/interface` | `routes/settings/interface.tsx` | Appearance, theme, scale factor | **PORT 1:1** |
| `/settings/hardware` | `routes/settings/hardware.tsx` | CPU threads, GPU acceleration, VRAM allocation | **PORT 1:1** |
| `/settings/assistant` | `routes/settings/assistant.tsx` | Assistant profiles & system instructions | **PORT 1:1** |
| `/settings/mcp-servers` | `routes/settings/mcp-servers.tsx` | Model Context Protocol servers manager | **PORT 1:1** |
| `/settings/providers` | `routes/settings/providers/` | Cloud model provider API keys (OpenAI, Anthropic, etc.) | **PORT 1:1** (Off by default, BYOK) |
| `/settings/local-api-server` | `routes/settings/local-api-server.tsx` | Local server port and CORS configuration | **PORT 1:1** |
| `/settings/shortcuts` | `routes/settings/shortcuts.tsx` | Keyboard shortcut bindings | **PORT 1:1** |
| `/settings/privacy` | `routes/settings/privacy.tsx` | Data privacy controls (telemetry stripped) | **PORT 1:1** |
| `/settings/attachments` | `routes/settings/attachments.tsx` | Document attachment limits and formats | **PORT 1:1** |
| `/settings/web-search` | `routes/settings/web-search.tsx` | Web search tool integration | `PENDING-BACKEND` |
| `/settings/extensions` | `routes/settings/extensions.tsx` | Extension plugin manager | `REMOVED-BY-OWNER` |
| `/settings/cowork` | `routes/settings/cowork.tsx` | Cowork agent features | `REMOVED-BY-OWNER` |

---

## 2. Core Service Interfaces (`web-app/src/services`)

| Service Interface | Method Surface | Sanctum Mapping |
|---|---|---|
| `ThreadsService` | `get()`, `list()`, `create()`, `delete()`, `pin()`, `rename()` | Gateway `/v1/sessions` and `/v1/conversations` |
| `MessagesService` | `stream()`, `send()`, `delete()`, `retry()` | Gateway `/v1/chat/completions` (SSE) |
| `ModelsService` | `list()`, `importGguf()`, `delete()`, `load()`, `unload()` | Gateway `/v1/models` & `/api/models/import-gguf` |
| `AssistantsService` | `list()`, `create()`, `update()`, `delete()` | Gateway `/v1/profiles` |
| `MCPService` | `list()`, `add()`, `remove()`, `respondCall()` | Gateway `/api/mcp/*` |
| `ProvidersService` | `list()`, `saveKey()`, `removeKey()` | Gateway `/api/providers/*` |
| `HardwareService` | `getHardware()`, `getVram()` | Gateway `/api/capability` hardware info |
| `AppService` | `getVersion()`, `getDataPath()`, `purgeData()` | Gateway `/api/settings` & `/v1/purge` |
| `ThemeService` | `getTheme()`, `setTheme()` | Local typed settings |
| `DialogService` | `showConfirm()`, `showPrompt()`, `showFilePicker()` | Compatibility modal / native dialog |
| `AnalyticService` | PostHog telemetry | **STRIPPED** (No-op stub) |
| `UpdaterService` | Auto-updater check | **STRIPPED** (No-op stub) |

---

## 3. UI Component Architecture (`web-app/src/components`)

- **Radix UI Primitives**: `@radix-ui/react-accordion`, `dialog`, `dropdown-menu`, `popover`, `slider`, `switch`, `tooltip`, `tabs`.
- **Icons**: `@tabler/icons-react` and `lucide-react` (both MIT-licensed).
- **Styling**: Tailwind CSS v4 (`web-app/src/index.css`), using `@theme` block with semantic color variables (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--accent-primary`).
- **Markdown & Streaming**: `streamdown` / `react-markdown` with syntax highlighting and LaTeX math (`katex`).
- **Layout Panels**: `react-resizable-panels` for collapsible sidebars and right drawer.

---

## 4. Dependencies & License Audit

All dependencies are verified permissively licensed (MIT, Apache-2.0, BSD-3-Clause). Zero copyleft dependencies enter the web app bundle.
Full records documented in `docs/ui-provenance.md` and `THIRD_PARTY_NOTICES.md`.
