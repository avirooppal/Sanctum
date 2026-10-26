# System Architecture Specification

## 1. Overview
Sanctum is structured as a modular, sovereign local-first AI workspace. Presentation layers are strictly decoupled from AI inference, document retrieval, and system supervision.

```text
contracts/            OpenAPI, JSON schemas, typed clients, error-code registry
core/
  api/                Routes, request validation, SSE/ndjson streaming, error mapping
  domain/             Threads, assistants, settings schema, model registry, data classes
  ai/
    inference/        Engine ports & Ollama / LM Studio adapters, streaming parser
    tools/            Tool-call execution loop, MCP host/client, sandbox abstractions
    rag/              Vector store, chunking, semantic similarity, citations
    speech/           WhisperX server integration & audio transcription adapters
    prompts/          System prompt templates & prompt assembly
    hardware/         VRAM detection, telemetry heuristics, engine diagnostics
  infra/              LocalStorage persistence, process supervision, platform layers
apps/
  ui/                 Frontend components, layout, state hooks, styling tokens
src-tauri/            Tauri 2 / WebView2 desktop shell configuration & capabilities
vendor/webview2/      Pinned Microsoft.Web.WebView2.Core, WinForms & WebView2Loader SDK
tests/                Integration suites, characterization tests, fixtures
tools/                Desktop host compiler, installer builder, exe-verify suites
```

## 2. Invariant Rules
1. **Unidirectional Dependency Flow**:
   `ui` -> `contracts` -> `domain` -> `ai` -> `infra`
2. **Zero AI Logic in UI**:
   UI components render data received from core domain/API clients. Prompt strings, reasoning extraction regular expressions, token math, and hardware fit formulas are forbidden in `apps/ui`.
3. **No UI in Core**:
   Core modules never import React components, JSX elements, or UI styling libraries.
4. **Contract Supremacy**:
   All inter-boundary data structures are governed by explicit TypeScript interfaces in `contracts/`.

## 3. Standalone Desktop Host Architecture (ADR 0104)
- **Window & Process Ownership**: `Sanctum-Desktop.exe` creates a native Win32 `Form` (`HWND`) with `SetCurrentProcessExplicitAppUserModelID("Sanctum.Desktop.App.1")`, binds a Win32 Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`), and embeds `CoreWebView2Controller` directly inside `this.Handle`.
- **In-Process UI & API Transport**: Static assets are mapped to `https://sanctum.app` via `SetVirtualHostNameToFolderMapping` and `/api/*` + `/v1/*` requests are handled in-process via `CoreWebView2.WebResourceRequested` with **0 listening TCP ports** by default (the OpenAI-compatible Local API Server binds `127.0.0.1:<port>` only when enabled in Settings > Local API Server or via `--headless`).
- **Network Silence & Accelerator Lock**: WebView2 runs with `AreBrowserAcceleratorKeysEnabled = false`, `AreDefaultContextMenusEnabled = false`, `AreDevToolsEnabled = false` (release), and `--host-resolver-rules="MAP * ~NOTFOUND"` so renderer/network sub-processes make 0 outbound connections.
