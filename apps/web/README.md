# Web client
React, TypeScript, Tailwind; same-origin local API only. Contract: docs/contracts/chat.openapi.json.
Local bearer key is held in memory, never localStorage. Includes streaming chat,
configured model picker and saved conversation restoration. Build assets are served
by the confined Rust gateway. No remote fonts, scripts, analytics or CDN assets.

Run `npm ci --prefix apps/web`, `npm run typecheck --prefix apps/web`, and
`npm run build --prefix apps/web`. Browser smoke test: log in, send a prompt, create
a new conversation, restore the prior conversation. Verified against real inference.
