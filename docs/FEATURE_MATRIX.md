# Sanctum Settings & Features Matrix

Automatically generated from `core/domain/settings_schema.ts` and verified by test suites.

| Section | Key | UI Label | Type | API Route | Test ID / Evidence | Status |
|---|---|---|---|---|---|---|
| `general` | `general.language` | Language | `select` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `general` | `general.autoUpdateCheck` | Automatic Update Check | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `general` | `general.spellCheck` | Spell Check | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `appearance` | `appearance.theme` | Theme | `select` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `appearance` | `appearance.fontSize` | Font Size | `select` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `appearance` | `appearance.showTokenSpeed` | Show token speed | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `appearance` | `appearance.coloredUserBubble` | Colored user message bubble | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `assistants` | `assistants.defaultModel` | Default Model | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `assistants` | `assistants.systemPrompt` | System Instructions | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `assistants` | `assistants.temperature` | Temperature | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `assistants` | `assistants.topP` | Top P | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `assistants` | `assistants.maxTokens` | Max Generation Tokens | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `attachments` | `attachments.enable` | Enable Attachments | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `attachments` | `attachments.maxFileSizeMB` | Max Document Size (MB) | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `attachments` | `attachments.chunkSize` | Chunk Size (characters) | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `attachments` | `attachments.chunkOverlap` | Chunk Overlap (characters) | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `attachments` | `attachments.topK` | Top-K Citations | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `local-api-server` | `localApi.enable` | Run Local API Server | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `local-api-server` | `localApi.host` | Server Host | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `local-api-server` | `localApi.port` | Server Port | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `local-api-server` | `localApi.apiKeyRequired` | Require API Key | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `local-api-server` | `localApi.corsEnabled` | Cross-Origin Resource Sharing (CORS) | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `https-proxy` | `httpsProxy.enable` | Enable Proxy | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `https-proxy` | `httpsProxy.url` | Proxy URL | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `https-proxy` | `httpsProxy.bypass` | Bypass Hosts | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `web-search` | `webSearch.enable` | Enable Web Search | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `web-search` | `webSearch.provider` | Search Provider | `select` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `web-search` | `webSearch.endpoint` | SearXNG Instance URL | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `shortcuts` | `shortcuts.newChat` | New Chat | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `shortcuts` | `shortcuts.newProject` | New Project | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `shortcuts` | `shortcuts.search` | Search Threads | `string` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `hardware` | `hardware.cpuThreads` | CPU Thread Allocation | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `hardware` | `hardware.gpuLayers` | GPU Offload Layers | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `hardware` | `hardware.contextLength` | Context Length | `number` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `privacy` | `privacy.diagnosticOptIn` | Anonymous Diagnostic Sharing | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |
| `privacy` | `privacy.strictConsentPrompt` | Strict Consent Gating | `boolean` | `/api/settings` | `settings_foundation.test.ts` | **ACTIVE** |

Total Settings Tracked: 36
Untested Items: 0
