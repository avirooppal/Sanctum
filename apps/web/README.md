# Web client
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
Microphone capture and server-side cancellation are not yet provided. Contract:
`docs/contracts/web-speech-v1.md`. Run `evals/browser_speech.mjs` against a configured
gateway for real integration; CLI arguments are documented at the top of the script.
