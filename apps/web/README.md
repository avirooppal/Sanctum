# Web client

Build uses pinned Tailwind 4 core with a local literal-class collector, without the
v3 scanner tree or optional native integrations (ADR 0025). `npm run build` generates
ignored `build/styles.css` from TS/TSX and index.html before Vite bundles the app.
Use complete literal utility names; dynamically constructing class names is unsupported.
`npm audit --prefix apps/web --audit-level=low` is a separate online development/CI
gate. Runtime has no registry calls. All 72 locked dependency licenses are reviewed.
React, TypeScript, Tailwind; same-origin local API only. Contract: docs/contracts/chat.openapi.json.
Local bearer key is held in memory, never localStorage. Includes streaming chat,
configured model picker and saved conversation restoration. Build assets are served
by the confined Rust gateway. No remote fonts, scripts, analytics or CDN assets.

Run `npm ci --prefix apps/web`, `npm run typecheck --prefix apps/web`, and
`npm run build --prefix apps/web`. Browser smoke test: log in, send a prompt, create
a new conversation, restore the prior conversation. Verified against real inference.

`npm test --prefix apps/web` runs the speech controller's cancellation/transport tests.
Local speech expands optional file dictation and playback controls. Enter configured
ASR/TTS/voice IDs, choose a mono PCM16 16 kHz WAV, review the draft, then send.
Read answer synthesizes the last response; Stop audio cancels browser delivery/playback.
Start microphone requests device access only on click. Finish dictation closes the
device and transcribes up to 30 seconds; Stop audio discards capture. The worklet
and capture buffer enforce the limit independently. Unsupported device/browser
formats fail explicitly. Server-side cancellation is not yet provided. Contract:
`docs/contracts/web-speech-v1.md`. Run `evals/browser_speech.mjs` against a configured
gateway for real integration; CLI arguments are documented at the top of the script.

`evals/browser_microphone.mjs` runs Chromium's emulated microphone through the real
capture worklet and ASR. It needs full Chromium headless (`channel: chromium`), not
headless-shell. Physical microphone and speaker verification remains a separate check.
