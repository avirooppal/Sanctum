# ADR 0097 — Native Compatibility Shim Selection Over Tauri Native Runtime

Date: 2026-10-21  
Branch: `jan-style`  
Status: PROVISIONAL — Owner Review Required  

---

## Context

Per Section 4.3 of the UI Port specification:
> "Data and native layer swapped, UI untouched: implement a compatibility layer exposing exactly the native/Tauri JS surface the UI calls (invoke, events, dialogs, filesystem, opener, window controls, clipboard), backed by Sanctum's shell and core. Decide by ADR between a small shim on the chosen shell and adopting Tauri itself, using the license gate (MPL policy ADR 0090) and the measured costs from ADR 0091; whichever is smaller and cleaner wins."

We evaluate:
1. **Full Tauri v2 Adoption**: Bundling Tauri Rust runtime into Sanctum's desktop shell, importing `@tauri-apps/api` and Tauri plugins (`plugin-store`, `plugin-opener`, `plugin-dialog`, `plugin-http`, `plugin-log`).
2. **Lightweight Compatibility Shim (`SanctumNativeShim`)**: An exact drop-in implementation of the Tauri JS surface (`window.__TAURI_INTERNALS__`, `@tauri-apps/api` invoke/listen, file dialogs, window controls, clipboard) backed directly by Sanctum's gateway core (`127.0.0.1:<port>`) and webview shell APIs.

---

## Evaluation & Measured Tradeoffs

### 1. Measured Shell Costs (from ADR 0091)
- **Tauri shell candidate**: Release binary 3,498,248 B (3.5 MB), root RSS 184 MB, tree RSS 474 MB, ready time 1.48 s.
- **Direct Webview/Shim candidate (`wry` or standalone shell)**: Release binary 705,576 B (700 KB, 5x smaller), root RSS 186 MB, tree RSS 469 MB, ready time 1.48 s.
- The shim approach eliminates Tauri's IPC serialization overhead and allows running both inside the desktop webview shell and in standard browser preview without native binary dependencies.

### 2. License Compliance (ADR 0090 MPL-2.0 Policy)
- Adopting Tauri brings extensive dependencies including MPL-2.0 crates (`cssparser`, `selectors`, `option-ext`) requiring isolated file boundaries and notice handling.
- The JS compatibility shim is 100% Apache-2.0 / MIT compatible, keeping the frontend distribution completely free of copyleft or MPL-governed code.

### 3. Portability & Testability
- The shim enables running automated headless tests (`node:test`, Playwright, Vite preview) against the real Sanctum gateway HTTP/SSE endpoints without needing a Tauri mock environment or native OS window.
- The UI layer remains completely untouched: it calls the standard `invoke()`, `listen()`, `open()`, and `save()` surfaces, which the shim handles synchronously or via standard `fetch()`.

---

## Decision

We select **Option 2: Lightweight Compatibility Shim (`SanctumNativeShim`)**.

1. **Architecture**:
   - The UI code interacts with native capabilities through standard Tauri API entry points (`@tauri-apps/api/core`, `@tauri-apps/plugin-*`) and `ServiceHub`.
   - The compatibility shim intercepts these calls and forwards them directly to Sanctum Gateway endpoints (`/v1/sessions`, `/v1/chat/completions`, `/v1/models`, `/v1/profiles`, `/api/capability`, `/api/settings`, `/api/mcp/*`).
   - Dialogs (confirmation, model consent, file pickers) use accessible HTML/CSS modal dialogs matching upstream's design tokens when native OS dialogs are unavailable.
   - Window controls (minimize, maximize, close) dispatch to the shell via IPC or window postMessage.

2. **Clean Boundary**:
   - The UI components and state stores in `apps/web/src/` remain identical to upstream Jan.
   - All backend adaptations live strictly inside the compatibility adapter (`apps/web/src/services/` and `apps/web/src/lib/shim/`).

---

## Consequences

- The web app runs seamlessly across desktop webview, browser dev preview (`preview.html`), and CI test suites without divergence.
- Eliminates 3.5 MB of unnecessary binary bloat and 15+ external Tauri crates.
- All network and native calls pass through Sanctum's gateway where egress controls and authentication tokens are strictly enforced.
