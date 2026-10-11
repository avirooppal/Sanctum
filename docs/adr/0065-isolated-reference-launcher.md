# ADR 0065: Isolated Upstream Reference Environment and Mock Boundaries

Accepted 2026-10-11.

## Context
ADR 0064 and MISSION Amendment 1 require exact fidelity comparison between Sanctum's ported surfaces and the upstream NousResearch/hermes-agent reference (pinned SHA `b30f95ac4a80d2f6dbe3aa01001b0524314f6d74`). Upstream surfaces include:
1. `web/`: The React/Vite browser dashboard.
2. `apps/desktop/`: The Electron chat renderer.

Upstream brings a massive dependency tree (Electron, React 19, Three.js, xterm, node-pty, dbus-native, etc.). These dependencies must **never** contaminate Sanctum's production runtime or build artifacts (`apps/web/package.json` and its lockfile must remain strictly decoupled). Furthermore, running upstream requires isolation from the host to prevent network egress, credential leakage, and arbitrary script execution.

## Decision

### 1. Two-Phase Isolated Container Boundary
All fetching, building, and serving of the upstream reference occurs inside containerized environments:
- **Phase 1: Controlled Fetch**:
  - Container-only execution using pinned Node image (`node:24.14.0-bookworm-slim`, digest `sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8`).
  - Executed with `--ignore-scripts` to block pre/post-install lifecycle script execution.
  - Pinned root lockfile SHA-256: `30d55e0385ebfb04b2af39cf594643973264808495352648b891103cc02a5bec`.
  - Electron and native binary downloads are explicitly suppressed (`ELECTRON_SKIP_BINARY_DOWNLOAD=1`).
  - Dependency tree cached in an isolated named volume / staging directory outside the repository tree.
- **Phase 2: Offline Build & Run**:
  - Run with `--network none` (network denied).
  - Read-only mount of the pinned source tree (`/reference:ro`).
  - Throwaway `HOME` (`/tmp/home`), throwaway `/tmp` cache, no host credential mounts, non-root user execution, memory and CPU limits.
  - The dashboard and renderer bundles are built into an isolated output directory.

### 2. Isolated Reference Mock Layer (`tools/reference/`)
To render the upstream components for visual comparison without backend infrastructure:
- **Mock Gateway (`tools/reference/mock_gateway.py` / `mock_gateway.mjs`)**:
  - Implements the exact HTTP endpoints called by `web/src/lib/api.ts` (e.g. `/api/status`, `/api/models`, `/api/config`, `/api/sessions`, `/api/health`).
  - Implements the JSON-RPC methods called by `apps/desktop/src/api/client.ts` over WebSocket (`command.resolve`, `commands.catalog`, `config.get`, `models.options`, `approval.pending`, etc.).
  - Serves static fixture data (realistic sessions, models, config, and system status).
- **Mock Electron Bridge (`tools/reference/mock_electron_bridge.js`)**:
  - Injected into the browser environment at `window.hermesDesktop` matching `apps/desktop/electron/preload.ts`.
  - Stubs `api()`, `getConnection()`, `windowControls`, `wakeIndicator`, `hud`, and translucency support flags without native Electron.

### 3. Strict Product Isolation Gate
- No code in `tools/reference/` or from the upstream tree may be imported by `apps/web` or any production service.
- An automated unit test (`apps/web/tests/reference-boundary.test.mjs`) asserts that `apps/web/package.json` contains no unreviewed dependencies and that production source files have zero imports referencing `tools/reference` or `.sanctum/upstream`.

## Consequences
- Upstream reference can be rendered, inspected, and screenshotted under Playwright for pixel-diff fidelity without running Electron on the host.
- Zero network egress occurs during build or comparison execution.
- Sanctum's production bundles remain completely clean and independent.
