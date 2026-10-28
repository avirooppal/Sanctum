# Sanctum

A local AI chat workspace built with Next.js, React, TypeScript and Zustand.
The current entry point is `src/components/jan/JanAppShell.tsx`: onboarding,
chat, projects, search, the model hub and settings.

## Run locally

Use Node.js **22.6 or newer** (tests use native TypeScript stripping), npm,
and an installed Ollama service for inference.

```powershell
npm ci
ollama serve
```

In another terminal, install a model if needed, then start the UI:

```powershell
ollama pull qwen3:1.7b
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. Setup checks the local service and allows continuing
offline. The service normally listens on `127.0.0.1:11434`; chat uses a
same-origin streaming proxy, so browser CORS access to Ollama is unnecessary.
Use the model selector to choose an installed model. First-token latency depends
on model loading, context allocation and hardware. Stop works during loading and
generation; Retry replaces the last response without duplicating its prompt.

For a production web build:

```powershell
npm run build
npm start -- --hostname 127.0.0.1
```

Keep this personal workspace bound to loopback. The web server does not implement
multi-user authentication or tenant isolation.

## Supported chat workflow

- Stream local model replies; inspect status, errors and measured timing.
- Set conversation system instructions, temperature and top-p.
- Create, rename, pin, duplicate, group, search and export conversations.
- Copy responses, regenerate the latest response, and persist bookmarks. The
  composer bookmark button filters saved responses within the current chat.
- Attach images or text, Markdown, JSON, CSV and source files (10 MB per file).
  Images require a compatible vision model. PDF extraction is unavailable and
  PDFs are rejected rather than sent as binary text.
- Text attachments enter the local document index; My documents retrieves
  passages from the active collection. The built-in index uses deterministic
  hashed vectors, not a downloaded semantic embedding model.

Browser conversations, projects, bookmarks and document chunks persist in this
origin's localStorage. Reloading marks unfinished generations as interrupted.
Storage failures produce an explicit warning; unreadable storage is preserved.
Use the sidebar's chat export before clearing browser data or changing origins.
The desktop host has separate persistence and integration behavior; the browser
does not silently post its conversations to an absent desktop threads endpoint.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`lint` runs the repository's Python architecture gate (Python 3 required), not
ESLint. `typecheck` performs the TypeScript check. Tests use Node's test runner;
live engine tests can skip when their required endpoint/model is unavailable.
A passing suite with skips does not prove those integrations. New chat regression
tests exercise the actual store and engine parser, including cancellation,
thread switching, duplicate prevention, stream errors and truthful downloads.

See [current verification notes](docs/PROJECT_CHECKLIST.md) for this pass.
Historical evidence is available through [evals/README.md](evals/README.md).
Generated reports stay in ignored `evals/results/` and CI artifacts; historical
claims in `docs/STATUS.md` are not guarantees for the current checkout.

## Architecture and integration limits

- `src/app`: Next.js entry point and HTTP routes.
- `src/components/jan`, `src/components/screens`: active interface.
- `src/store/slices`: conversation, model and document state.
- `core/ai`: engine clients, streaming, retrieval and domain services.
- `core/infra`, `contracts`: storage, shared types and settings contracts.
- `tools`, `deploy`, `src-tauri`: Windows desktop packaging and host code.

The Windows build remains available through `python tools/build_installer.py`;
see [deployment documentation](deploy/README.md) for its toolchain. Source changes
do not update the checked-in EXE automatically.

The repository also contains legacy arena, research and agent screens, and
experimental cloud, MCP, speech and desktop integrations. Their presence or
settings controls do not imply an end-to-end connection to the active chat UI.
Cloud-provider settings are not used by this local chat dispatch path. The
unconnected chat Web Search toggle has been removed. Speech requires the
corresponding local service or browser speech support; no speech or vision
quality claim is made by the chat regression tests.

Local chat targets the local inference service. Model downloads, optional cloud
features, research and browser speech recognition can contact external services;
this is **not** a blanket zero-network-egress guarantee. No third-party analytics
are intentionally bundled.

Licensed under [MIT](LICENSE).

Dependency remediation and verification: [Security update](docs/SECURITY_UPDATE.md). The Next.js-scoped PostCSS and Sharp overrides retain patched dependency versions; review them with future framework upgrades.
